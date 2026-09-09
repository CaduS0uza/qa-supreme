#!/usr/bin/env node
// Proves the authenticated path end to end: without credentials the pipeline must stop at the
// login wall; with them it must sign in and explore what is behind it.
import fs from 'node:fs'

const [unauthFile, authFile] = process.argv.slice(2)
const read = (f) => { if (!fs.existsSync(f)) { console.error(`✖ missing run: ${f}`); process.exit(1) } return JSON.parse(fs.readFileSync(f, 'utf8')) }
const unauth = read(unauthFile)
const auth = read(authFile)

const checks = [
  ['unauthenticated run names the auth wall', () => unauth.stages.smoke?.data?.checks?.some(c => c.check === 'authentication' && c.result === 'FAIL')],
  ['unauthenticated run refuses to keep going', () => unauth.aborted === 'smoke' && unauth.verdict.decision === 'NO-SHIP'],
  ['authenticated run passes the auth check', () => auth.stages.smoke?.data?.checks?.some(c => c.check === 'authentication' && c.result === 'PASS')],
  ['authenticated run reaches the private dashboard', () => auth.stages.crawl?.data?.graph?.nodes?.some(n => n.url.includes('dashboard'))],
  ['authenticated run reaches a page only linked from the private area', () => auth.stages.crawl?.data?.graph?.nodes?.some(n => n.url.includes('billing'))],
  ['authenticated run clicks controls inside the private area', () => auth.stages.crawl?.data?.clicks?.some(c => c.name === 'Export report')],
  ['session-ending controls are never clicked while authenticated', () => !auth.stages.crawl?.data?.clicks?.some(c => /log ?out|sign ?out/i.test(c.name || ''))],
  ['authenticated run performs more clicks than the public one', () => (auth.totals.clicks || 0) > (unauth.totals.clicks || 0)]
]

let failed = 0
for (const [name, fn] of checks) {
  let ok = false
  try { ok = !!fn() } catch {}
  console.log(`  ${ok ? '✔' : '✖'} ${name}`)
  if (!ok) failed++
}
console.log(`\n${checks.length - failed}/${checks.length} auth expectations met`)
if (failed) {
  console.log('\ndiagnostics:')
  console.log(`  unauth: verdict ${unauth.verdict?.decision}, aborted ${unauth.aborted}, clicks ${unauth.totals?.clicks}`)
  console.log(`  auth:   verdict ${auth.verdict?.decision}, clicks ${auth.totals?.clicks}, states ${auth.totals?.states}`)
  ;(auth.stages.crawl?.data?.graph?.nodes || []).forEach(n => console.log(`    reached ${n.url}`))
  console.log(`  auth detail: ${JSON.stringify(auth.stages.smoke?.data?.checks?.find(c => c.check === 'authentication') || null)}`)
}
process.exit(failed ? 1 : 0)

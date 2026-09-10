#!/usr/bin/env node
// The demo fixture contains deliberately seeded defects. If a change to the runner stops it
// finding them, this fails — the pipeline is held to the same standard it holds others to.
import fs from 'node:fs'

const file = process.argv[2] || '.qa-out/run.json'
if (!fs.existsSync(file)) { console.error(`✖ no run at ${file}`); process.exit(1) }
const run = JSON.parse(fs.readFileSync(file, 'utf8'))
const s = run.stages

const expectations = [
  ['smoke passes on a healthy fixture', () => s.smoke?.status === 'pass'],
  ['crawl performs at least 15 clicks', () => (run.totals.clicks || 0) >= 15],
  ['crawl discovers all 3 pages', () => (run.totals.states || 0) >= 3],
  ['crawl maps transitions', () => (run.totals.transitions || 0) >= 8],
  ['crawl opens and detects the modal', () => s.crawl?.data?.clicks?.some(c => c.name === 'Open details' && c.outcome === 'in-place-change')],
  ['crawl detects tab switches as state changes', () => s.crawl?.data?.clicks?.some(c => c.name === 'Shipping' && c.outcome === 'in-place-change')],
  ['crawl follows the external link as a new tab', () => s.crawl?.data?.clicks?.some(c => c.outcome === 'new-tab')],
  ['crawl flags dead buttons', () => (s.crawl?.data?.buttons?.dead || 0) >= 2],
  ['crawl judges the throwing button as BROKEN', () => s.crawl?.data?.clicks?.some(c => c.name === 'Trigger console error' && c.verdict === 'broken')],
  ['crawl does not blame a link for the errors of the page it loads', () => !s.crawl?.data?.clicks?.some(c => c.name === 'Home' && ['broken', 'suspect'].includes(c.verdict))],
  ['crawl recognises a same-URL link as a reload, not a dead button', () => s.crawl?.data?.clicks?.some(c => c.name === 'Home' && c.outcome === 'reload')],
  ['crawl counts working controls', () => (s.crawl?.data?.buttons?.works || 0) >= 5],
  ['destructive controls are guarded, not clicked', () => s.crawl?.data?.skipped?.some(x => x.reason === 'destructive-guard' && /delete/i.test(x.element.name))],
  ['click errors stay at zero on the fixture', () => (s.crawl?.data?.errors?.length || 0) === 0],
  ['controls that only exist inside the modal are actually clicked', () => ['Share', 'Compare', 'Close'].every(n => s.crawl?.data?.clicks?.some(c => c.name === n))],
  ['controls revealed by a tab panel are actually clicked', () => s.crawl?.data?.clicks?.some(c => c.name === 'Calculate shipping')],
  ['nothing discovered is left unreachable on the fixture', () => (s.crawl?.data?.skipped || []).every(x => x.reason === 'destructive-guard')],
  ['console stage catches the seeded error', () => (s.console?.data?.consoleErr?.length || 0) + (s.console?.data?.errors?.length || 0) >= 1],
  ['forms stage exercises three modes', () => (s.forms?.data?.results?.length || 0) >= 3],
  ['a11y finds the missing image alt', () => s.a11y?.data?.violations?.some(v => v.id === 'image-alt')],
  ['a11y does not audit our own HUD', () => !s.a11y?.data?.violations?.some(v => (v.sample || '').includes('__qa_hud'))],
  ['perf measures every discovered state', () => (s.perf?.data?.rows?.length || 0) >= 3],
  ['visual stores a baseline per state', () => (s.visual?.data?.rows?.length || 0) >= 3],
  ['security flags the missing CSP', () => s.security?.data?.findings?.some(f => f.check.includes('content-security-policy'))],
  ['verdict is computed', () => ['SHIP', 'NO-SHIP', 'SHIP WITH DEBT'].includes(run.verdict?.decision)]
]

let failed = 0
for (const [name, fn] of expectations) {
  let ok = false
  try { ok = !!fn() } catch {}
  console.log(`  ${ok ? '✔' : '✖'} ${name}`)
  if (!ok) failed++
}
console.log(`\n${expectations.length - failed}/${expectations.length} expectations met`)
if (failed) {
  // Diagnosis in the log itself: a red CI that does not say why is a second failure.
  const c = s.crawl?.data || {}
  console.log('\ndiagnostics:')
  console.log(`  clicks ${c.totalClicks} · states ${run.totals?.states} · transitions ${run.totals?.transitions} · retried ${c.retried ?? 0}`)
  ;(c.errors || []).forEach(x => console.log(`  click error: ${x.element} -> ${x.message}`))
  ;(c.skipped || []).filter(x => x.reason !== 'destructive-guard').forEach(x => console.log(`  skipped: ${x.element?.name} (${x.reason})`))
  Object.entries(s).forEach(([k, v]) => console.log(`  stage ${k}: ${v.status} — ${v.summary}`))
}
process.exit(failed ? 1 : 0)

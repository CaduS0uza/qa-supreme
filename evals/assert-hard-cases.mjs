#!/usr/bin/env node
// The hard fixture contains everything that makes a crawler blind: a consent wall, shadow DOM,
// an iframe, hash routes, a hover-only menu, a covered control, and content that only exists
// after scrolling. Each expectation below is a case that used to be missed.
import fs from 'node:fs'

const file = process.argv[2] || '.qa-hard/run.json'
if (!fs.existsSync(file)) { console.error(`✖ no run at ${file}`); process.exit(1) }
const run = JSON.parse(fs.readFileSync(file, 'utf8'))
const crawl = run.stages?.crawl?.data || {}
const clicks = crawl.clicks || []
const click = (name) => clicks.find(c => c.name === name)
const verdictOf = (name) => click(name)?.verdict

const checks = [
  ['the consent banner does not block the crawl', () => clicks.length >= 12],
  ['controls inside shadow DOM are found and clicked', () => !!click('Inside shadow DOM')],
  ['a shadow control with a handler is judged as working', () => verdictOf('Inside shadow DOM') === 'works'],
  ['a shadow control with no handler is judged dead', () => verdictOf('Shadow action') === 'dead'],
  ['controls inside an iframe are found and clicked', () => !!click('Frame button')],
  ['an effect inside the iframe is seen', () => verdictOf('Frame button') === 'works'],
  ['hash routes are separate destinations, not one page', () => {
    const routes = clicks.filter(c => ['Reports', 'Settings', 'Team'].includes(c.name))
    return routes.length === 3 && new Set(routes.map(c => c.opened)).size === 3
  }],
  ['a hover-only menu item is reached and clicked', () => !!click('Profile')],
  ['a hover menu item with a handler works', () => verdictOf('Profile') === 'works'],
  ['a hover menu item without a handler is dead', () => verdictOf('Billing') === 'dead'],
  ['content that only exists after scrolling is clicked', () => !!click('Lazy button A')],
  ['a lazy control with a handler works', () => verdictOf('Lazy button A') === 'works'],
  ['a covered control is reported as unclickable', () => verdictOf('Covered button') === 'unclickable'],
  ['the report names what is covering it', () => /covered by/.test(click('Covered button')?.covered || '')],
  ['every discovered control was reached (nothing left unreachable)', () =>
    (crawl.skipped || []).every(s => s.reason === 'destructive-guard')]
]

let failed = 0
for (const [name, fn] of checks) {
  let ok = false
  try { ok = !!fn() } catch {}
  console.log(`  ${ok ? '✔' : '✖'} ${name}`)
  if (!ok) failed++
}
console.log(`\n${checks.length - failed}/${checks.length} hard-case expectations met`)
if (failed) {
  console.log('\ndiagnostics:')
  clicks.forEach(c => console.log(`  ${String(c.verdict).padEnd(15)} ${c.name} — ${c.outcome}${c.covered ? ` (${c.covered})` : ''}`))
  ;(crawl.skipped || []).forEach(s => console.log(`  skipped: ${s.element?.name} (${s.reason})`))
}
process.exit(failed ? 1 : 0)

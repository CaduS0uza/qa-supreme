import { t } from './i18n.mjs'

const C = {
  reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
  green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m', magenta: '\x1b[35m'
}
const useColor = process.stdout.isTTY && !process.env.NO_COLOR
const c = (code, s) => (useColor ? code + s + C.reset : s)

let stageIndex = 0
let totalStages = 0
const started = new Map()

export const log = {
  setTotal(n) { totalStages = n },
  banner(title, subtitle) {
    const line = '─'.repeat(Math.max(title.length + 4, 52))
    console.log('\n' + c(C.cyan, line))
    console.log(c(C.bold + C.cyan, `  ${title}`))
    if (subtitle) console.log(c(C.dim, `  ${subtitle}`))
    console.log(c(C.cyan, line))
  },
  stageStart(name, description) {
    stageIndex += 1
    started.set(name, Date.now())
    console.log('\n' + c(C.bold, `▶ STAGE ${stageIndex}/${totalStages} · ${name.toUpperCase()}`) + c(C.dim, `  ${description}`))
  },
  stageEnd(name, status, summary) {
    const ms = Date.now() - (started.get(name) || Date.now())
    const mark = status === 'pass' ? c(C.green, '✔ PASS') : status === 'warn' ? c(C.yellow, '▲ WARN') : c(C.red, '✖ FAIL')
    console.log(`  ${mark} ${c(C.dim, `${name} · ${(ms / 1000).toFixed(1)}s`)} ${summary || ''}`)
  },
  step(msg) { console.log(c(C.dim, '   · ') + msg) },
  info(msg) { console.log('   ' + msg) },
  ok(msg) { console.log('   ' + c(C.green, '✔ ') + msg) },
  warn(msg) { console.log('   ' + c(C.yellow, '▲ ') + msg) },
  fail(msg) { console.log('   ' + c(C.red, '✖ ') + msg) },
  counter(label, n, extra = '') {
    console.log('   ' + c(C.magenta, `[${String(n).padStart(4)}]`) + ` ${label} ${c(C.dim, extra)}`)
  },
  // A readable transcript line per interaction: what was clicked, and what it did.
  click(n, role, name, outcome, opened) {
    const color = { navigation: C.cyan, 'new-tab': C.magenta, 'in-place-change': C.green, reload: C.cyan, 'no-op': C.dim, error: C.red }[outcome]
    const mark = color ? c(color, t(outcome)) : outcome
    const label = String(name).replace(/\s+/g, ' ').slice(0, 42)
    console.log(
      '   ' + c(C.dim, `#${String(n).padStart(3)}`) +
      ' ' + c(C.dim, String(role).padEnd(8).slice(0, 8)) +
      ' ' + c(C.bold, `"${label}"`.padEnd(44)) +
      ' ' + mark + (opened && outcome === 'navigation' ? c(C.dim, `  ${String(opened).slice(-42)}`) : '')
    )
  },
  verdict(kind, name, effect) {
    const style = { broken: [C.red, '✖ BROKEN'], suspect: [C.yellow, '▲ suspect'],
                    dead: [C.dim, '○ dead'], 'works-silently': [C.dim, '· network only'],
                    unclickable: [C.red, '✖ unclickable'] }[kind]
    if (!style) return
    const detail = effect && (effect.threw || effect.server5xx || effect.failed4xx || effect.consoleErrors)
      ? c(C.dim, `  (${[effect.threw && `${effect.threw} exception`, effect.server5xx && `${effect.server5xx} 5xx`,
           effect.failed4xx && `${effect.failed4xx} 4xx`, effect.consoleErrors && `${effect.consoleErrors} console error`]
           .filter(Boolean).join(', ')})`)
      : ''
    console.log('       ' + c(style[0], style[1]) + ' ' + c(C.dim, `"${String(name).slice(0, 40)}"`) + detail)
  },
  guarded(name) {
    console.log('   ' + c(C.yellow, '  ⚠ ') + c(C.dim, t('guarded', String(name).slice(0, 40))))
  },
  live(msg) {
    if (!process.stdout.isTTY) return
    process.stdout.write('\r\x1b[K   ' + c(C.dim, msg))
  },
  liveDone() { if (process.stdout.isTTY) process.stdout.write('\r\x1b[K') },
  table(rows) {
    if (!rows.length) return
    const keys = Object.keys(rows[0])
    const w = keys.map(k => Math.max(k.length, ...rows.map(r => String(r[k] ?? '').length)))
    const line = (cells) => '   ' + cells.map((s, i) => String(s).padEnd(w[i])).join('  ')
    console.log(c(C.dim, line(keys)))
    rows.forEach(r => console.log(line(keys.map(k => r[k] ?? ''))))
  },
  c, C
}

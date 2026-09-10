import { t } from './i18n.mjs'

const C = {
  reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
  green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m', magenta: '\x1b[35m'
}
const useColor = process.stdout.isTTY && !process.env.NO_COLOR
const c = (code, s) => (useColor ? code + s + C.reset : s)

/* Quanto falta, em português de gente: "~7min", "~40s", "menos de 1min". */
function restante(msPorItem, faltam) {
  const ms = msPorItem * faltam
  if (!isFinite(ms) || ms < 0) return '—'
  const seg = Math.round(ms / 1000)
  if (seg < 60) return `~${seg}s`
  const min = Math.round(seg / 60)
  if (min < 60) return `~${min}min`
  const h = Math.floor(min / 60)
  return `~${h}h${String(min % 60).padStart(2, '0')}`
}

let lastQuiet = -1
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
  // A live progress bar for the long stage. Before this, the crawl printed a
  // line per click and nothing else: on a 20-minute run you could not tell
  // whether it was halfway or barely started, and there was no way to decide
  // "let it finish" vs "kill it". The ETA is measured, not guessed — elapsed
  // time per click so far, projected over what is left.
  //
  // Redraws in place on a TTY (\r), and falls back to one line every 10% when
  // the output is a pipe or a log file, so CI does not collect 300 near
  // identical lines.
  progress(done, total, startedAt, note = '') {
    if (!total || done > total) return
    const pct = done >= total ? 100 : Math.min(99, Math.floor((done / total) * 100))
    if (!useColor) {
      // not a TTY: only speak up on each 10% mark, once
      const faixa = Math.floor(pct / 10)
      if (faixa === lastQuiet) return
      lastQuiet = faixa
      console.log(`   ${String(pct).padStart(3)}% · ${done}/${total}${note ? ' · ' + note : ''}`)
      return
    }
    const largura = 24
    const cheio = Math.round((pct / 100) * largura)
    const barra = '█'.repeat(cheio) + '░'.repeat(largura - cheio)
    const decorrido = Date.now() - startedAt
    // Antes do primeiro punhado de cliques a média ainda oscila muito; dizer
    // "faltam 4h" e depois "faltam 3min" é pior que não dizer nada.
    const falta = done >= 5 ? restante(decorrido / done, total - done) : 'calculando…'
    const linha = `   ${c(C.cyan, barra)} ${String(pct).padStart(3)}% · ${done}/${total} · ${falta}${note ? c(C.dim, ' · ' + note) : ''}`
    process.stdout.write('\r\x1b[2K' + linha)
    if (done === total) process.stdout.write('\n')
  },
  counter(label, n, extra = '') {
    console.log('   ' + c(C.magenta, `[${String(n).padStart(4)}]`) + ` ${label} ${c(C.dim, extra)}`)
  },
  // A readable transcript line per interaction: what was clicked, and what it did.
  click(n, role, name, outcome, opened) {
    const color = { navigation: C.cyan, 'new-tab': C.magenta, 'in-place-change': C.green, reload: C.cyan, 'hover-only': C.green, 'no-op': C.dim, error: C.red }[outcome]
    const mark = color ? c(color, t(outcome)) : outcome
    const label = String(name).replace(/\s+/g, ' ').slice(0, 42)
    console.log(
      '   ' + c(C.dim, `#${String(n).padStart(3)}`) +
      ' ' + c(C.dim, String(role).padEnd(8).slice(0, 8)) +
      ' ' + c(C.bold, `"${label}"`.padEnd(44)) +
      ' ' + mark + (opened && outcome === 'navigation' ? c(C.dim, `  ${String(opened).slice(-42)}`) : '')
    )
  },
  verdict(kind, name, effect, covered) {
    const style = { broken: [C.red, '✖ BROKEN'], suspect: [C.yellow, '▲ suspect'],
                    dead: [C.dim, '○ dead'], 'works-silently': [C.dim, '· network only'],
                    unclickable: [C.red, '✖ unclickable'] }[kind]
    if (!style) return
    const detail = effect && (effect.threw || effect.server5xx || effect.failed4xx || effect.consoleErrors)
      ? c(C.dim, `  (${[effect.threw && `${effect.threw} exception`, effect.server5xx && `${effect.server5xx} 5xx`,
           effect.failed4xx && `${effect.failed4xx} 4xx`, effect.consoleErrors && `${effect.consoleErrors} console error`]
           .filter(Boolean).join(', ')})`)
      : ''
    console.log('       ' + c(style[0], style[1]) + ' ' + c(C.dim, `"${String(name).slice(0, 40)}"`) + detail +
      (covered ? c(C.dim, `  ${covered}`) : ''))
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

import { log } from '../logger.mjs'

// Stage 4. Everything the browser complained about while the earlier stages drove the app.
// Cumulative by design: a console error raised during the crawl is reported here.
export async function consoleErrors(session, cfg) {
  const { findings } = session
  const dedupe = (arr, keyFn) => {
    const m = new Map()
    arr.forEach(x => { const k = keyFn(x); m.set(k, { ...x, count: (m.get(k)?.count || 0) + 1 }) })
    return [...m.values()]
  }
  const errors = dedupe(findings.pageErrors, e => e.message)
  const consoleErr = dedupe(findings.console.filter(c => c.type === 'error'), c => c.text)
  const consoleWarn = dedupe(findings.console.filter(c => c.type === 'warning'), c => c.text)
  const net = dedupe(findings.network, n => `${n.status} ${n.url}`)
  const s5 = net.filter(n => n.status >= 500)
  const s4 = net.filter(n => n.status >= 400 && n.status < 500)

  log.counter('uncaught JS exceptions', errors.length)
  log.counter('console errors', consoleErr.length)
  log.counter('console warnings', consoleWarn.length)
  log.counter('failed requests 5xx', s5.length)
  log.counter('failed requests 4xx', s4.length)
  log.counter('native dialogs triggered', findings.dialogs.length)

  errors.slice(0, 5).forEach(e => log.fail(`${e.message.slice(0, 120)} (${e.url})`))
  s5.slice(0, 5).forEach(n => log.fail(`${n.status} ${n.url}`))

  const blocking = errors.length + s5.length
  return {
    status: blocking ? 'fail' : (consoleErr.length || s4.length) ? 'warn' : 'pass',
    summary: `${errors.length} exceptions · ${s5.length} 5xx · ${s4.length} 4xx · ${consoleErr.length} console errors`,
    data: { errors, consoleErr, consoleWarn, network: net, dialogs: findings.dialogs }
  }
}

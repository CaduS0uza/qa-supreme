import path from 'node:path'
import { log } from '../logger.mjs'

// Stage 1. The build is either alive or it is not. Everything downstream depends on this.
export async function smoke(session, cfg) {
  const { page } = session
  const checks = []
  const t0 = Date.now()
  let resp = null
  try {
    resp = await page.goto(cfg.url, { waitUntil: 'domcontentloaded', timeout: cfg.timeoutMs })
  } catch (e) {
    checks.push({ check: 'reachable', result: 'FAIL', detail: e.message.split('\n')[0] })
    log.fail(`target unreachable: ${cfg.url}`)
    return { status: 'fail', summary: 'target unreachable', data: { checks }, blocking: true }
  }
  const loadMs = Date.now() - t0
  const status = resp ? resp.status() : 200

  checks.push({ check: 'reachable', result: status < 400 ? 'PASS' : 'FAIL', detail: `HTTP ${status} in ${loadMs}ms` })

  const title = await page.title().catch(() => '')
  checks.push({ check: 'has title', result: title ? 'PASS' : 'FAIL', detail: title || '(empty)' })

  const bodyText = (await page.locator('body').innerText().catch(() => '')).trim()
  checks.push({ check: 'renders content', result: bodyText.length > 30 ? 'PASS' : 'FAIL', detail: `${bodyText.length} chars of visible text` })

  const interactive = await page.evaluate(() =>
    document.querySelectorAll('a[href],button,[role=button],input,select,textarea').length)
  checks.push({ check: 'has interactive surface', result: interactive > 0 ? 'PASS' : 'FAIL', detail: `${interactive} controls` })

  const jsErrors = session.findings.pageErrors.length
  checks.push({ check: 'no uncaught JS errors on load', result: jsErrors === 0 ? 'PASS' : 'FAIL', detail: `${jsErrors} error(s)` })

  const badReq = session.findings.network.filter(n => n.status >= 500).length
  checks.push({ check: 'no 5xx on load', result: badReq === 0 ? 'PASS' : 'FAIL', detail: `${badReq} response(s)` })

  await page.screenshot({ path: path.join(cfg.outDir, 'screenshots', 'smoke.png'), fullPage: true }).catch(() => {})
  log.table(checks)

  const failed = checks.filter(c => c.result === 'FAIL')
  const blocking = failed.some(f => ['reachable', 'renders content'].includes(f.check))
  return {
    status: failed.length ? (blocking ? 'fail' : 'warn') : 'pass',
    summary: `${checks.length - failed.length}/${checks.length} checks green · ${loadMs}ms`,
    data: { checks, loadMs, httpStatus: status, title },
    blocking
  }
}

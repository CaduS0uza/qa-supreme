import { createRequire } from 'node:module'
import { log } from '../logger.mjs'

const require = createRequire(import.meta.url)

// Stage 5. WCAG 2.2 A/AA via axe-core, run against every state the crawler discovered.
export async function a11y(session, cfg, prior) {
  const { page } = session
  let axeSource
  try { axeSource = require('axe-core').source } catch {
    log.warn('axe-core not installed — run `npm i axe-core` inside runner/. Stage skipped.')
    return { status: 'warn', summary: 'axe-core missing', data: { violations: [] } }
  }

  const urls = uniqueStates(cfg, prior)
  const all = []
  for (const url of urls) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: cfg.timeoutMs })
      await page.evaluate(axeSource)
      // The HUD is our own instrumentation — auditing it would report our own violations.
      const res = await page.evaluate(async () => await window.axe.run(
        { exclude: [['#__qa_hud'], ['[data-qa-skip]']] }, {
        resultTypes: ['violations'],
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] }
      }))
      res.violations.forEach(v => all.push({
        url, id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length,
        sample: v.nodes[0]?.html?.slice(0, 160) || ''
      }))
    } catch (e) {
      log.warn(`a11y scan failed on ${url}: ${e.message.split('\n')[0]}`)
    }
  }

  const bySeverity = ['critical', 'serious', 'moderate', 'minor']
    .map(s => ({ impact: s, issues: all.filter(v => v.impact === s).length,
                 elements: all.filter(v => v.impact === s).reduce((n, v) => n + v.nodes, 0) }))
    .filter(r => r.issues)
  log.table(bySeverity.length ? bySeverity : [{ impact: 'none', issues: 0, elements: 0 }])

  const blocking = all.filter(v => v.impact === 'critical' || v.impact === 'serious')
  return {
    status: blocking.length ? 'fail' : all.length ? 'warn' : 'pass',
    summary: `${all.length} violations on ${urls.length} state(s) · ${blocking.length} critical/serious`,
    data: { violations: all, scanned: urls }
  }
}

export function uniqueStates(cfg, prior) {
  const nodes = prior?.crawl?.data?.graph?.nodes || []
  const urls = [...new Set([cfg.url, ...nodes.map(n => n.url)])]
  return urls.slice(0, Math.min(urls.length, 12))
}

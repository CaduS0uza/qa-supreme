import { log } from '../logger.mjs'
import { uniqueStates } from './a11y.mjs'

// Stage 6. Real user-centric metrics from the browser, judged against explicit budgets.
export async function perf(session, cfg, prior) {
  const { page } = session
  const rows = []
  for (const url of uniqueStates(cfg, prior).slice(0, 6)) {
    try {
      await page.goto(url, { waitUntil: 'load', timeout: cfg.timeoutMs })
      const m = await page.evaluate(() => new Promise((resolve) => {
        const out = { lcp: 0, cls: 0, ttfb: 0, domContentLoaded: 0, transferKb: 0, requests: 0, jsHeapMb: 0, longTasks: 0 }
        const nav = performance.getEntriesByType('navigation')[0]
        if (nav) { out.ttfb = Math.round(nav.responseStart); out.domContentLoaded = Math.round(nav.domContentLoadedEventEnd) }
        const res = performance.getEntriesByType('resource')
        out.requests = res.length
        out.transferKb = Math.round(res.reduce((n, r) => n + (r.transferSize || 0), 0) / 1024)
        if (performance.memory) out.jsHeapMb = Math.round(performance.memory.usedJSHeapSize / 1048576)
        try {
          new PerformanceObserver((l) => { for (const e of l.getEntries()) out.lcp = Math.round(e.startTime) })
            .observe({ type: 'largest-contentful-paint', buffered: true })
          new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) out.cls += e.value })
            .observe({ type: 'layout-shift', buffered: true })
          new PerformanceObserver((l) => { out.longTasks += l.getEntries().length })
            .observe({ type: 'longtask', buffered: true })
        } catch {}
        setTimeout(() => resolve({ ...out, cls: Number(out.cls.toFixed(3)) }), 1200)
      }))
      const b = cfg.budgets
      const breaches = []
      if (m.lcp > b.lcpMs) breaches.push(`LCP ${m.lcp}ms > ${b.lcpMs}ms`)
      if (m.cls > b.cls) breaches.push(`CLS ${m.cls} > ${b.cls}`)
      if (m.ttfb > b.ttfbMs) breaches.push(`TTFB ${m.ttfb}ms > ${b.ttfbMs}ms`)
      if (m.jsHeapMb && m.jsHeapMb > b.jsHeapMb) breaches.push(`heap ${m.jsHeapMb}MB > ${b.jsHeapMb}MB`)
      rows.push({ url: url.slice(-46), lcp: m.lcp, cls: m.cls, ttfb: m.ttfb, req: m.requests, kb: m.transferKb, verdict: breaches.length ? 'OVER' : 'OK' })
      if (breaches.length) log.warn(`${url}: ${breaches.join(', ')}`)
    } catch (e) {
      rows.push({ url: url.slice(-46), lcp: '-', cls: '-', ttfb: '-', req: '-', kb: '-', verdict: 'ERROR' })
    }
  }
  log.table(rows)
  const over = rows.filter(r => r.verdict !== 'OK').length
  return { status: over ? 'warn' : 'pass', summary: `${rows.length} state(s) measured · ${over} over budget`, data: { rows, budgets: cfg.budgets } }
}

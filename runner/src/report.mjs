import fs from 'node:fs'
import path from 'node:path'

// Self-contained HTML evidence report: no CDN, no build step, opens anywhere.
export function writeReport(run, cfg) {
  const out = path.join(cfg.outDir, 'report.html')
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
  const badge = (s) => `<span class="b ${s}">${s.toUpperCase()}</span>`
  const S = run.stages

  const stageCard = (name, r) => `
    <section class="card">
      <h3>${esc(name)} ${badge(r.status)}</h3>
      <p class="muted">${esc(r.summary)}</p>
      ${renderDetail(name, r, esc)}
    </section>`

  const clicksRows = (S.crawl?.data?.clicks || []).map(c => `
    <tr><td>${c.n}</td><td>${esc(c.node)}</td><td>${esc(c.role)}</td><td>${esc(c.name)}</td>
    <td class="o-${esc(c.outcome).replace(/[^a-z-]/g, '')}">${esc(c.outcome)}</td><td class="muted">${esc(c.opened || '')}</td></tr>`).join('')

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>QA Supreme — ${esc(run.url)}</title><style>
:root{--bg:#0b1020;--card:#141c33;--ink:#e8f0ff;--muted:#93a3c4;--line:#26314f;--ok:#4ade80;--warn:#fbbf24;--fail:#f87171}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.6 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
header{padding:28px 24px;border-bottom:1px solid var(--line);background:linear-gradient(180deg,#111a35,#0b1020)}
h1{margin:0 0 4px;font-size:22px;letter-spacing:.02em}h3{margin:0 0 6px;font-size:15px;text-transform:capitalize}
.wrap{max-width:1120px;margin:0 auto;padding:24px}
.verdict{display:inline-block;padding:6px 14px;border-radius:999px;font-weight:700;letter-spacing:.06em}
.SHIP{background:rgba(74,222,128,.15);color:var(--ok);border:1px solid var(--ok)}
.NO-SHIP{background:rgba(248,113,113,.15);color:var(--fail);border:1px solid var(--fail)}
.DEBT{background:rgba(251,191,36,.15);color:var(--warn);border:1px solid var(--warn)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:18px 0}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px}
.kpi b{display:block;font-size:26px;line-height:1.2}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px;margin:12px 0}
.b{font-size:10px;padding:2px 8px;border-radius:999px;vertical-align:middle;letter-spacing:.08em}
.b.pass{background:rgba(74,222,128,.15);color:var(--ok)}.b.warn{background:rgba(251,191,36,.15);color:var(--warn)}.b.fail{background:rgba(248,113,113,.15);color:var(--fail)}
.muted{color:var(--muted)}table{width:100%;border-collapse:collapse;font-size:12.5px;margin-top:8px;display:block;overflow-x:auto}
th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line);white-space:nowrap;max-width:340px;overflow:hidden;text-overflow:ellipsis}
th{color:var(--muted);font-weight:600;position:sticky;top:0;background:var(--card)}
.o-navigation{color:#7dd3fc}.o-new-tab{color:#c4b5fd}.o-in-place-change{color:#4ade80}.o-no-op{color:var(--muted)}.o-error{color:var(--fail)}
.scroll{max-height:420px;overflow:auto;border:1px solid var(--line);border-radius:8px}
img{max-width:100%;border-radius:8px;border:1px solid var(--line)}
</style></head><body>
<header><div class="wrap" style="padding:0">
<h1>QA Supreme</h1>
<p class="muted">${esc(run.url)} · ${new Date(run.startedAt).toLocaleString()} · ${(run.durationMs / 1000).toFixed(1)}s</p>
<p><span class="verdict ${run.verdict.decision === 'SHIP' ? 'SHIP' : run.verdict.decision === 'NO-SHIP' ? 'NO-SHIP' : 'DEBT'}">${esc(run.verdict.decision)}</span>
<span class="muted"> — ${esc(run.verdict.reason)}</span></p>
</div></header>
<div class="wrap">
<div class="grid">
  <div class="kpi"><b>${run.totals.clicks}</b><span class="muted">clicks performed</span></div>
  <div class="kpi"><b>${run.totals.states}</b><span class="muted">states discovered</span></div>
  <div class="kpi"><b>${run.totals.transitions}</b><span class="muted">transitions mapped</span></div>
  <div class="kpi"><b>${run.totals.guardedSkips}</b><span class="muted">guarded skips</span></div>
  <div class="kpi"><b>${Object.values(run.stages).filter(s => s.status === 'pass').length}/${Object.keys(run.stages).length}</b><span class="muted">stages green</span></div>
</div>
${Object.entries(run.stages).map(([n, r]) => stageCard(n, r)).join('')}
<section class="card"><h3>Click ledger — every interaction, in order</h3>
<div class="scroll"><table><thead><tr><th>#</th><th>state</th><th>role</th><th>label</th><th>outcome</th><th>led to</th></tr></thead>
<tbody>${clicksRows || '<tr><td colspan="6" class="muted">no crawl data</td></tr>'}</tbody></table></div></section>
</div></body></html>`

  fs.writeFileSync(out, html)
  return out
}

function renderDetail(name, r, esc) {
  const t = (headers, rows) => rows.length
    ? `<div class="scroll"><table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`
    : '<p class="muted">nothing to report</p>'
  const d = r.data || {}
  switch (name) {
    case 'smoke': return t(['check', 'result', 'detail'], (d.checks || []).map(c => `<tr><td>${esc(c.check)}</td><td>${esc(c.result)}</td><td class="muted">${esc(c.detail)}</td></tr>`))
    case 'crawl': return t(['state', 'url', 'interactive', 'depth'], (d.graph?.nodes || []).map(n => `<tr><td>${esc(n.id)}</td><td>${esc(n.url)}</td><td>${n.interactive}</td><td>${n.depth}</td></tr>`))
    case 'forms': return t(['form', 'mode', 'verdict', 'detail'], (d.results || []).map(x => `<tr><td>${esc(x.form)}</td><td>${esc(x.mode)}</td><td>${esc(x.verdict)}</td><td class="muted">${esc(x.detail)}</td></tr>`))
    case 'console': return t(['kind', 'detail', 'count'], [
      ...(d.errors || []).map(e => `<tr><td>exception</td><td>${esc(e.message)}</td><td>${e.count}</td></tr>`),
      ...(d.consoleErr || []).map(e => `<tr><td>console.error</td><td>${esc(e.text)}</td><td>${e.count}</td></tr>`),
      ...(d.network || []).map(n => `<tr><td>HTTP ${n.status}</td><td>${esc(n.url)}</td><td>${n.count}</td></tr>`)])
    case 'a11y': return t(['impact', 'rule', 'elements', 'where'], (d.violations || []).map(v => `<tr><td>${esc(v.impact)}</td><td>${esc(v.help)}</td><td>${v.nodes}</td><td class="muted">${esc(v.url)}</td></tr>`))
    case 'perf': return t(['url', 'LCP', 'CLS', 'TTFB', 'req', 'KB', 'verdict'], (d.rows || []).map(x => `<tr><td class="muted">${esc(x.url)}</td><td>${x.lcp}</td><td>${x.cls}</td><td>${x.ttfb}</td><td>${x.req}</td><td>${x.kb}</td><td>${esc(x.verdict)}</td></tr>`))
    case 'visual': return t(['state', 'result', 'detail'], (d.rows || []).map(x => `<tr><td>${esc(x.state)}</td><td>${esc(x.result)}</td><td class="muted">${esc(x.detail)}</td></tr>`))
    case 'security': return t(['severity', 'check', 'detail'], (d.findings || []).map(f => `<tr><td>${esc(f.severity)}</td><td>${esc(f.check)}</td><td class="muted">${esc(f.detail)}</td></tr>`))
    default: return ''
  }
}

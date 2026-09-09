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
      <h3 class="stage">${esc(name)} ${badge(r.status)}</h3>
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
h1{margin:0 0 4px;font-size:22px;letter-spacing:.02em}h3{margin:0 0 6px;font-size:15px}h3.stage{text-transform:capitalize}
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
.graphwrap{overflow-x:auto;padding:6px 0}
.node rect{fill:#1b2643;stroke:#3a4a75;stroke-width:1.5;cursor:pointer;transition:fill .15s,stroke .15s}
.node:hover rect,.node:focus rect{fill:#24325a;stroke:#7dd3fc;outline:none}
.node rect.ext{fill:#171d30;stroke-dasharray:4 3}
.nt{fill:#e8f0ff;font:600 12px ui-monospace,Menlo,monospace;pointer-events:none}
.ns{fill:#93a3c4;font:11px ui-sans-serif,system-ui;pointer-events:none}
.edge{stroke-width:1.6;opacity:.75}.edge:hover{opacity:1;stroke-width:2.6}
.edge.back{opacity:.45;stroke-dasharray:5 4}.edge.back:hover{opacity:1}
.legend{display:flex;gap:16px;align-items:center;flex-wrap:wrap;font-size:12px;color:var(--muted);padding:8px 2px}
.legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px;vertical-align:middle}
#shot{margin-top:10px}#shot img{max-height:460px;display:block}
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
<section class="card"><h3>State graph — what the crawler reached, and how</h3>
${renderGraph(run, esc)}</section>
${Object.entries(run.stages).map(([n, r]) => stageCard(n, r)).join('')}
<section class="card"><h3>Click ledger — every interaction, in order</h3>
<div class="scroll"><table><thead><tr><th>#</th><th>state</th><th>role</th><th>label</th><th>outcome</th><th>led to</th></tr></thead>
<tbody>${clicksRows || '<tr><td colspan="6" class="muted">no crawl data</td></tr>'}</tbody></table></div></section>
</div>
<script>
// Click a state to see exactly what the crawler saw there.
document.querySelectorAll('.node').forEach(g => {
  const show = () => {
    const box = document.getElementById('shot')
    const img = document.getElementById('shotimg')
    img.src = g.dataset.shot
    img.onerror = () => { box.hidden = true }
    document.getElementById('shoturl').textContent = g.dataset.url
    box.hidden = false
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }
  g.addEventListener('click', show)
  g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show() } })
})
</script>
</body></html>`

  fs.writeFileSync(out, html)
  return out
}


// The state graph as inline SVG: nodes by crawl depth, edges labelled with the control that
// caused the transition. No library, no CDN — the report must open from a file:// URL forever.
function renderGraph(run, esc) {
  const nodes = run.stages?.crawl?.data?.graph?.nodes || []
  const edges = run.stages?.crawl?.data?.graph?.edges || []
  if (!nodes.length) return '<p class="muted">no crawl data</p>'

  const byUrl = new Map(nodes.map(n => [n.url, n]))
  const byDepth = new Map()
  nodes.forEach(n => { if (!byDepth.has(n.depth)) byDepth.set(n.depth, []); byDepth.get(n.depth).push(n) })

  const COL = 262, ROW = 96, PADX = 90, PADY = 56, W = 196, H = 52
  const pos = new Map()
  ;[...byDepth.keys()].sort((a, b) => a - b).forEach(d => {
    byDepth.get(d).forEach((n, i) => pos.set(n.id, { x: PADX + d * COL, y: PADY + i * ROW, n }))
  })

  // Off-graph destinations (external tabs, states never queued) get one terminal node each.
  const extras = new Map()
  edges.forEach(e => {
    if (e.kind === 'in-place-change') return
    if (byUrl.has(e.to)) return
    if (!extras.has(e.to)) extras.set(e.to, `x${extras.size + 1}`)
  })
  const maxDepth = Math.max(...nodes.map(n => n.depth), 0)
  ;[...extras.entries()].forEach(([url, id], i) => {
    pos.set(id, { x: PADX + (maxDepth + 1) * COL, y: PADY + i * ROW, n: { id, url, title: 'external', depth: maxDepth + 1, external: true } })
  })

  const height = Math.max(...[...pos.values()].map(p => p.y), 0) + H + PADY + 40
  const width = Math.max(...[...pos.values()].map(p => p.x), 0) + W + PADX
  const top = -36   // headroom for the self-loop arcs over the first row

  const KIND = { navigation: '#7dd3fc', 'new-tab': '#c4b5fd', 'in-place-change': '#4ade80' }
  const seen = new Set()
  const paths = edges.map(e => {
    const from = pos.get(e.from)
    const toId = e.kind === 'in-place-change' ? e.from : (byUrl.get(e.to)?.id ?? extras.get(e.to))
    const to = pos.get(toId)
    if (!from || !to) return ''
    const key = `${e.from}->${toId}->${e.kind}`
    if (seen.has(key)) return ''
    seen.add(key)
    const color = KIND[e.kind] || '#93a3c4'
    if (toId === e.from) {
      // Self-loop: a control that changes the state in place.
      const cx = from.x + W / 2, top = from.y
      return `<path class="edge" d="M${cx - 26} ${top} C${cx - 22} ${top - 30}, ${cx + 22} ${top - 30}, ${cx + 18} ${top - 2}" stroke="${color}" fill="none" marker-end="url(#a)"><title>${esc(e.via)} — in-place change</title></path>`
    }
    // Forward edges run left to right between the box sides. Back edges (a "home" link, a
    // breadcrumb) would cut straight through the boxes, so they loop under the row instead.
    const backwards = to.x <= from.x
    if (backwards) {
      const x1 = from.x + 20, y1 = from.y + H, x2 = to.x + W - 20, y2 = to.y + H
      const dip = Math.max(y1, y2) + 46
      return `<path class="edge back" d="M${x1} ${y1} C${x1} ${dip}, ${x2} ${dip}, ${x2} ${y2 + 6}" stroke="${color}" fill="none" marker-end="url(#a)"><title>${esc(e.via)} — ${esc(e.kind)} (back)</title></path>`
    }
    const x1 = from.x + W, y1 = from.y + H / 2, x2 = to.x, y2 = to.y + H / 2
    const mid = (x1 + x2) / 2
    return `<path class="edge" d="M${x1} ${y1} C${mid} ${y1}, ${mid} ${y2}, ${x2 - 8} ${y2}" stroke="${color}" fill="none" marker-end="url(#a)"><title>${esc(e.via)} — ${esc(e.kind)}</title></path>`
  }).join('')

  const boxes = [...pos.values()].map(({ x, y, n }) => {
    const raw = n.external ? 'external' : (n.title || n.url)
    // 196px box, 12px monospace: ~19 characters fit after the id prefix.
    const label = raw.length > 19 ? raw.slice(0, 18) + '…' : raw
    const host = n.external ? (() => { try { return new URL(n.url).host } catch { return n.url.slice(0, 26) } })() : null
    const sub = n.external ? host : `${n.interactive ?? 0} controls · depth ${n.depth}`
    return `<g class="node" data-shot="screenshots/${esc(n.id)}.png" data-url="${esc(n.url)}" tabindex="0">
      <rect x="${x}" y="${y}" width="${W}" height="${H}" rx="9" class="${n.external ? 'ext' : ''}"/>
      <text x="${x + 12}" y="${y + 21}" class="nt">${esc(n.id)} · ${esc(label)}</text>
      <text x="${x + 12}" y="${y + 38}" class="ns">${esc(sub)}</text>
      <title>${esc(n.url)}</title></g>`
  }).join('')

  return `<div class="graphwrap">
    <svg viewBox="0 ${top} ${width} ${height - top}" width="100%" style="min-width:${Math.min(width, 900)}px">
      <defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0 0 L10 5 L0 10 z" fill="#93a3c4"/></marker></defs>
      ${paths}${boxes}
    </svg>
    <div class="legend">
      <span><i style="background:#7dd3fc"></i>navigation</span>
      <span><i style="background:#c4b5fd"></i>new tab</span>
      <span><i style="background:#4ade80"></i>in-place change</span>
      <span class="muted">click a state to see its screenshot</span>
    </div>
    <div id="shot" hidden><img id="shotimg" alt="state screenshot"><div class="muted" id="shoturl"></div></div>
  </div>`
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

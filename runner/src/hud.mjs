// On-screen HUD: every click the crawler performs is counted and shown live in the page,
// so a human watching (headed mode) or a screenshot/video (headless) always carries the proof.
export const HUD_INIT = `(() => {
  if (window.__qaHudInstalled) return
  window.__qaHudInstalled = true
  window.__qaState = { clicks: 0, page: '', target: '', queue: 0, errors: 0, depth: 0, stage: '', trail: [] }

  const mount = () => {
    if (!document.body || document.getElementById('__qa_hud')) return
    const el = document.createElement('div')
    el.id = '__qa_hud'
    el.setAttribute('data-qa-skip', '')
    el.style.cssText = [
      'position:fixed','z-index:2147483647','top:12px','right:12px',
      window.__qaBig ? 'width:340px' : 'width:270px',
      'font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace','color:#e8f0ff',
      'background:rgba(8,14,32,.93)','border:1px solid rgba(120,170,255,.35)','border-radius:10px',
      'padding:10px 12px','box-shadow:0 8px 28px rgba(0,0,0,.45)','pointer-events:none',
      'backdrop-filter:blur(2px)'
    ].join(';')
    el.innerHTML = \`
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
        <span style="width:8px;height:8px;border-radius:50%;background:#4ade80;display:inline-block"></span>
        <b style="letter-spacing:.06em">QA SUPREME</b>
        <span id="__qa_stage" style="margin-left:auto;opacity:.7"></span>
      </div>
      <div style="font-size:28px;font-weight:700;line-height:1.1"><span id="__qa_clicks">0</span>
        <span style="font-size:11px;font-weight:400;opacity:.65">clicks</span></div>
      <div style="margin-top:6px;opacity:.8">queue <b id="__qa_queue">0</b> · depth <b id="__qa_depth">0</b> · errors <b id="__qa_err" style="color:#f87171">0</b></div>
      <div style="margin-top:6px;opacity:.65;word-break:break-all" id="__qa_target"></div>
      <div id="__qa_trail" style="margin-top:8px;border-top:1px dashed rgba(120,170,255,.25);padding-top:7px;font-size:11px;opacity:.55;line-height:1.5"></div>\`
    document.body.appendChild(el)
  }

  window.__qaHud = (patch) => {
    Object.assign(window.__qaState, patch || {})
    mount()
    const s = window.__qaState
    const set = (id, v) => { const n = document.getElementById(id); if (n) n.textContent = v }
    set('__qa_clicks', s.clicks); set('__qa_queue', s.queue); set('__qa_depth', s.depth)
    set('__qa_err', s.errors); set('__qa_stage', s.stage); set('__qa_target', s.target)
    const trail = document.getElementById('__qa_trail')
    if (trail) trail.innerHTML = (s.trail || []).slice(-4).reverse()
      .map(t => '<div>' + t.replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch])) + '</div>').join('')
    return s
  }

  // Flash the element about to be clicked, so video/screenshots show what was hit.
  window.__qaFlash = (el) => {
    if (!el || !el.getBoundingClientRect) return
    const r = el.getBoundingClientRect()
    const box = document.createElement('div')
    box.setAttribute('data-qa-skip', '')
    box.style.cssText = [
      'position:fixed','z-index:2147483646','pointer-events:none','border:2px solid #4ade80',
      'border-radius:4px','box-shadow:0 0 0 3px rgba(74,222,128,.25)',
      \`left:\${r.left - 2}px\`, \`top:\${r.top - 2}px\`, \`width:\${r.width + 4}px\`, \`height:\${r.height + 4}px\`
    ].join(';')
    document.body.appendChild(box)
    setTimeout(() => box.remove(), 420)
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount)
  else mount()
})()`

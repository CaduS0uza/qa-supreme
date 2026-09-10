// Interactive-element discovery. Runs in the page, returns a stable descriptor per element
// so the crawler can address it later even after a re-render.
export const DISCOVER = `((scopeSel) => {
  const SEL = [
    'a[href]', 'button', 'input[type=submit]', 'input[type=button]', 'summary',
    '[role=button]', '[role=link]', '[role=tab]', '[role=menuitem]', '[role=option]',
    '[role=switch]', '[role=checkbox]', '[role=radio]', '[onclick]', '[data-testid]',
    'select', 'label[for]', '[tabindex]:not([tabindex="-1"])'
  ].join(',')

  const visible = (el) => {
    const r = el.getBoundingClientRect()
    if (r.width < 2 || r.height < 2) return false
    const st = getComputedStyle(el)
    if (st.visibility === 'hidden' || st.display === 'none' || Number(st.opacity) === 0) return false
    if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') return false
    if (el.closest('[data-qa-skip]')) return false
    return true
  }

  const accName = (el) => (
    el.getAttribute('aria-label') ||
    (el.getAttribute('aria-labelledby') && document.getElementById(el.getAttribute('aria-labelledby'))?.innerText) ||
    el.innerText || el.value || el.getAttribute('title') || el.getAttribute('alt') ||
    el.getAttribute('placeholder') || el.getAttribute('name') || ''
  ).trim().replace(/\\s+/g, ' ').slice(0, 80)

  const localPath = (el, stopAt) => {
    const parts = []
    let n = el
    while (n && n.nodeType === 1 && n !== stopAt && parts.length < 6) {
      let s = n.tagName.toLowerCase()
      if (n.id) { parts.unshift(s + '#' + CSS.escape(n.id)); break }
      const sib = n.parentNode ? [...n.parentNode.children].filter(x => x.tagName === n.tagName) : []
      if (sib.length > 1) s += ':nth-of-type(' + (sib.indexOf(n) + 1) + ')'
      parts.unshift(s)
      n = n.parentElement || (n.parentNode && n.parentNode.host) || null
    }
    return parts.join(' > ')
  }

  // A stable anchor beats a position: a path built from nth-of-type points at the wrong row
  // as soon as a list re-orders, and clicking the wrong row is worse than not clicking.
  const cssPath = (el) => {
    const root = el.getRootNode()
    const inShadow = root instanceof ShadowRoot
    const stable = el.getAttribute('data-testid') ? '[data-testid="' + CSS.escape(el.getAttribute('data-testid')) + '"]'
      : el.id ? '#' + CSS.escape(el.id)
      : null
    const inner = stable || localPath(el, inShadow ? root : null)
    if (!inShadow) return inner
    // Playwright chains selectors with '>>' and pierces open shadow roots on the second hop.
    return localPath(root.host, null) + ' >> ' + inner
  }

  // querySelectorAll stops at every shadow boundary, so a design system built on web
  // components is invisible to it. Walk open shadow roots explicitly.
  const collect = (root, acc) => {
    root.querySelectorAll('*').forEach((el) => {
      if (el.matches(SEL)) acc.push(el)
      if (el.shadowRoot) collect(el.shadowRoot, acc)
    })
    return acc
  }

  const scope = scopeSel ? document.querySelector(scopeSel) : document
  if (!scope) return []

  const out = []
  const seen = new Set()
  collect(scope === document ? document : scope, []).forEach((el) => {
    if (!visible(el)) return
    const role = el.getAttribute('role') || el.tagName.toLowerCase()
    const name = accName(el)
    const href = el.getAttribute('href') || null
    const testid = el.getAttribute('data-testid') || null
    const key = role + '|' + name + '|' + (href || '') + '|' + (testid || '')
    if (seen.has(key)) return
    seen.add(key)
    out.push({
      role, name, href, testid,
      inShadow: el.getRootNode() instanceof ShadowRoot,
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute('type') || null,
      selector: cssPath(el),
      opensNewTab: el.getAttribute('target') === '_blank',
      key
    })
  })
  return out
})()`

// A cheap fingerprint of the current UI state: url + the shape of the interactive surface.
export const STATE_HASH = `(() => {
  const bits = []
  const deep = (root, acc) => {
    root.querySelectorAll('*').forEach((el) => { acc.push(el); if (el.shadowRoot) deep(el.shadowRoot, acc) })
    return acc
  }
  // State is more than text: an opened dialog, a selected tab, an expanded accordion and a
  // toggled panel all change what the user can do next, and all must change this hash.
  const SEL_STATE = 'a[href],button,[role=button],[role=tab],[role=tabpanel],input,select,textarea,h1,h2,[role=dialog],dialog,details,[aria-expanded],[aria-selected],[aria-checked],[hidden],[open]'
  deep(document, []).filter(el => el.matches(SEL_STATE))
    .forEach((el) => {
      if (el.closest('[data-qa-skip]')) return
      bits.push([
        el.tagName,
        el.getAttribute('role') || '',
        el.hasAttribute('open') ? 'open' : '',
        el.hasAttribute('hidden') ? 'hidden' : '',
        el.getAttribute('aria-expanded') || '',
        el.getAttribute('aria-selected') || '',
        el.getAttribute('aria-checked') || '',
        el.matches('dialog[open]') ? 'modal' : '',
        (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().slice(0, 40)
      ].join(':'))
    })
  // Visible text belongs to the state as well: a control whose whole job is to write a word
  // on the screen changes nothing in the control set, and would read as dead. Bucketed by 4
  // characters so a ticking clock does not register as a change.
  let textLen = 0
  try {
    // Exclude our own overlay: its counter changes on every click, which would make every
    // click look like it changed the screen.
    const own = [...document.body.children].filter(el => !el.hasAttribute('data-qa-skip'))
    textLen = Math.round(own.map(el => el.innerText || '').join(' ').replace(/\s+/g, ' ').length / 2)
    deep(document, []).forEach((el) => { if (el.shadowRoot) textLen += Math.round((el.shadowRoot.textContent || '').length / 2) })
  } catch {}
  const s = location.pathname + location.search + location.hash + '|' + textLen + '|' + bits.join('~')
  let h = 0
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0 }
  return String(h)
})()`

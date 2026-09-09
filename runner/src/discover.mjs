// Interactive-element discovery. Runs in the page, returns a stable descriptor per element
// so the crawler can address it later even after a re-render.
export const DISCOVER = `(() => {
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

  const cssPath = (el) => {
    const parts = []
    let n = el
    while (n && n.nodeType === 1 && parts.length < 6) {
      let s = n.tagName.toLowerCase()
      if (n.id) { parts.unshift(s + '#' + CSS.escape(n.id)); break }
      const sib = n.parentNode ? [...n.parentNode.children].filter(x => x.tagName === n.tagName) : []
      if (sib.length > 1) s += ':nth-of-type(' + (sib.indexOf(n) + 1) + ')'
      parts.unshift(s)
      n = n.parentElement
    }
    return parts.join(' > ')
  }

  const out = []
  const seen = new Set()
  document.querySelectorAll(SEL).forEach((el) => {
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
  // State is more than text: an opened dialog, a selected tab, an expanded accordion and a
  // toggled panel all change what the user can do next, and all must change this hash.
  document.querySelectorAll('a[href],button,[role=button],[role=tab],[role=tabpanel],input,select,textarea,h1,h2,[role=dialog],dialog,details,[aria-expanded],[aria-selected],[aria-checked],[hidden],[open]')
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
  const s = location.pathname + location.search + '|' + bits.join('~')
  let h = 0
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0 }
  return String(h)
})()`

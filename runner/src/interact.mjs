import { log } from './logger.mjs'

// Everything the crawler must do to a page *before* it can honestly say "these are the
// controls": get past the consent wall, load what only exists after scrolling, wait for
// whatever is still arriving, and reveal what only appears on hover.

const CONSENT_ACCEPT = [
  'accept all', 'accept cookies', 'accept', 'agree', 'i agree', 'got it', 'ok', 'allow all',
  'aceitar todos', 'aceitar tudo', 'aceitar', 'concordo', 'entendi', 'permitir'
]
const BUSY = '[aria-busy="true"], [role="progressbar"], .spinner, .loading, .skeleton, [data-loading="true"]'

/**
 * A consent banner covers the page and swallows clicks. Dismissing it is setup, not a test —
 * it is recorded separately so it never inflates the click count.
 */
export async function dismissConsent(page) {
  try {
    const found = await page.evaluate((words) => {
      const isOverlay = (el) => {
        const st = getComputedStyle(el)
        return (st.position === 'fixed' || st.position === 'sticky') && Number(st.zIndex || 0) >= 5
      }
      const banners = [...document.querySelectorAll('div,section,aside,dialog,[role=dialog]')]
        .filter(el => isOverlay(el) && /cookie|consent|privac|gdpr|lgpd/i.test(el.textContent || ''))
      for (const b of banners) {
        for (const btn of b.querySelectorAll('button,a[role=button],[role=button],a')) {
          const label = (btn.innerText || btn.value || '').trim().toLowerCase()
          if (words.some(w => label === w || label.startsWith(w))) {
            btn.setAttribute('data-qa-consent', '1')
            return label
          }
        }
      }
      return null
    }, CONSENT_ACCEPT)

    if (!found) return null
    await page.locator('[data-qa-consent="1"]').first().click({ timeout: 3000 })
    await page.waitForTimeout(250)
    return found
  } catch { return null }
}

/**
 * Waits for the page to stop changing: nothing in flight, no visible spinner, height stable.
 * This is what makes "click everything" honest on an app that loads after render.
 */
export async function settle(page, { timeoutMs = 8000 } = {}) {
  const deadline = Date.now() + timeoutMs
  let lastHeight = -1
  let stable = 0
  while (Date.now() < deadline) {
    const snap = await page.evaluate((busySel) => ({
      height: document.documentElement.scrollHeight,
      controls: document.querySelectorAll('a[href],button,[role=button],input,select,textarea').length,
      busy: [...document.querySelectorAll(busySel)].some(el => {
        const r = el.getBoundingClientRect()
        return r.width > 0 && r.height > 0
      }),
      ready: document.readyState
    }), BUSY).catch(() => null)
    if (!snap) return
    const key = `${snap.height}:${snap.controls}`
    if (!snap.busy && snap.ready !== 'loading' && key === lastHeight) {
      if (++stable >= 2) return           // two consecutive identical reads: it has settled
    } else {
      stable = 0
    }
    lastHeight = key
    await page.waitForTimeout(200)
  }
}

/**
 * Scrolls the whole document (and any inner scroll container) to the bottom in steps, so
 * lazy-loaded, virtualised and IntersectionObserver-gated content actually exists before
 * discovery runs. Then returns to the top so coordinates and screenshots are predictable.
 */
export async function scrollThrough(page, { maxSteps = 14 } = {}) {
  let grew = false
  for (let i = 0; i < maxSteps; i++) {
    const before = await page.evaluate(() => document.documentElement.scrollHeight).catch(() => 0)
    const atBottom = await page.evaluate(() => {
      const el = document.scrollingElement || document.documentElement
      el.scrollTop = Math.min(el.scrollTop + window.innerHeight * 0.9, el.scrollHeight)
      // inner scrollers too — a virtualised table never grows the page
      document.querySelectorAll('*').forEach((n) => {
        if (n.scrollHeight > n.clientHeight + 40 && n.clientHeight > 120) {
          const st = getComputedStyle(n)
          if (/auto|scroll/.test(st.overflowY)) n.scrollTop = n.scrollHeight
        }
      })
      return el.scrollTop + el.clientHeight >= el.scrollHeight - 4
    }).catch(() => true)
    await settle(page, { timeoutMs: 2500 })
    const after = await page.evaluate(() => document.documentElement.scrollHeight).catch(() => 0)
    if (after > before) grew = true
    if (atBottom && after === before) break
  }
  await page.evaluate(() => { (document.scrollingElement || document.documentElement).scrollTop = 0 }).catch(() => {})
  await page.waitForTimeout(150)
  return grew
}

/**
 * Menus that only exist while the pointer is over their trigger. Without this pass, every
 * dropdown in the app is reported as a dead button.
 */
export async function hoverReveal(page) {
  const revealed = []
  const names = []
  try {
    const triggers = await page.evaluate(() => {
      const sel = '[aria-haspopup], [data-menu], .menu > button, .dropdown > button, nav li:has(ul) > a, [aria-expanded="false"]'
      return [...document.querySelectorAll(sel)].slice(0, 12).map((el, i) => {
        el.setAttribute('data-qa-hover', String(i))
        return i
      })
    })
    for (const i of triggers) {
      const t = page.locator(`[data-qa-hover="${i}"]`).first()
      if (!(await t.isVisible({ timeout: 500 }).catch(() => false))) continue
      const before = await page.evaluate(() => document.querySelectorAll('a[href],button,[role=button]').length).catch(() => 0)
      await t.hover({ timeout: 1500 }).catch(() => {})
      await page.waitForTimeout(200)
      const after = await page.evaluate(() => document.querySelectorAll('a[href],button,[role=button]').length).catch(() => 0)
      revealed.push(i)
      // Remember the triggers that actually opened something, so clicking them later is
      // judged as "reveals a menu" rather than "does nothing".
      if (after > before) names.push((await t.innerText().catch(() => '')).trim().replace(/\s+/g, ' ').slice(0, 80))
    }
  } catch {}
  revealed.names = names
  return revealed
}

/** When a click is refused, name what is on top of the control instead of guessing. */
export async function whatCovers(page, selector) {
  try {
    return await page.evaluate((sel) => {
      const el = document.querySelector(sel)
      if (!el) return 'element is no longer in the page'
      const r = el.getBoundingClientRect()
      const stack = document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      const blockers = stack
        .slice(0, stack.indexOf(el) === -1 ? 3 : stack.indexOf(el))
        .filter(n => n !== el && !el.contains(n) && !n.hasAttribute('data-qa-skip'))
      if (!blockers.length) return 'nothing on top — likely disabled or outside the viewport'
      const name = (n) => {
        const id = n.id ? '#' + n.id : ''
        const cls = typeof n.className === 'string' && n.className.trim() ? '.' + n.className.trim().split(/\s+/)[0] : ''
        return `<${n.tagName.toLowerCase()}${id}${cls}>`
      }
      return 'covered by ' + blockers.slice(0, 2).map(name).join(' over ')
    }, selector)
  } catch { return 'could not determine' }
}

export function logPrep({ consent, grew, revealed, scrollOnly }) {
  if (consent) log.step(`consent banner dismissed ("${consent}") — not counted as a click`)
  if (grew) log.step(`scrolled to the bottom${scrollOnly ? ` — ${scrollOnly} control(s) only exist after scrolling` : ' — more content loaded on the way'}`)
  if (revealed?.length) log.step(`${revealed.length} hover menu(s) opened to reveal their items`)
}

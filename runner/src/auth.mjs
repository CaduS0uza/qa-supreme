import fs from 'node:fs'
import path from 'node:path'
import { log } from './logger.mjs'

// Most real targets are behind a login. Without this the crawler explores a login page and
// reports an empty app — the single biggest gap between a demo and a usable tool.

const USER_SELECTORS = [
  'input[autocomplete="username"]', 'input[name="username"]', 'input[name="email"]',
  'input[name="user"]', 'input[name="login"]', 'input[type="email"]',
  '#username', '#email', '#user', '[data-testid="username"]', '[data-testid="email"]'
]
const PASS_SELECTORS = [
  'input[type="password"]', 'input[autocomplete="current-password"]',
  'input[name="password"]', '#password', '[data-testid="password"]'
]
const SUBMIT_SELECTORS = [
  'button[type="submit"]', 'input[type="submit"]',
  'form button:not([type="button"])', '[data-testid="submit"]', '[data-testid="login"]'
]

async function firstVisible(page, selectors, explicit) {
  if (explicit) {
    const l = page.locator(explicit).first()
    if (await l.isVisible({ timeout: 3000 }).catch(() => false)) return l
    throw new Error(`selector not visible: ${explicit}`)
  }
  for (const sel of selectors) {
    const l = page.locator(sel).first()
    if (await l.isVisible({ timeout: 400 }).catch(() => false)) return l
  }
  return null
}

/** True when the page currently shows a login form. */
export async function looksLikeLogin(page) {
  return await page.evaluate(() => {
    const pass = document.querySelector('input[type=password]')
    if (!pass) return false
    const r = pass.getBoundingClientRect()
    return r.width > 0 && r.height > 0
  }).catch(() => false)
}

/**
 * Log in with the configured credentials and persist the session.
 * Returns { ok, detail } — never throws, so the pipeline can report the failure as a finding.
 */
export async function login(context, page, cfg) {
  const a = cfg.auth || {}
  if (!a.username || !a.password) return { ok: false, detail: 'no credentials configured' }
  const loginUrl = a.loginUrl || cfg.url

  try {
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: cfg.timeoutMs })
    await page.waitForTimeout(300)

    const userField = await firstVisible(page, USER_SELECTORS, a.userSelector)
    const passField = await firstVisible(page, PASS_SELECTORS, a.passSelector)
    if (!userField || !passField) {
      return { ok: false, detail: `no login form at ${loginUrl} (pass --login-url, or --user-selector/--pass-selector)` }
    }

    await userField.fill(a.username, { timeout: cfg.timeoutMs })
    await passField.fill(a.password, { timeout: cfg.timeoutMs })

    const submit = await firstVisible(page, SUBMIT_SELECTORS, a.submitSelector)
    if (submit) await submit.click({ timeout: cfg.timeoutMs })
    else await passField.press('Enter')

    // Success is "the login form is gone", not "a navigation happened": SPAs authenticate
    // without changing the URL, and a failed login often navigates back to itself.
    await Promise.race([
      page.waitForURL(u => !String(u).includes('login'), { timeout: 8000 }).catch(() => {}),
      page.waitForTimeout(2500)
    ])
    await page.waitForLoadState('domcontentloaded').catch(() => {})

    if (a.successSelector) {
      const ok = await page.locator(a.successSelector).first().isVisible({ timeout: 5000 }).catch(() => false)
      if (!ok) return { ok: false, detail: `success selector never appeared: ${a.successSelector}` }
    } else if (await looksLikeLogin(page)) {
      const visibleError = await page.locator('[role=alert], .error, [aria-invalid=true]').first()
        .innerText({ timeout: 800 }).catch(() => '')
      return { ok: false, detail: `still on the login form after submitting${visibleError ? ` — "${visibleError.trim().slice(0, 80)}"` : ''}` }
    }

    if (a.storageState) {
      fs.mkdirSync(path.dirname(path.resolve(a.storageState)), { recursive: true })
      await context.storageState({ path: path.resolve(a.storageState) })
    }
    return { ok: true, detail: `signed in as ${a.username}, landed on ${page.url()}` }
  } catch (e) {
    return { ok: false, detail: e.message.split('\n')[0].slice(0, 160) }
  }
}

export async function ensureAuth(context, page, cfg) {
  const a = cfg.auth
  if (!a) return null
  if (a.storageState && fs.existsSync(path.resolve(a.storageState)) && !a.forceLogin) {
    log.step(`reusing saved session (${a.storageState})`)
    return { ok: true, detail: 'reused stored session', reused: true }
  }
  const r = await login(context, page, cfg)
  if (r.ok) log.ok(`auth: ${r.detail}`)
  else log.warn(`auth failed: ${r.detail}`)
  return r
}

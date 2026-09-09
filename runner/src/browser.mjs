import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { HUD_INIT } from './hud.mjs'
import { ensureAuth } from './auth.mjs'

// One browser session shared by every stage, collecting console errors, page errors and
// failed network responses for the whole run. Evidence is cumulative, never per-stage.
// Launch order: the bundled chromium, then the browsers already on the machine.
// Playwright ships no binaries for some OS versions (macOS 13, older Linux); falling back to
// an installed Chrome/Edge keeps the runner usable instead of failing at the first step.
async function launch(cfg) {
  const attempts = [
    { label: 'bundled chromium', opts: {} },
    { label: 'system chrome', opts: { channel: 'chrome' } },
    { label: 'system edge', opts: { channel: 'msedge' } }
  ]
  const errors = []
  for (const a of attempts) {
    try {
      const b = await chromium.launch({ headless: !cfg.headed, slowMo: cfg.slowMo, ...a.opts })
      if (a.label !== 'bundled chromium') console.log(`   using ${a.label} (bundled chromium unavailable)`)
      return b
    } catch (e) { errors.push(`${a.label}: ${e.message.split('\n')[0]}`) }
  }
  throw new Error(`No usable browser. Tried:\n   - ${errors.join('\n   - ')}\n   Fix: npx playwright install chromium, or install Google Chrome.`)
}

export async function openSession(cfg) {
  const browser = await launch(cfg)
  const contextOpts = {
    viewport: cfg.viewport,
    recordVideo: cfg.video ? { dir: path.join(cfg.outDir, 'video'), size: cfg.viewport } : undefined,
    ignoreHTTPSErrors: true
  }
  if (cfg.auth?.storageState && fs.existsSync(cfg.auth.storageState)) {
    contextOpts.storageState = cfg.auth.storageState
  }
  const context = await browser.newContext(contextOpts)
  context.setDefaultTimeout(cfg.timeoutMs)

  const findings = { console: [], pageErrors: [], network: [], dialogs: [] }
  if (cfg.hud) await context.addInitScript(HUD_INIT)

  const wire = (page) => {
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') {
        findings.console.push({ type: m.type(), text: m.text().slice(0, 500), url: page.url() })
      }
    })
    page.on('pageerror', (e) => {
      findings.pageErrors.push({ message: String(e.message).slice(0, 500), url: page.url() })
    })
    page.on('response', (r) => {
      const s = r.status()
      if (s >= 400) findings.network.push({ status: s, url: r.url().slice(0, 300), from: page.url() })
    })
    // Never let a confirm() block the crawl; record it as an interaction instead.
    page.on('dialog', async (d) => {
      findings.dialogs.push({ type: d.type(), message: d.message().slice(0, 300), url: page.url() })
      try { await d.dismiss() } catch {}
    })
  }
  context.on('page', wire)

  const page = await context.newPage()
  wire(page)

  const session = { browser, context, page, findings, auth: null }
  if (cfg.auth) session.auth = await ensureAuth(context, page, cfg)
  return session
}

export async function closeSession(s) {
  try { await s.context.close() } catch {}
  try { await s.browser.close() } catch {}
}

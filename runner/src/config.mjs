import fs from 'node:fs'
import path from 'node:path'
import { setLang } from './i18n.mjs'

export const DEFAULTS = {
  url: null,
  out: '.qa-supreme',
  // Watching the run is the default for a person: a QA you cannot see is a QA you have to
  // take on faith. Machines (CI, pipes, no TTY) get headless automatically.
  headed: Boolean(process.stdout.isTTY) && !process.env.CI,
  slowMo: 0,
  narrate: null,      // resolved below: one printed line per click when a human is watching
  watch: false,       // watch mode: headed + slowed down + video + bigger HUD
  lang: process.env.QA_LANG || 'en',   // transcript language: en | pt
  maxDepth: 4,
  maxPages: 40,
  maxClicksPerPage: 60,
  maxTotalClicks: 800,
  timeoutMs: 15000,
  clickTimeoutMs: 4000,
  settleMs: 8000,        // how long to wait for the page to stop changing before judging it
  rescanPasses: 3,       // sweep again after content that arrived late
  only: null,            // CSS selector: explore just this region (one tab, one panel, one screen)   // a control that does not accept a click in 4s is a finding, not a wait
  viewport: { width: 1440, height: 900 },
  sameOriginOnly: true,
  hud: true,
  // Safety: labels/hrefs matching these are recorded as SKIPPED-DANGEROUS instead of clicked.
  // Emptied by --full-send (only ever do that on a throwaway environment).
  denyText: [
    'delete', 'remove', 'destroy', 'excluir', 'apagar', 'deletar', 'remover',
    'logout', 'log out', 'sign out', 'sair', 'encerrar sess',
    'pay', 'purchase', 'checkout', 'subscribe', 'pagar', 'comprar', 'assinar',
    'cancel subscription', 'cancelar assinatura', 'downgrade',
    'invite', 'send email', 'enviar', 'publish', 'publicar', 'deploy',
    'reset', 'wipe', 'transfer', 'withdraw', 'sacar', 'transferir'
  ],
  denySelectors: ['[data-qa-danger]', '[data-qa-skip]'],
  stages: ['smoke', 'crawl', 'forms', 'console', 'a11y', 'perf', 'visual', 'security'],
  // { username, password, loginUrl?, storageState?, userSelector?, passSelector?,
  //   submitSelector?, successSelector?, forceLogin? }
  auth: null,
  budgets: { lcpMs: 2500, cls: 0.1, ttfbMs: 800, jsHeapMb: 150 },
  // 0.1% of pixels. Tuned for pixelmatch with antialiasing ignored: a changed headline is
  // ~0.1%, so a looser bar (the old 2%, sized for byte comparison) silently passed real
  // regressions. Raise it per project if your app has genuinely noisy regions — and mask
  // those regions instead, if you can.
  visual: { threshold: 0.001 }
}

export function loadConfig(cliArgs = {}) {
  const file = cliArgs.config || 'qa-supreme.config.json'
  let fileCfg = {}
  const abs = path.resolve(process.cwd(), file)
  if (fs.existsSync(abs)) {
    try { fileCfg = JSON.parse(fs.readFileSync(abs, 'utf8')) }
    catch (e) { throw new Error(`Invalid config at ${abs}: ${e.message}`) }
  }
  const cfg = { ...DEFAULTS, ...fileCfg, ...stripUndefined(cliArgs) }
  if (!Array.isArray(cfg.stages)) cfg.stages = DEFAULTS.stages
  cfg.budgets = { ...DEFAULTS.budgets, ...(fileCfg.budgets || {}) }
  cfg.visual = { ...DEFAULTS.visual, ...(fileCfg.visual || {}) }
  if (cfg.watch) {
    cfg.headed = true
    if (!cliArgs.slowMo && !fileCfg.slowMo) cfg.slowMo = 220
    cfg.video = cfg.video ?? true
  }
  if (cliArgs.headless) cfg.headed = false
  if (cfg.narrate === null) cfg.narrate = cfg.headed || cfg.watch

  setLang(cfg.lang)
  if (cliArgs.fullSend) cfg.denyText = []

  // CLI credentials override or create the auth block.
  const cliAuth = stripUndefined({
    username: cliArgs.user, password: cliArgs.pass, loginUrl: cliArgs.loginUrl,
    storageState: cliArgs.storage, userSelector: cliArgs.userSelector,
    passSelector: cliArgs.passSelector, submitSelector: cliArgs.submitSelector,
    successSelector: cliArgs.successSelector, forceLogin: cliArgs.forceLogin
  })
  if (Object.keys(cliAuth).length || fileCfg.auth) cfg.auth = { ...(fileCfg.auth || {}), ...cliAuth }
  if (cfg.auth && !cfg.auth.storageState) cfg.auth.storageState = path.join(cfg.out, 'auth.json')
  if (cfg.auth && !cfg.auth.username && !fs.existsSync(path.resolve(cfg.auth.storageState || ''))) {
    throw new Error('auth needs --user and --pass (or a saved session via --storage)')
  }
  if (!cfg.url) throw new Error('No target URL. Pass --url <url> or set "url" in qa-supreme.config.json')
  for (const k of ['maxDepth', 'maxPages', 'maxClicksPerPage', 'maxTotalClicks', 'timeoutMs', 'clickTimeoutMs']) {
    const v = Number(cfg[k])
    if (!Number.isFinite(v) || v < 1) throw new Error(`${k} must be a positive number (got ${cfg[k]})`)
    cfg[k] = v
  }
  const unknown = cfg.stages.filter(s => !['smoke','crawl','forms','console','a11y','perf','visual','security'].includes(s))
  if (unknown.length) throw new Error(`unknown stage(s): ${unknown.join(', ')}`)
  cfg.outDir = path.resolve(process.cwd(), cfg.out)
  return cfg
}

function stripUndefined(o) {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))
}

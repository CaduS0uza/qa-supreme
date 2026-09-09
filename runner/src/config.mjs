import fs from 'node:fs'
import path from 'node:path'

export const DEFAULTS = {
  url: null,
  out: '.qa-supreme',
  headed: false,
  slowMo: 0,
  maxDepth: 4,
  maxPages: 40,
  maxClicksPerPage: 60,
  maxTotalClicks: 800,
  timeoutMs: 15000,
  clickTimeoutMs: 4000,   // a control that does not accept a click in 4s is a finding, not a wait
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
  auth: null,          // { storageState: 'auth.json' } or { username, password, loginUrl, userSel, passSel, submitSel }
  budgets: { lcpMs: 2500, cls: 0.1, ttfbMs: 800, jsHeapMb: 150 },
  visual: { threshold: 0.02 }
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
  cfg.budgets = { ...DEFAULTS.budgets, ...(fileCfg.budgets || {}) }
  cfg.visual = { ...DEFAULTS.visual, ...(fileCfg.visual || {}) }
  if (cliArgs.fullSend) cfg.denyText = []
  if (!cfg.url) throw new Error('No target URL. Pass --url <url> or set "url" in qa-supreme.config.json')
  cfg.outDir = path.resolve(process.cwd(), cfg.out)
  return cfg
}

function stripUndefined(o) {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))
}

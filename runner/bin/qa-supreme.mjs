#!/usr/bin/env node
import { loadConfig, DEFAULTS } from '../src/config.mjs'
import { runPipeline, STAGES } from '../src/pipeline.mjs'
import fs from 'node:fs'
import path from 'node:path'

const argv = process.argv.slice(2)
const cmd = argv[0] && !argv[0].startsWith('-') ? argv[0] : 'run'

const flags = {}
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (!a.startsWith('--')) continue
  const key = a.replace(/^--/, '')
  const next = argv[i + 1]
  if (next && !next.startsWith('--')) { flags[key] = coerce(next); i++ } else flags[key] = true
}
function coerce(v) { return /^\d+$/.test(v) ? Number(v) : v === 'true' ? true : v === 'false' ? false : v }
const flag = (...names) => { for (const n of names) if (flags[n] !== undefined) return flags[n] }

const HELP = `
qa-supreme — autonomous QA pipeline

  qa-supreme run --url <url>          run every stage (default)
  qa-supreme <stage> --url <url>      run one stage: ${Object.keys(STAGES).join(', ')}
  qa-supreme init                     write qa-supreme.config.json in the current directory

Options
  --url <url>            target (or "url" in the config file)
  --out <dir>            evidence directory                 (default ${DEFAULTS.out})
  --headed               watch the run in a real window, HUD counting clicks live
  --slowMo <ms>          slow every action down, for demos   (default 0)
  --maxPages <n>         states to explore                   (default ${DEFAULTS.maxPages})
  --maxDepth <n>         crawl depth                         (default ${DEFAULTS.maxDepth})
  --maxClicksPerPage <n> click budget per state              (default ${DEFAULTS.maxClicksPerPage})
  --maxTotalClicks <n>   global click budget                 (default ${DEFAULTS.maxTotalClicks})
  --stages a,b,c         subset of stages, in order
  --full-send            disable the destructive-action guard (throwaway environments ONLY)
  --no-hud               do not inject the on-screen counter
  --video                record video of the whole run
  --config <file>        config path                         (default qa-supreme.config.json)

Authentication (most real apps need this)
  qa-supreme login --url <app> --user <u> --pass <p>     log in once, save the session
  --user <u> --pass <p>  credentials; the login form is found automatically
  --login-url <url>      where the form lives, if it is not the target URL
  --storage <file>       session file to save/reuse        (default <out>/auth.json)
  --force-login          ignore the saved session and log in again
  --user-selector / --pass-selector / --submit-selector / --success-selector
                         override the automatic form detection
`

if (flags.help || cmd === 'help') { console.log(HELP); process.exit(0) }

if (cmd === 'init') {
  const target = path.resolve(process.cwd(), 'qa-supreme.config.json')
  if (fs.existsSync(target) && !flags.force) { console.error('qa-supreme.config.json already exists (use --force)'); process.exit(1) }
  const seed = {
    url: flags.url || 'http://localhost:3000',
    out: '.qa-supreme',
    maxPages: DEFAULTS.maxPages,
    maxDepth: DEFAULTS.maxDepth,
    stages: DEFAULTS.stages,
    budgets: DEFAULTS.budgets,
    denyText: DEFAULTS.denyText
  }
  fs.writeFileSync(target, JSON.stringify(seed, null, 2))
  console.log(`wrote ${target}`)
  process.exit(0)
}

const cliArgs = {
  url: flags.url,
  user: flag('user'),
  pass: flag('pass', 'password'),
  loginUrl: flag('login-url', 'loginUrl'),
  storage: flag('storage', 'storage-state'),
  userSelector: flag('user-selector'),
  passSelector: flag('pass-selector'),
  submitSelector: flag('submit-selector'),
  successSelector: flag('success-selector'),
  forceLogin: flags['force-login'] === true ? true : undefined,
  out: flags.out,
  headed: flags.headed === true ? true : undefined,
  slowMo: flags.slowMo,
  maxPages: flags.maxPages,
  maxDepth: flags.maxDepth,
  maxClicksPerPage: flags.maxClicksPerPage,
  maxTotalClicks: flags.maxTotalClicks,
  hud: flags.hud === false || flags['no-hud'] ? false : undefined,
  video: flags.video === true ? true : undefined,
  fullSend: flags['full-send'] === true ? true : undefined,
  config: flags.config,
  stages: flags.stages ? String(flags.stages).split(',').map(s => s.trim())
    : cmd === 'login' ? ['smoke']
    : (cmd !== 'run' && STAGES[cmd] ? [cmd] : undefined)
}

if (cmd !== 'run' && cmd !== 'login' && !STAGES[cmd]) {
  console.error(`unknown command "${cmd}"\n${HELP}`)
  process.exit(1)
}

try {
  const cfg = loadConfig(cliArgs)

  // `login` is not a stage: it opens a session, proves it works, and stores it for later runs.
  if (cmd === 'login') {
    cfg.auth = { ...(cfg.auth || {}), forceLogin: true }
    const { openSession, closeSession } = await import('../src/browser.mjs')
    const session = await openSession(cfg)
    const ok = session.auth?.ok
    console.log(ok
      ? `\n✔ session saved to ${cfg.auth.storageState}\n   ${session.auth.detail}\n   reuse it with: --storage ${cfg.auth.storageState}\n`
      : `\n✖ login failed: ${session.auth?.detail || 'unknown reason'}\n`)
    await closeSession(session)
    process.exit(ok ? 0 : 1)
  }
  const run = await runPipeline(cfg)
  process.exit(run.verdict.decision === 'NO-SHIP' ? 1 : 0)
} catch (e) {
  console.error(`\n✖ ${e.message}\n`)
  process.exit(2)
}

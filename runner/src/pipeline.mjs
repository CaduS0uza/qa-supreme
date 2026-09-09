import fs from 'node:fs'
import path from 'node:path'
import { log } from './logger.mjs'
import { openSession, closeSession } from './browser.mjs'
import { smoke } from './stages/smoke.mjs'
import { crawl } from './stages/crawl.mjs'
import { forms } from './stages/forms.mjs'
import { consoleErrors } from './stages/consoleErrors.mjs'
import { a11y } from './stages/a11y.mjs'
import { perf } from './stages/perf.mjs'
import { visual } from './stages/visual.mjs'
import { security } from './stages/security.mjs'
import { writeReport } from './report.mjs'

export const STAGES = {
  smoke:    { fn: smoke,          desc: 'is the build alive at all' },
  crawl:    { fn: crawl,          desc: 'click every reachable control, follow every tab' },
  forms:    { fn: forms,          desc: 'empty / junk / plausible submissions' },
  console:  { fn: consoleErrors,  desc: 'everything the browser complained about' },
  a11y:     { fn: a11y,           desc: 'WCAG 2.2 A/AA via axe-core' },
  perf:     { fn: perf,           desc: 'core web vitals against explicit budgets' },
  visual:   { fn: visual,         desc: 'baseline / diff per discovered state' },
  security: { fn: security,       desc: 'headers, cookies, client-side secrets' }
}

export async function runPipeline(cfg) {
  fs.mkdirSync(path.join(cfg.outDir, 'screenshots'), { recursive: true })
  const selected = cfg.stages.filter(s => STAGES[s])
  log.setTotal(selected.length)
  log.banner('QA SUPREME', `${cfg.url} · ${selected.length} stages · ${cfg.headed ? 'headed' : 'headless'}`)

  const session = await openSession(cfg)
  const results = {}
  const startedAt = new Date()
  let aborted = null

  try {
    for (const name of selected) {
      const { fn, desc } = STAGES[name]
      log.stageStart(name, desc)
      let r
      try {
        r = await fn(session, cfg, results)
      } catch (e) {
        r = { status: 'fail', summary: `stage crashed: ${e.message.split('\n')[0]}`, data: { error: e.stack } }
      }
      results[name] = r
      log.stageEnd(name, r.status, r.summary)
      if (r.blocking && r.status === 'fail') { aborted = name; log.fail(`blocking failure in ${name} — later stages would report noise, stopping`); break }
    }
  } finally {
    await closeSession(session)
  }

  const run = {
    url: cfg.url,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
    aborted,
    stages: results,
    verdict: verdictOf(results, aborted),
    totals: {
      clicks: results.crawl?.data?.totalClicks || 0,
      states: results.crawl?.data?.graph?.nodes?.length || 0,
      transitions: results.crawl?.data?.graph?.edges?.length || 0,
      guardedSkips: results.crawl?.data?.guardedSkips || 0,
      deadControls: results.crawl?.data?.deadControls || 0
    }
  }

  fs.writeFileSync(path.join(cfg.outDir, 'run.json'), JSON.stringify(run, null, 2))
  const reportPath = writeReport(run, cfg)

  log.banner(`VERDICT: ${run.verdict.decision}`, run.verdict.reason)
  log.table(Object.entries(results).map(([k, v]) => ({ stage: k, status: v.status.toUpperCase(), summary: v.summary })))
  log.info(`clicks performed: ${log.c(log.C.bold, run.totals.clicks)} · states: ${run.totals.states} · transitions: ${run.totals.transitions}`)
  log.info(`evidence: ${path.relative(process.cwd(), reportPath)}  ·  raw: ${path.relative(process.cwd(), path.join(cfg.outDir, 'run.json'))}`)
  return run
}

function verdictOf(results, aborted) {
  const entries = Object.entries(results)
  const failed = entries.filter(([, r]) => r.status === 'fail').map(([k]) => k)
  const warned = entries.filter(([, r]) => r.status === 'warn').map(([k]) => k)
  if (aborted) return { decision: 'NO-SHIP', reason: `blocking failure in ${aborted}` }
  if (failed.length) return { decision: 'NO-SHIP', reason: `failing stages: ${failed.join(', ')}` }
  if (warned.length) return { decision: 'SHIP WITH DEBT', reason: `warnings in: ${warned.join(', ')}` }
  return { decision: 'SHIP', reason: `all ${entries.length} stages green with evidence` }
}

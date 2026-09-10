import path from 'node:path'
import { log } from '../logger.mjs'
import { discoverExpr, STATE_HASH } from '../discover.mjs'
import { t } from '../i18n.mjs'
import { dismissConsent, settle, scrollThrough, hoverReveal, whatCovers, logPrep } from '../interact.mjs'

// The hash is part of the address: an SPA with hash routing has one pathname and many screens.
const norm = (u) => { try { const x = new URL(u); return x.toString() } catch { return u } }
const sameOrigin = (a, b) => { try { return new URL(a).origin === new URL(b).origin } catch { return false } }

const describe = (e) => [
  e.threw && `${e.threw} uncaught exception(s)`,
  e.server5xx && `${e.server5xx} server error(s)`,
  e.failed4xx && `${e.failed4xx} failed request(s)`,
  e.consoleErrors && `${e.consoleErrors} console error(s)`
].filter(Boolean).join(', ') || 'no observable effect'

function isDangerous(el, cfg) {
  const hay = `${el.name} ${el.href || ''} ${el.testid || ''}`.toLowerCase()
  return cfg.denyText.some(x => hay.includes(x))
}

// Clicking "sign out" mid-crawl ends the session and every later state becomes the login page.
function endsSession(el) {
  const hay = `${el.name} ${el.href || ''}`.toLowerCase()
  return /log ?out|sign ?out|sair|logout|\/login|encerrar/.test(hay)
}

/** Controls live in the page and inside every same-origin frame. Both are the user's screen. */
async function discoverAll(page, cfg) {
  const found = []
  const seen = new Set()
  const push = (list, frameSel) => {
    for (const el of list) {
      const key = `${frameSel || ''}|${el.key}`
      if (seen.has(key)) continue
      seen.add(key)
      found.push({ ...el, frameSel })
    }
  }
  push(await page.evaluate(discoverExpr(cfg.only)).catch(() => []), null)

  // Frames: an embedded checkout or editor is part of the product, not someone else's problem.
  const frames = page.frames().filter(f => f !== page.mainFrame())
  for (const f of frames.slice(0, 6)) {
    try {
      const el = await f.frameElement().catch(() => null)
      if (!el) continue
      const sel = await el.evaluate((n) => {
        if (n.id) return `iframe#${CSS.escape(n.id)}`
        if (n.name) return `iframe[name="${CSS.escape(n.name)}"]`
        const all = [...document.querySelectorAll('iframe')]
        return `iframe:nth-of-type(${all.indexOf(n) + 1})`
      }).catch(() => null)
      if (!sel) continue
      // Frames are their own document: a scope selector belongs to the host page only.
      if (!cfg.only) push(await f.evaluate(discoverExpr(null)).catch(() => []), sel)
    } catch {}
  }
  return found
}

/** State of the whole screen: the page plus every frame embedded in it. */
async function stateOf(page) {
  const main = await page.evaluate(STATE_HASH).catch(() => '')
  const frames = page.frames().filter(f => f !== page.mainFrame()).slice(0, 6)
  const inner = await Promise.all(frames.map(f => f.evaluate(STATE_HASH).catch(() => '')))
  return main + (inner.length ? '|' + inner.join('|') : '')
}

const locate = (page, el) => (el.frameSel ? page.frameLocator(el.frameSel).locator(el.selector) : page.locator(el.selector)).first()

/**
 * Breadth-first exploration of the whole reachable UI: every interactive control on every
 * reachable state is clicked once, new tabs are followed, and each click is counted on screen.
 */
export async function crawl(session, cfg) {
  const { page, context } = session
  const graph = { nodes: [], edges: [] }
  const clicks = []
  const inicioVarredura = Date.now()
  const skipped = []
  const errors = []
  const visited = new Set()
  const hudTrail = []
  const queue = [{ url: norm(cfg.url), depth: 0, from: null }]
  let total = 0
  let retried = 0

  const hud = async (p, patch) => {
    if (!cfg.hud) return
    try { await p.evaluate((x) => window.__qaHud && window.__qaHud(x), { stage: 'crawl', ...patch }) } catch {}
  }

  /** Get the page into the state where discovery is honest, then list what is there. */
  const prepareAndDiscover = async (announce) => {
    const consent = await dismissConsent(page)
    await settle(page, { timeoutMs: cfg.settleMs })

    // Discover in three passes and record what each control needs to exist at all. Returning
    // to the base state destroys lazy content and closes menus, so a control found only after
    // scrolling or hovering must carry that requirement or it is unreachable on revisit.
    const key = (e) => `${e.frameSel || ''}|${e.key}`
    const atRest = await discoverAll(page, cfg)
    const restKeys = new Set(atRest.map(key))

    const grew = await scrollThrough(page)
    const afterScroll = await discoverAll(page, cfg)
    const scrollOnly = afterScroll.filter(e => !restKeys.has(key(e))).map(e => ({ ...e, needsScroll: true }))
    const scrollKeys = new Set([...restKeys, ...scrollOnly.map(key)])

    const revealed = await hoverReveal(page)
    await settle(page, { timeoutMs: 2500 })
    const afterHover = await discoverAll(page, cfg)
    const hoverOnly = afterHover.filter(e => !scrollKeys.has(key(e))).map(e => ({ ...e, needsHover: true, needsScroll: grew }))

    const elements = [...atRest, ...scrollOnly, ...hoverOnly]
    if (announce) logPrep({ consent, grew, revealed, scrollOnly: scrollOnly.length })
    return { elements, consent, hoverTriggers: revealed.names }
  }

  while (queue.length && graph.nodes.length < cfg.maxPages && total < cfg.maxTotalClicks) {
    const node = queue.shift()
    let stateHash
    try {
      await page.goto(node.url, { waitUntil: 'domcontentloaded', timeout: cfg.timeoutMs })
      stateHash = await stateOf(page)
    } catch (e) {
      errors.push({ kind: 'navigation', url: node.url, message: e.message.split('\n')[0] })
      log.fail(`unreachable: ${node.url}`)
      continue
    }
    if (visited.has(stateHash)) continue
    visited.add(stateHash)

    const prep = await prepareAndDiscover(true)
    let elements = prep.elements
    const hoverTriggers = new Set(prep.hoverTriggers || [])
    const title = await page.title().catch(() => '')
    const nodeId = `n${graph.nodes.length + 1}`
    graph.nodes.push({ id: nodeId, url: node.url, title, depth: node.depth, interactive: elements.length })
    log.info(`${log.c(log.C.bold, nodeId)} ${node.url}  ${log.c(log.C.dim, `(${elements.length} interactive, depth ${node.depth})`)}`)

    let dirty = false
    let pass = 0
    const done = new Set()

    // Re-scan passes: content that arrives after the first sweep (async loads, revealed panels)
    // gets clicked too, instead of being discovered and abandoned.
    while (pass < cfg.rescanPasses && total < cfg.maxTotalClicks) {
      pass += 1
      let clickedThisPass = 0

      for (let i = 0; i < elements.length && total < cfg.maxTotalClicks; i++) {
        const el = elements[i]
        const id = `${el.frameSel || ''}|${el.key}`
        if (done.has(id)) continue
        if (done.size >= cfg.maxClicksPerPage) break
        done.add(id)

        if (isDangerous(el, cfg) || (cfg.auth && endsSession(el))) {
          skipped.push({ node: nodeId, element: el, reason: 'destructive-guard' })
          if (cfg.narrate) log.guarded(el.name || el.selector)
          continue
        }

        try {
          if (norm(page.url()) !== node.url || dirty || el.revealedBy || el.needsHover || el.needsScroll) {
            await page.goto(node.url, { waitUntil: 'domcontentloaded', timeout: cfg.timeoutMs })
            await dismissConsent(page)
            await settle(page, { timeoutMs: cfg.settleMs })
            if (el.needsScroll) await scrollThrough(page)
            if (el.needsHover) await hoverReveal(page)
            dirty = false
          }
        } catch { break }

        if (el.revealedBy) {
          try {
            const opener = page.locator(el.revealedBy).first()
            if (await opener.isVisible({ timeout: 1200 }).catch(() => false)) {
              await opener.click({ timeout: cfg.clickTimeoutMs })
              await settle(page, { timeoutMs: 2500 })
              dirty = true
            }
          } catch {}
        }

        const locator = locate(page, el)
        const before = {
          url: norm(page.url()),
          hash: await stateOf(page),
          errors: session.findings.pageErrors.length,
          consoleErrors: session.findings.console.filter(x => x.type === 'error').length,
          server5xx: session.findings.network.filter(n => n.status >= 500).length,
          failed4xx: session.findings.network.filter(n => n.status >= 400 && n.status < 500).length,
          requests: session.findings.requests
        }
        let outcome = 'no-op'
        let opened = null
        let covered = null

        try {
          if (!(await locator.isVisible({ timeout: 1500 }).catch(() => false))) {
            skipped.push({ node: nodeId, element: el, reason: 'not-visible-on-revisit' })
            continue
          }
          if (!el.frameSel) {
            await page.evaluate((sel) => {
              const e = document.querySelector(sel)
              if (e && window.__qaFlash) window.__qaFlash(e)
            }, el.selector).catch(() => {})
          }

          total += 1
          clickedThisPass += 1
          await hud(page, { clicks: total, queue: queue.length, depth: node.depth, target: el.name || el.selector, errors: errors.length })
          if (!cfg.narrate) log.live(`click #${total} → "${(el.name || el.selector).slice(0, 48)}"`)

          let popup = null
          const onPage = (p) => { popup = p }
          context.on('page', onPage)
          let navigated = false
          const onNav = (frame) => { if (frame === page.mainFrame()) navigated = true }
          page.on('framenavigated', onNav)

          try {
            try {
              await locator.click({ timeout: cfg.clickTimeoutMs, trial: false })
            } catch (first) {
              // One retry from a clean state: a control can be transiently covered. A control
              // that refuses twice is a finding, and we name what is on top of it.
              retried += 1
              covered = el.frameSel ? null : await whatCovers(page, el.selector)
              await page.goto(node.url, { waitUntil: 'domcontentloaded', timeout: cfg.timeoutMs })
              await dismissConsent(page)
              await settle(page, { timeoutMs: cfg.settleMs })
              if (el.revealedBy) {
                await page.locator(el.revealedBy).first().click({ timeout: cfg.clickTimeoutMs }).catch(() => {})
                await page.waitForTimeout(200)
              }
              await locate(page, el).click({ timeout: cfg.clickTimeoutMs })
              covered = null
              dirty = true
            }
            // Wait for whatever the click started before judging what it did.
            await settle(page, { timeoutMs: cfg.settleMs })
          } finally {
            context.off('page', onPage)
            page.off('framenavigated', onNav)
          }

          if (popup && popup !== page) {
            await popup.waitForLoadState('domcontentloaded', { timeout: cfg.timeoutMs }).catch(() => {})
            const purl = norm(popup.url())
            outcome = 'new-tab'
            opened = purl
            if ((!cfg.sameOriginOnly || sameOrigin(purl, cfg.url)) && node.depth + 1 <= cfg.maxDepth) {
              queue.push({ url: purl, depth: node.depth + 1, from: nodeId })
            }
            await popup.close().catch(() => {})
          } else {
            const after = { url: norm(page.url()), hash: await stateOf(page) }
            if (after.url !== before.url) {
              outcome = 'navigation'
              opened = after.url
              if ((!cfg.sameOriginOnly || sameOrigin(after.url, cfg.url)) && node.depth + 1 <= cfg.maxDepth && !visited.has(after.hash)) {
                queue.push({ url: after.url, depth: node.depth + 1, from: nodeId })
              }
            } else if (navigated) {
              outcome = 'reload'
              opened = after.url
            } else if (after.hash === before.hash && hoverTriggers.has(el.name)) {
              outcome = 'hover-only'
              opened = 'menu revealed on hover'
            } else if (after.hash !== before.hash) {
              outcome = 'in-place-change'
              dirty = true
              opened = `state:${after.hash}`
              const fresh = (await discoverAll(page, cfg)).filter(s => !done.has(`${s.frameSel || ''}|${s.key}`))
              const known = new Set(elements.map(e => e.selector))
              const trulyNew = fresh.filter(s => !known.has(s.selector))
              if (trulyNew.length) {
                log.liveDone()
                log.step(t('revealed', trulyNew.length, (el.name || el.selector).slice(0, 32)))
                const room = Math.max(0, cfg.maxClicksPerPage - elements.length)
                for (const f of trulyNew.slice(0, room)) elements.push({ ...f, revealedBy: el.frameSel ? null : el.selector })
              }
              await page.keyboard.press('Escape').catch(() => {})
            }
          }
        } catch (e) {
          outcome = 'error'
          dirty = true
          errors.push({
            kind: 'click', node: nodeId, element: el.name || el.selector,
            message: e.message.split('\n')[0].slice(0, 200),
            covered: covered || undefined
          })
        }

        const f = session.findings
        const effect = {
          threw: f.pageErrors.length - before.errors,
          consoleErrors: f.console.filter(x => x.type === 'error').length - before.consoleErrors,
          server5xx: f.network.filter(n => n.status >= 500).length - before.server5xx,
          failed4xx: f.network.filter(n => n.status >= 400 && n.status < 500).length - before.failed4xx,
          requests: f.requests - before.requests
        }
        // Errors raised while a NEW page loads belong to that page, not to the control that
        // linked to it. Blaming the link is the false positive this repository exists to hunt.
        const attributable = outcome === 'no-op' || outcome === 'in-place-change'
        let verdict
        if (outcome === 'error') verdict = 'unclickable'
        else if (attributable && (effect.threw || effect.server5xx)) verdict = 'broken'
        else if (attributable && (effect.consoleErrors || effect.failed4xx)) verdict = 'suspect'
        else if (outcome !== 'no-op') verdict = 'works'
        else if (effect.requests > 0) verdict = 'works-silently'
        else verdict = 'dead'

        /* A barra vem ANTES da narração da vez: assim ela fica sempre na
           última linha do terminal, que é onde o olho procura. */
        log.progress(total, cfg.maxTotalClicks, inicioVarredura, el.name ? String(el.name).slice(0, 24) : '')

        if (cfg.narrate) {
          log.click(total, el.role, el.name || el.selector, outcome, opened)
          if (verdict !== 'works') log.verdict(verdict, el.name || el.selector, effect, covered)
          hudTrail.push(`${verdict === 'broken' ? '✖' : '·'} ${(el.name || el.selector).slice(0, 30)}`)
          await hud(page, { trail: hudTrail })
        }

        clicks.push({
          n: total, node: nodeId, role: el.role, name: el.name, selector: el.selector,
          frame: el.frameSel || undefined, shadow: el.inShadow || undefined,
          outcome, opened, verdict, effect, covered: covered || undefined
        })
        if (outcome !== 'no-op' && opened) graph.edges.push({ from: nodeId, via: el.name || el.role, to: opened, kind: outcome })
      }

      // Anything new on the page after this pass? Then the page was still loading, and the
      // user's screen has controls we have not touched yet.
      if (!clickedThisPass || done.size >= cfg.maxClicksPerPage) break
      await page.goto(node.url, { waitUntil: 'domcontentloaded', timeout: cfg.timeoutMs }).catch(() => {})
      const again = await prepareAndDiscover(false)
      const fresh = again.elements.filter(e => !done.has(`${e.frameSel || ''}|${e.key}`))
      if (!fresh.length) break
      log.step(`re-scan ${pass}: ${fresh.length} control(s) appeared after the page finished loading`)
      elements = [...elements, ...fresh]
      dirty = true
    }

    log.liveDone()
    await page.screenshot({ path: path.join(cfg.outDir, 'screenshots', `${nodeId}.png`), fullPage: true }).catch(() => {})
  }

  log.counter('clicks performed', total)
  log.counter('states discovered', graph.nodes.length)
  log.counter('transitions mapped', graph.edges.length)
  const guarded = skipped.filter(s => s.reason === 'destructive-guard').length
  log.counter('guarded skips (destructive)', guarded)
  log.counter('unreachable on revisit', skipped.length - guarded)
  log.counter('click errors', errors.length)
  if (retried) log.counter('clicks that needed a retry', retried, '(transient overlay / timing)')
  errors.forEach(e => log.fail(`${e.element}: ${e.message}${e.covered ? ` — ${e.covered}` : ''}`))

  const by = (v) => clicks.filter(c => c.verdict === v)
  const broken = by('broken'), suspect = by('suspect'), dead = by('dead'),
        silent = by('works-silently'), unclickable = by('unclickable')
  log.counter('controls that work', by('works').length + silent.length)
  if (broken.length) log.fail(`${broken.length} control(s) BROKEN — threw an exception or triggered a 5xx`)
  broken.slice(0, 6).forEach(c => log.fail(`   "${c.name}" (${c.node}) — ${describe(c.effect)}`))
  if (suspect.length) log.warn(`${suspect.length} control(s) suspect — console error or failed request`)
  suspect.slice(0, 6).forEach(c => log.warn(`   "${c.name}" (${c.node}) — ${describe(c.effect)}`))
  if (dead.length) log.warn(`${dead.length} control(s) dead — no visible change, no network call, no error`)
  dead.slice(0, 8).forEach(c => log.step(`   "${c.name}" (${c.node})`))
  if (unclickable.length) log.fail(`${unclickable.length} control(s) would not accept a click`)

  const buttons = { works: by('works').length, worksSilently: silent.length, dead: dead.length,
                    suspect: suspect.length, broken: broken.length, unclickable: unclickable.length }

  return {
    status: (broken.length || unclickable.length) ? 'fail' : (suspect.length || errors.length) ? 'warn' : 'pass',
    summary: `${total} clicks · ${graph.nodes.length} states · ${buttons.broken} broken · ${buttons.dead} dead`,
    data: { graph, clicks, skipped, errors, totalClicks: total, deadControls: dead.length,
            guardedSkips: guarded, retried, buttons }
  }
}

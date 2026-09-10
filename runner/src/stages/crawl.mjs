import path from 'node:path'
import { log } from '../logger.mjs'
import { DISCOVER, STATE_HASH } from '../discover.mjs'
import { t } from '../i18n.mjs'

const describe = (e) => [
  e.threw && `${e.threw} uncaught exception(s)`,
  e.server5xx && `${e.server5xx} server error(s)`,
  e.failed4xx && `${e.failed4xx} failed request(s)`,
  e.consoleErrors && `${e.consoleErrors} console error(s)`
].filter(Boolean).join(', ') || 'no observable effect'

const norm = (u) => { try { const x = new URL(u); x.hash = ''; return x.toString() } catch { return u } }
const sameOrigin = (a, b) => { try { return new URL(a).origin === new URL(b).origin } catch { return false } }

function isDangerous(el, cfg) {
  const hay = `${el.name} ${el.href || ''} ${el.testid || ''}`.toLowerCase()
  return cfg.denyText.some(t => hay.includes(t))
}

// Clicking "sign out" mid-crawl ends the session and every later state becomes the login page.
// The deny list already covers it; this is the second line of defence for authenticated runs.
function endsSession(el) {
  const hay = `${el.name} ${el.href || ''}`.toLowerCase()
  return /log ?out|sign ?out|sair|logout|\/login|encerrar/.test(hay)
}

/**
 * Breadth-first exploration of the whole reachable UI.
 * Every interactive element on every reachable state is clicked exactly once, new tabs are
 * followed, and each click is counted on screen through the HUD.
 */
export async function crawl(session, cfg) {
  const { page, context } = session
  const graph = { nodes: [], edges: [] }
  const clicks = []
  const skipped = []
  const errors = []
  const visited = new Set()
  const hudTrail = []
  let retried = 0
  const queue = [{ url: norm(cfg.url), depth: 0, from: null }]
  let total = 0

  const hud = async (p, patch) => {
    if (!cfg.hud) return
    try { await p.evaluate((x) => window.__qaHud && window.__qaHud(x), { stage: 'crawl', ...patch }) } catch {}
  }

  while (queue.length && graph.nodes.length < cfg.maxPages && total < cfg.maxTotalClicks) {
    const node = queue.shift()
    let stateHash
    try {
      await page.goto(node.url, { waitUntil: 'domcontentloaded', timeout: cfg.timeoutMs })
      await page.waitForTimeout(250)
      stateHash = await page.evaluate(STATE_HASH)
    } catch (e) {
      errors.push({ kind: 'navigation', url: node.url, message: e.message.split('\n')[0] })
      log.fail(`unreachable: ${node.url}`)
      continue
    }
    if (visited.has(stateHash)) continue
    visited.add(stateHash)

    const title = await page.title().catch(() => '')
    const elements = await page.evaluate(DISCOVER)
    const nodeId = `n${graph.nodes.length + 1}`
    graph.nodes.push({ id: nodeId, url: node.url, title, depth: node.depth, interactive: elements.length })
    log.info(`${log.c(log.C.bold, nodeId)} ${node.url}  ${log.c(log.C.dim, `(${elements.length} interactive, depth ${node.depth})`)}`)

    // Bound re-evaluated every iteration: controls revealed mid-crawl (modal contents, tab
    // panels) are appended to `elements` and must be clicked too, up to the per-page budget.
    let dirty = false
    for (let i = 0; i < Math.min(elements.length, cfg.maxClicksPerPage) && total < cfg.maxTotalClicks; i++) {
      const el = elements[i]

      if (isDangerous(el, cfg) || (cfg.auth && endsSession(el))) {
        skipped.push({ node: nodeId, element: el, reason: 'destructive-guard' })
        if (cfg.narrate) log.guarded(el.name || el.selector)
        else log.live(`skip (guarded) "${el.name || el.selector}"`)
        continue
      }

      // Re-establish the base state before every click. The previous click may have navigated,
      // or opened a modal that makes the rest of the page inert (every later click would then
      // time out — 15s each, which is how a crawl silently turns into a 3-minute crawl).
      try {
        if (norm(page.url()) !== node.url || dirty || el.revealedBy) {
          await page.goto(node.url, { waitUntil: 'domcontentloaded', timeout: cfg.timeoutMs })
          await page.waitForTimeout(120)
          dirty = false
        }
      } catch { break }

      // Nested control: replay the click that reveals it before addressing it. Without this
      // the element is discovered, reported, and never actually tested.
      if (el.revealedBy) {
        try {
          const opener = page.locator(el.revealedBy).first()
          if (await opener.isVisible({ timeout: 1200 }).catch(() => false)) {
            await opener.click({ timeout: cfg.clickTimeoutMs })
            await page.waitForTimeout(200)
            dirty = true
          }
        } catch { /* opener gone: the element check below records it as unreachable */ }
      }

      const locator = page.locator(el.selector).first()
      const before = {
        url: norm(page.url()),
        hash: await page.evaluate(STATE_HASH).catch(() => ''),
        // Snapshot of what the browser had complained about and requested so far, so the effects
        // of THIS click can be isolated from everything that came before it.
        errors: session.findings.pageErrors.length,
        consoleErrors: session.findings.console.filter(x => x.type === 'error').length,
        server5xx: session.findings.network.filter(n => n.status >= 500).length,
        failed4xx: session.findings.network.filter(n => n.status >= 400 && n.status < 500).length,
        requests: session.findings.requests
      }
      let outcome = 'no-op'
      let opened = null

      try {
        if (!(await locator.isVisible({ timeout: 1500 }).catch(() => false))) {
          skipped.push({ node: nodeId, element: el, reason: 'not-visible-on-revisit' })
          continue
        }
        await page.evaluate((sel) => {
          const e = document.querySelector(sel)
          if (e && window.__qaFlash) window.__qaFlash(e)
        }, el.selector).catch(() => {})

        total += 1
        await hud(page, { clicks: total, queue: queue.length, depth: node.depth, target: el.name || el.selector, errors: errors.length })
        if (!cfg.narrate) log.live(`click #${total} → "${(el.name || el.selector).slice(0, 48)}"`)

        let popup = null
        const onPage = (p) => { popup = p }
        context.on('page', onPage)
        // A link back to the current URL reloads the page: the URL and the state hash both
        // look unchanged, but the control did work, and the fresh page-load errors are not its
        // fault. Without this, every "Home" link is reported as a dead or suspect button.
        let navigated = false
        const onNav = (frame) => { if (frame === page.mainFrame()) navigated = true }
        page.on('framenavigated', onNav)
        try {
          try {
            await locator.click({ timeout: cfg.clickTimeoutMs, trial: false })
          } catch (first) {
            // One retry from a clean state. A control can be transiently covered by a toast,
            // an animation or a late-loading overlay — that is the environment, not a defect.
            // A control that refuses twice from a fresh page is a finding, and stays one.
            retried += 1
            await page.goto(node.url, { waitUntil: 'domcontentloaded', timeout: cfg.timeoutMs })
            await page.waitForTimeout(250)
            if (el.revealedBy) {
              await page.locator(el.revealedBy).first().click({ timeout: cfg.clickTimeoutMs }).catch(() => {})
              await page.waitForTimeout(200)
            }
            await page.locator(el.selector).first().click({ timeout: cfg.clickTimeoutMs })
            dirty = true
          }
          await page.waitForTimeout(180)
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
          const after = { url: norm(page.url()), hash: await page.evaluate(STATE_HASH).catch(() => '') }
          if (after.url !== before.url) {
            outcome = 'navigation'
            opened = after.url
            if ((!cfg.sameOriginOnly || sameOrigin(after.url, cfg.url)) && node.depth + 1 <= cfg.maxDepth && !visited.has(after.hash)) {
              queue.push({ url: after.url, depth: node.depth + 1, from: nodeId })
            }
          } else if (navigated) {
            outcome = 'reload'
            opened = after.url
          } else if (after.hash !== before.hash) {
            outcome = 'in-place-change'
            dirty = true
            opened = `state:${after.hash}`
            // A modal/drawer/tab-panel: its contents are reachable UI too.
            const sub = await page.evaluate(DISCOVER)
            // Identity is the element, not its label. A button that rewrites itself
            // ("Add to cart" -> "Added ✓") is the same control in a new state, not a new
            // control to click again — counting it twice inflates the click total and makes
            // the crawl non-deterministic across machines.
            const known = new Set(elements.map(e => e.selector))
            const fresh = sub.filter(s => !known.has(s.selector) && !elements.some(e => e.key === s.key))
            if (fresh.length) {
              log.liveDone()
              log.step(t('revealed', fresh.length, (el.name || el.selector).slice(0, 32)))
              const room = Math.max(0, cfg.maxClicksPerPage - elements.length)
              for (const f of fresh.slice(0, room)) elements.push({ ...f, revealedBy: el.selector })
            }
            await page.keyboard.press('Escape').catch(() => {})
          }
        }
      } catch (e) {
        outcome = 'error'
        dirty = true
        errors.push({ kind: 'click', node: nodeId, element: el.name || el.selector, message: e.message.split('\n')[0].slice(0, 200) })
      }

      // One permanent line per interaction, so the terminal is a transcript of what the
      // browser actually did — the same story the on-screen HUD is telling.
      if (cfg.narrate && outcome !== 'skipped') {
        log.click(total, el.role, el.name || el.selector, outcome, opened)
        await hud(page, { trail: [...(hudTrail.push(`${outcome === 'error' ? '✖' : '·'} ${(el.name || el.selector).slice(0, 30)}`), hudTrail)] })
      }

      // What did this specific click actually do? This is the difference between counting
      // clicks and testing buttons.
      const f = session.findings
      const effect = {
        threw: f.pageErrors.length - before.errors,
        consoleErrors: f.console.filter(x => x.type === 'error').length - before.consoleErrors,
        server5xx: f.network.filter(n => n.status >= 500).length - before.server5xx,
        failed4xx: f.network.filter(n => n.status >= 400 && n.status < 500).length - before.failed4xx,
        requests: f.requests - before.requests
      }
      // Errors raised while a NEW page loads belong to that page, not to the control that
      // linked to it — blaming the link is the false positive this whole repository exists to
      // hunt. Those errors are still reported, by the console stage, against the state itself.
      const attributable = outcome === 'no-op' || outcome === 'in-place-change'
      let verdict
      if (outcome === 'error') verdict = 'unclickable'
      else if (attributable && (effect.threw || effect.server5xx)) verdict = 'broken'
      else if (attributable && (effect.consoleErrors || effect.failed4xx)) verdict = 'suspect'
      else if (outcome !== 'no-op') verdict = 'works'
      else if (effect.requests > 0) verdict = 'works-silently'
      else verdict = 'dead'

      if (cfg.narrate && verdict !== 'works') log.verdict(verdict, el.name || el.selector, effect)

      clicks.push({ n: total, node: nodeId, role: el.role, name: el.name, selector: el.selector, outcome, opened, verdict, effect })
      if (outcome !== 'no-op' && opened) graph.edges.push({ from: nodeId, via: el.name || el.role, to: opened, kind: outcome })
    }
    log.liveDone()

    const shot = path.join(cfg.outDir, 'screenshots', `${nodeId}.png`)
    await page.screenshot({ path: shot, fullPage: true }).catch(() => {})
  }

  log.counter('clicks performed', total)
  log.counter('states discovered', graph.nodes.length)
  log.counter('transitions mapped', graph.edges.length)
  const guarded = skipped.filter(s => s.reason === 'destructive-guard').length
  log.counter('guarded skips (destructive)', guarded)
  log.counter('unreachable on revisit', skipped.length - guarded)
  log.counter('click errors', errors.length)
  if (retried) log.counter('clicks that needed a retry', retried, '(transient overlay / timing)')
  errors.forEach(e => log.fail(`${e.element}: ${e.message}`))

  // The button report: the point of clicking everything is judging everything.
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
            guardedSkips: skipped.filter(s => s.reason === 'destructive-guard').length, retried, buttons }
  }
}

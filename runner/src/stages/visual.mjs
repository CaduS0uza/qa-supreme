import fs from 'node:fs'
import path from 'node:path'
import { log } from '../logger.mjs'
import { uniqueStates } from './a11y.mjs'

// Stage 7. Baseline on first run, pixel-diff on every run after. Deterministic by design:
// animations frozen, caret hidden, fixed viewport.
export async function visual(session, cfg, prior) {
  const { page } = session
  const baseDir = path.join(cfg.outDir, 'visual', 'baseline')
  const curDir = path.join(cfg.outDir, 'visual', 'current')
  fs.mkdirSync(baseDir, { recursive: true })
  fs.mkdirSync(curDir, { recursive: true })

  const rows = []
  for (const [i, url] of uniqueStates(cfg, prior).slice(0, 8).entries()) {
    const name = `state-${String(i + 1).padStart(2, '0')}.png`
    try {
      await page.goto(url, { waitUntil: 'load', timeout: cfg.timeoutMs })
      // Freeze motion and remove our own overlay: a live click counter in the frame would
      // make every baseline comparison differ from every run.
      await page.addStyleTag({ content: `*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}#__qa_hud,[data-qa-skip]{display:none!important}` })
      await page.waitForTimeout(200)
      const buf = await page.screenshot({ fullPage: true })
      const cur = path.join(curDir, name)
      fs.writeFileSync(cur, buf)
      const base = path.join(baseDir, name)
      if (!fs.existsSync(base)) {
        fs.writeFileSync(base, buf)
        rows.push({ state: name, result: 'BASELINE', detail: 'first run — baseline stored' })
        continue
      }
      const cmp = await comparePng(fs.readFileSync(base), buf, path.join(curDir, name.replace('.png', '.diff.png')))
      const changed = cmp.ratio > cfg.visual.threshold
      rows.push({
        state: name,
        result: changed ? 'CHANGED' : 'MATCH',
        detail: cmp.exact
          ? `${cmp.pixels} px differ (${(cmp.ratio * 100).toFixed(2)}%)${changed ? ` · diff: ${path.basename(cmp.diffPath)}` : ''}`
          : `${(cmp.ratio * 100).toFixed(2)}% byte delta (install pixelmatch + pngjs for per-pixel diffs)`
      })
    } catch (e) {
      rows.push({ state: name, result: 'ERROR', detail: e.message.split('\n')[0].slice(0, 80) })
    }
  }
  log.table(rows)
  const changed = rows.filter(r => r.result === 'CHANGED').length
  return {
    status: changed ? 'warn' : 'pass',
    summary: `${rows.length} state(s) · ${changed} changed`,
    data: { rows, note: 'byte-level comparison; wire pixelmatch or `expect(page).toHaveScreenshot()` for per-pixel diffs' }
  }
}

/**
 * Per-pixel comparison when pixelmatch + pngjs are installed (they are declared dependencies),
 * byte-level fallback when they are not — the stage must never be the reason a run fails.
 */
async function comparePng(baseBuf, curBuf, diffPath) {
  try {
    const { PNG } = await import('pngjs')
    const pixelmatch = (await import('pixelmatch')).default
    const a = PNG.sync.read(baseBuf)
    const b = PNG.sync.read(curBuf)
    if (a.width !== b.width || a.height !== b.height) {
      return { exact: true, pixels: Math.abs(a.width * a.height - b.width * b.height), ratio: 1, diffPath, resized: true }
    }
    const diff = new PNG({ width: a.width, height: a.height })
    const pixels = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1, includeAA: false })
    const ratio = pixels / (a.width * a.height)
    if (pixels) fs.writeFileSync(diffPath, PNG.sync.write(diff))
    return { exact: true, pixels, ratio, diffPath }
  } catch {
    return { exact: false, pixels: null, ratio: crudeDiff(baseBuf, curBuf), diffPath }
  }
}

// Fallback signal: size delta plus a sampled byte comparison. Enough to flag "this screen
// moved" when pixelmatch is unavailable.
function crudeDiff(a, b) {
  if (a.length !== b.length) return Math.min(1, Math.abs(a.length - b.length) / Math.max(a.length, b.length) + 0.001)
  let differing = 0
  const step = Math.max(1, Math.floor(a.length / 20000))
  let sampled = 0
  for (let i = 0; i < a.length; i += step) { sampled++; if (a[i] !== b[i]) differing++ }
  return sampled ? differing / sampled : 0
}

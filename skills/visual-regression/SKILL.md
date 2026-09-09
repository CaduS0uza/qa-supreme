---
name: visual-regression
description: Catch unintended UI changes with deterministic screenshot baselines and review discipline — masking dynamic regions, freezing animations, pinning viewport and fonts, and triaging diffs. Use when asked about visual testing, UI regressions, pixel diffs, or after a CSS/design-system change.
---

# Visual Regression

Visual tests fail for two reasons: the UI changed, or your screenshots are not deterministic.
The entire craft is eliminating the second so the first is trustworthy.

## Determinism checklist (before your first baseline)

- Fixed viewport and `deviceScaleFactor`. Never rely on the CI machine's default.
- Fonts loaded and settled: `await document.fonts.ready`.
- Animations and transitions disabled; caret hidden.
- Dynamic regions masked: clocks, relative timestamps, avatars, ads, random IDs, charts with
  live data. `mask: [page.getByTestId('updated-at')]`.
- Seeded, frozen data — same rows, same order, fixed clock.
- One OS/browser per baseline. Baselines from macOS never match Linux CI: generate them in CI.

Skipping any of these produces a suite that cries wolf and gets muted within a week.

## Playwright (built in, no service required)

```ts
await expect(page).toHaveScreenshot('checkout.png', {
  maxDiffPixelRatio: 0.01,
  mask: [page.getByTestId('order-id'), page.getByRole('time')],
  animations: 'disabled',
  fullPage: true,
})
```

Update deliberately: `npx playwright test --update-snapshots`, then **read the diff images in
the PR**. A baseline updated without review is a bug promoted to expected behavior.

## What to baseline

Baseline **components and key states**, not every page: the design-system gallery, the empty
state, the error state, the loaded state, the mobile breakpoint of each. Whole-page shots of
data-heavy screens are the classic maintenance sink.

## Triage of a diff

| Diff | Action |
|---|---|
| Intended design change | update baseline in the same PR as the CSS change, reviewer approves both |
| Unintended layout shift | bug — file it, do not update |
| Anti-aliasing / 1px noise | raise `maxDiffPixelRatio` slightly, or mask; never disable the test |
| Different every run | the determinism checklist was skipped — go back to it |

## Runner integration

`node runner/bin/qa-supreme.mjs visual --url <url>` stores a baseline per discovered state on
the first run and compares afterwards with **pixelmatch**, writing a `*.diff.png` next to the
current shot and reporting the exact pixel count. Animations are frozen and the HUD is hidden,
so instrumentation never enters the frame.

The default threshold is **0.1% of pixels** (`visual.threshold: 0.001`). That is deliberate: a
changed headline is roughly 0.1%, so the looser bars people copy from byte-comparison tools pass
real regressions silently. If your app has genuinely noisy regions, mask them rather than
raising the threshold — a raised threshold hides every small regression, not just the noisy one.

---
name: perf-budget
description: Set and enforce performance budgets on real user metrics — LCP, INP, CLS, TTFB, bundle size — and detect regressions in CI. Use when asked about performance, slow pages, Core Web Vitals, Lighthouse scores, or bundle size.
---

# Performance Budgets

A performance test without a budget is a number nobody acts on. Budgets turn performance into a
pass/fail gate like any other test.

## Default budgets (tighten per product, never loosen silently)

| Metric | Good | Budget | Why it matters |
|---|---|---|---|
| LCP | < 2.5s | 2.5s | when the page feels loaded |
| INP | < 200ms | 200ms | responsiveness to real interaction |
| CLS | < 0.1 | 0.1 | layout jumping under the user's finger |
| TTFB | < 800ms | 800ms | server + network before anything renders |
| JS transferred | — | 300KB gz | the single biggest lever on low-end devices |
| Requests on load | — | 50 | latency compounding |

## Measure

```bash
node runner/bin/qa-supreme.mjs perf --url https://app.example.com    # every crawled state, against budgets
npx lighthouse https://app.example.com --preset=desktop --output=json --output-path=lh.json
npx unlighthouse --site https://app.example.com                      # whole-site sweep
```

Lab numbers are a signal, not the truth. Throttle to a mid-tier device (4x CPU slowdown, Fast
3G) — measuring on your laptop over fiber measures your laptop. Where you have field data
(CrUX/RUM), the p75 field number wins any argument with a lab number.

## Enforce in CI

Fail the build on regression, not on absolute beauty: compare against the base branch and block
when LCP degrades by more than 10% or the JS bundle grows past its budget. `size-limit`,
`bundlesize`, or Lighthouse CI assertions all do this; the tool matters less than the block.

## Load and stress

Front-end budgets say nothing about the backend under load. See `load-and-stress` for k6
thresholds. Both are required for a launch: a page that renders in 1s when nobody is using it is
not a performance result.

## Diagnosing a breach

- LCP high -> what is the LCP element? Image without priority, font blocking, server slow, or
  a client-side render waiting on a waterfall.
- CLS high -> images without dimensions, injected banners, late-loading fonts.
- INP high -> long tasks on the main thread; profile and break them up.
- TTFB high -> backend or cold start; front-end optimization will not save it.

Report the metric, the budget, the delta and the specific cause. A perf report without a named
cause is a chart.

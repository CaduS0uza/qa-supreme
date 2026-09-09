---
name: regression-curation
description: Keep a regression suite fast and meaningful — prune duplicates and zombies, tier tests by feedback loop, select tests by impacted code, and enforce a suite-time budget. Use when the suite is slow, when nobody trusts it, or before adding yet another test to a bloated suite.
---

# Regression Curation

Suites die two deaths: too slow to run, or too noisy to believe. Both are curation failures, and
both are reversible.

## Tier by feedback loop

| Tier | Budget | Runs | Contents |
|---|---|---|---|
| **T0 smoke** | < 90s | every push | build is alive (`smoke-and-sanity`) |
| **T1 core** | < 8 min | every PR | all P0 risks, unit + API, a handful of E2E journeys |
| **T2 full** | < 40 min | merge to main | everything else, all browsers, all breakpoints |
| **T3 deep** | nightly | scheduled | soak, load, mutation, full a11y, cross-browser matrix |

A PR that waits 40 minutes for feedback gets merged without reading the result. Suite time is a
quality feature: budget it, measure it, defend it.

## Prune

Delete on sight, no ceremony:

- **Zombies** — cover removed features and still pass (`FP-21`).
- **Duplicates** — n tests that always fail together cover one behavior; keep the clearest.
- **Vacuous** — everything on the `false-positive-hunter` P0 list. A deleted false positive is a
  net increase in suite trust.
- **Permanently skipped** — a test skipped for more than a sprint is a lie in the report. Fix it
  or delete it; either way the pretense ends.
- **Redundant E2E** — an E2E test whose assertion is fully covered by an API test. Push it down
  the pyramid; you keep the coverage and buy back minutes.

Record what you deleted and why in `.qa-supreme/state.md`. Deletion without a record reads as
carelessness later.

## Speed levers, in order of payoff

1. Push coverage down a level (E2E -> API -> unit). Biggest win, always.
2. Parallelize and shard (`--shard=1/4`), with per-worker data isolation.
3. Reuse expensive setup: auth `storageState`, containers, migrated database per run.
4. Test selection: run only what the diff can affect (`vitest related`, `jest --changedSince`,
   dependency-graph selection). Keep the full suite on main — selection is for the PR loop.
5. Cache dependencies and browsers in CI before optimizing test code.

## Guard the ratchet

Track suite duration per run and fail the build if T1 exceeds its budget. Same discipline as
`coverage-ratchet`, applied to time — otherwise the budget erodes one test at a time.

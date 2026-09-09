---
name: release-gate
description: Make the ship / no-ship call with an evidenced checklist — every row backed by command output, every exception named and owned. Use before a release, a deploy, or when asked "can we ship this".
---

# Release Gate

The gate exists so that shipping is a decision with evidence, not a feeling with a deadline.

## The gate table

Every row is PASS, FAIL, or WAIVED. **No row may be filled from memory** — each carries the
evidence that produced it, from this build, not the last one.

| # | Gate | Evidence required | Blocking |
|---|---|---|---|
| 1 | Smoke green on the release build | runner output + build id served | yes |
| 2 | T1 suite green | full output, 0 failed, build id | yes |
| 3 | Every P0 risk has a passing, mutation-proven test | risk register + proof lines | yes |
| 4 | No P0 false positives in changed tests | `false-positive-hunter` scan | yes |
| 5 | No uncaught exceptions / 5xx in the exploration run | `crawl` + `console` stages | yes |
| 6 | Authorization matrix green | `security-regression` output | yes |
| 7 | No critical/serious a11y violations | axe results per state | yes |
| 8 | Perf budgets met | metric vs budget per key page | no (debt) |
| 9 | Flake rate < 1% over the last 20 runs | CI flake report | no (debt) |
| 10 | Rollback tested and documented | the actual command, and who runs it | yes |
| 11 | Migrations reversible or forward-fix planned | migration + down path or plan | yes |
| 12 | Monitoring/alerts cover the new paths | alert names and thresholds | no (debt) |

## Waivers

A waiver is not a skip. It requires: **who** waived it, **why**, **the blast radius if it is
wrong**, and **when it gets fixed**. Write it into the report. An unowned waiver is a FAIL.

## The verdict

```
RELEASE GATE  build 8b1d07e -> production
  1 smoke                     PASS   6/6, build 8b1d07e served
  2 T1 suite                  PASS   248 passed, 0 failed, 6m12s
  3 P0 risks covered          PASS   7/7, all mutation-proven
  4 false positives           PASS   0 P0 in 31 changed tests
  5 exploration clean         FAIL   1 uncaught TypeError on /orders/:id (n7)
  6 authz matrix              PASS   42/42
  7 a11y critical/serious     PASS   0
  8 perf budgets              WARN   LCP 2.9s on /products (budget 2.5s)
  10 rollback                 PASS   `vercel rollback 8b1d07e`, owner: on-call
VERDICT: NO-SHIP — gate 5 is blocking. One defect, one owner, one fix.
```

## Rules

- The gate does not negotiate with a deadline. It reports; humans decide and own the override.
- A blocking FAIL is one sentence long: what failed, where, who owns it. Not a paragraph.
- Never report a gate you did not run. "Not run" is a legitimate row value — and it blocks.
- Re-run the gate after any change to the release build. A gate from a previous build is not
  evidence about this one.

## Automated form

```bash
node runner/bin/qa-supreme.mjs run --url https://staging.example.com --out .qa-supreme
# exit code 1 = NO-SHIP. Wire it as the last step of the deploy pipeline.
```

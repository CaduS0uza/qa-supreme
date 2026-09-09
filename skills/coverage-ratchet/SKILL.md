---
name: coverage-ratchet
description: Use coverage as a one-way ratchet on changed lines instead of a vanity percentage — measure, set the floor at today's number, block regressions, and target uncovered risk rather than uncovered files. Use when asked to improve coverage or when a coverage gate is being configured.
---

# Coverage Ratchet

Coverage measures execution, not verification. A 95% suite of false positives is 95%
theater (see `false-positive-hunter`). Used correctly it is still the cheapest map of what
was never even run.

## The ratchet

1. Measure today's number. That is the floor — do not negotiate a target with the team.
2. Gate on **changed lines**, not on the global percentage: new code must be covered at a
   high bar (90%+), legacy code is grandfathered.
3. The floor only moves up. A PR that lowers it fails, with the specific uncovered lines
   named in the CI output.

```bash
# JS/TS
npx vitest run --coverage.enabled --coverage.thresholds.autoUpdate=false
# Python
pytest --cov=src --cov-report=term-missing --cov-fail-under=<floor>
# Go
go test ./... -coverprofile=c.out && go tool cover -func=c.out | tail -1
```

Diff coverage tools: `diff-cover` (Python), `nyc` + `codecov` patch status, or
`git diff --name-only origin/main | xargs` piped into the reporter.

## Reading the report correctly

- **Branch coverage over line coverage.** A ternary counts as one line and two behaviors.
- Sort uncovered lines by the risk tier from `risk-map`, then work top-down. An uncovered
  `catch` block in the payment path outranks an uncovered UI helper file entirely.
- Uncovered `catch` and `default` branches are the classic production incident: they run
  exactly once, at the worst moment, and have never been executed.

## What not to do

- Never write a test whose purpose is to touch a line. It will be a `FP-01`/`FP-14` and it
  will make the suite worse while making the number better.
- Never chase 100%. The last 8% is generated code, error plumbing, and defensive branches;
  the effort belongs in `mutation-proof` on the first 30%.
- Never report coverage as quality. Report it as "code we know at least ran".

## Done means

Before/after numbers for changed lines, the new floor committed to the config, and the list
of still-uncovered P0 lines carried into `.qa-supreme/state.md` as explicit debt.

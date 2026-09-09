---
name: flake-forensics
description: Diagnose and eliminate flaky tests — quarantine, reproduce, classify the root cause into one of eight families, then fix the cause not the symptom. Use when a test passes sometimes, when CI is red intermittently, or when someone suggests adding a retry.
---

# Flake Forensics

A retry is not a fix. It is a decision to ship an unknown defect and pay for it later, at
3am, in production.

## Step 0 — Quarantine (immediately, before diagnosis)

Tag the test (`test.describe.configure({ mode: 'serial' })` is not quarantine — use a real
tag: `@quarantine`), exclude it from the blocking CI job, keep it running in a non-blocking
one. Open a ticket with an owner and a deadline. A quarantined test with no deadline is a
deleted test with extra steps — say that out loud if the team resists.

## Step 1 — Reproduce with amplification

```bash
npx playwright test path/to/spec.ts --repeat-each=20 --workers=4        # concurrency stress
npx playwright test path/to/spec.ts --repeat-each=20 --workers=1        # isolate concurrency
npx vitest run path/to/spec --sequence.shuffle --repeat=20              # order dependence
CI=1 TZ=Pacific/Auckland npx playwright test path/to/spec.ts            # env/timezone
```

Failure rate is the fingerprint: 1/20 with workers=4 and 0/20 with workers=1 means shared
state, not timing. Record the rate — you will need it to prove the fix.

## Step 2 — Classify (eight families)

| Family | Tell | Fix |
|---|---|---|
| **Race / async** | passes alone, fails in parallel | assert on state, await the specific response, never `sleep` |
| **Shared state** | fails only after another test | per-test data, transaction rollback, unique tenant per worker |
| **Order dependence** | fails when shuffled | remove the implicit setup dependency |
| **Time & timezone** | fails at midnight, month end, DST, or in CI's UTC | freeze the clock, use explicit timezones |
| **Network / third party** | fails on a specific vendor call | mock at the boundary with a recorded contract |
| **Animation / render timing** | fails on slower CI machines | wait for the assertion, disable animations in test config |
| **Resource exhaustion** | fails late in the run, memory/handles climb | close contexts, cap workers, fix the leak |
| **Real intermittent bug** | the app is genuinely broken sometimes | this is the valuable one — hand to `root-cause-protocol` |

The last row is why "just retry it" is dangerous: retries hide exactly the class of bug
users hit most.

## Step 3 — Evidence

Playwright: `trace: 'retain-on-failure'`, then `npx playwright show-trace trace.zip` — read
the timeline for the gap between action and assertion. Compare the DOM snapshot at failure
against the passing run. For backend flake: dump the query log and the clock at failure.

## Step 4 — Prove the fix

Re-run with the same amplification that reproduced it. **20 consecutive green runs minimum**,
with the numbers pasted. Then remove the quarantine tag in the same commit as the fix, so
the two never drift.

## Flake rate as a metric

Track suite health: `flaky runs / total runs` per spec over the last 50 CI runs. Above 1% on
the blocking suite, stop feature work on that area. Publish the number (see `ci-wiring`).

## Output

```
SPEC tests/checkout.spec.ts:42
  Rate before: 6/20 (workers=4), 0/20 (workers=1) -> family: shared state
  Cause: both tests seed the same tenant id
  Fix: tenantFactory() per test
  Rate after: 0/20 (workers=4), 20 consecutive green
```

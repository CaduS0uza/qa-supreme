---
name: bug-repro
description: Turn a vague bug report into a minimal, deterministic reproduction and a failing regression test before any fix is attempted. Use when handed a bug report, a support ticket, a screenshot of an error, or "it doesn't work" with no steps.
---

# Bug Reproduction

A bug you cannot reproduce is a bug you cannot prove you fixed. This skill produces two
artifacts: **the smallest set of steps that trigger it**, and **a test that fails because of it**.

## Extract the report

From whatever you were given, fill these six fields. Missing fields are questions to ask, not
blanks to imagine:

| Field | Example |
|---|---|
| Environment | prod, Chrome 141, macOS, tenant `acme` |
| Account/role | admin vs member — most "works for me" cases die here |
| Exact steps | numbered, one action per line |
| Expected | what the user believed would happen |
| Actual | including the exact error text and any request id |
| Frequency | always / N of M / only after X |

## Reproduce, then minimize

1. Reproduce it once, exactly as reported. Nothing is real until this happens.
2. Minimize by bisection: remove one step, re-run. Keep removing while it still fails.
3. Narrow the data: smallest payload, fewest rows, shortest string that still triggers it.
4. Narrow the layer: does the API alone reproduce it without the UI? Then it is not a UI bug,
   and the regression test belongs at the API level — cheaper and faster forever.
5. Record the minimal repro verbatim, including the seed data required.

## Write the failing test first

```
RED   tests/api/orders.spec.ts:88  "webhook retry creates a second charge"
      -> 1 failed  ✓ (the bug is now encoded)
```

Only now hand off to the fix. After the fix, the same test must go green — and it must be
possible to make it red again by reverting the fix (`mutation-proof`). Without that, you fixed
something, but not provably this.

## When it will not reproduce

Say so explicitly rather than guessing. Then attack the difference: data, permissions, timing,
cache, feature flags, browser, locale, timezone. Add logging around the suspected boundary and
ask for the request id from a real occurrence. An unreproduced bug stays open — never close it
as "cannot reproduce" while users are hitting it; escalate it to `root-cause-protocol` with
what you learned.

## Output

```
REPRO  3 steps (from 11 reported), tenant seed: acme-min.sql
1. POST /webhooks/stripe with event id evt_1 -> 200
2. POST /webhooks/stripe with the same event id evt_1 -> 200
3. SELECT count(*) FROM charges WHERE event_id='evt_1' -> 2   (expected 1)
REGRESSION TEST  tests/api/orders.spec.ts:88 -> failing as required
```

---
name: false-positive-hunter
description: Audit an existing test suite for tests that pass whether or not the code works — vacuous assertions, name/assertion mismatch, swallowed errors, disabled specs, mocked-away subjects. Use when asked to review tests, judge suite quality, or before trusting a suite you did not write.
---

# False-Positive Hunter

A flaky test lies sometimes and you notice. A **false-positive test lies always and nobody
notices**. This skill finds the second kind. It is the highest-value QA activity on any
inherited codebase.

## Method: adversarial, not stylistic

You are not a linter. For every test, answer one question:

> **Name a change to production code that would make this test fail. If you cannot, it is a false positive.**

Report only tests that fail that question. Never comment on style, naming taste, or
structure unless it causes the vacuity.

## Catalogue

Full definitions with examples: `../../docs/anti-patterns.md`. Severity summary:

**P0 — the test cannot fail**
- `FP-01` No assertion at all (a render/call with no `expect`)
- `FP-02` Assertion on the locator/query object, not its state (`expect(page.locator(x))` truthy)
- `FP-03` Assertion inside a `try` whose `catch` is empty or only logs
- `FP-04` `expect(true).toBe(true)` / tautologies / asserting a literal against itself
- `FP-05` Name says one behavior, assertion checks another
- `FP-06` The subject under test is itself mocked
- `FP-07` `.skip` / `.todo` / commented-out spec silently counted as suite health
- `FP-08` `.only` leaked — the rest of the file never ran in CI
- `FP-09` Conditional assertion (`if (x) expect(...)`) where the branch is never taken
- `FP-10` Promise not awaited — assertion resolves after the test ended
- `FP-11` Error path asserted with a bare `expect(fn).toThrow()` on a function that throws for the wrong reason

**P1 — the test can fail, but not for the reason claimed**
- `FP-12` Assertion only that a mock was called (wiring, not behavior)
- `FP-13` Snapshot committed without ever being reviewed; regenerated on every failure
- `FP-14` `toBeTruthy` / `toBeDefined` where a value comparison was possible
- `FP-15` Hardcoded sleep replacing a state assertion
- `FP-16` Shared mutable state making the test order-dependent
- `FP-17` Test data that satisfies the assertion by accident (e.g. filter test where all rows match)
- `FP-18` `expect.soft` chains that never fail the test
- `FP-19` Credentials/URLs hardcoded so the test silently targets the wrong environment
- `FP-20` Retry masking a deterministic failure

**P2 — decay**
- `FP-21` Zombie spec: covers a removed feature, still green
- `FP-22` Duplicate coverage: n tests, one behavior, all break together
- `FP-23` Test depends on a manual step documented in a comment
- `FP-24` Fixture bypasses the guard the test claims to verify (seeds an admin to test authz)

## Procedure

1. Scope: the diff, a directory, or the whole suite (largest first — `wc -l` per spec file).
2. For each test, run the vacuity question. Collect only failures.
3. **Verify the P0 findings empirically** where cheap: break the production line the test
   claims to cover, run only that test, and record whether it stayed green. A P0 confirmed
   this way is not an opinion — it is evidence.
4. Rank by (severity, risk tier of the code it claims to cover).
5. Recommend one of three actions per finding: **fix the assertion**, **delete the test**,
   or **replace with a real one at the right level**. Deleting a false positive is a net
   gain — say so plainly, it raises trust in the suite.

## Output

```
FP-05 P0 tests/checkout.spec.ts:42
  Claims: "rejects an expired card"   Asserts: response is 200
  Proof: reverted the expiry guard in charge.ts:88 -> test still green
  Action: assert status 402 and that no charge row was written
```

Close with: `Scanned <n> tests. P0 <n>, P1 <n>, P2 <n>. Suite trust: <low|medium|high> because <clause>.`

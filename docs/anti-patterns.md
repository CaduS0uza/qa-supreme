# The False-Positive Catalogue

24 ways a test can pass while the behavior it claims to protect is broken. Used by the
[`false-positive-hunter`](../skills/false-positive-hunter/SKILL.md) skill.

The test for every entry: **name a change to production code that makes this test fail.**
If you cannot, the test is decoration.

## P0 — the test cannot fail

### FP-01 · No assertion
```js
it('renders the cart', async () => { render(<Cart items={items} />) })   // nothing asserted
```
Passes as long as nothing throws. Fix: assert what the user should see.

### FP-02 · Assertion on the query object, not its state
```js
expect(page.locator('.total')).toBeTruthy()      // a Locator object is always truthy
await expect(page.getByTestId('total')).toHaveText('$10.00')   // correct
```

### FP-03 · Swallowed error
```js
try { await checkout() ; expect(order.status).toBe('paid') } catch (e) { /* ignored */ }
```
Every failure becomes a pass. Fix: let it throw, or assert on the rejection.

### FP-04 · Tautology
`expect(true).toBe(true)`, `expect(x).toBe(x)`, `assert 1 == 1`. Usually a placeholder that
survived review.

### FP-05 · Name/assertion mismatch
The name says "rejects an expired card", the body asserts a 200. The suite now documents the
opposite of the requirement, and the report claims coverage of a behavior nobody tests.

### FP-06 · The subject is mocked
Mocking the module under test makes the test assert your mock's behavior. Mock at the boundary
only: network, clock, filesystem, randomness.

### FP-07 · Silently skipped
`.skip`, `.todo`, `xit`, commented-out blocks — counted as suite size, never executed. A test
skipped for more than a sprint is a decision to delete it, taken without saying so.

### FP-08 · Leaked `.only`
One `test.only` in a file means every other test in that file did not run — in CI, for as long
as nobody looks. Lint rule, not code review.

### FP-09 · Conditional assertion
```js
if (res.body.items) expect(res.body.items).toHaveLength(3)   // empty body -> silent pass
```

### FP-10 · Missing await
```js
it('saves', () => { expect(save()).resolves.toBe(true) })    // no await/return: test ends first
```

### FP-11 · Throw asserted without the reason
`expect(fn).toThrow()` passes when the function throws a `TypeError` from a typo instead of the
validation error you meant. Assert the type or message.

## P1 — the test can fail, but not for the reason claimed

### FP-12 · Mock-call-only assertion
`expect(sendEmail).toHaveBeenCalled()` proves the wiring, not that the email is correct or that
it was sent for the right reason. Assert the payload, at least.

### FP-13 · Unreviewed snapshot
A snapshot committed without reading it enshrines whatever the code did that day — including the
bug. Regenerating on every failure turns the test into a recorder.

### FP-14 · Truthiness where a value was available
`toBeTruthy()` on a total passes for `1`, `"error"`, `[]`. Compare the value.

### FP-15 · Sleep instead of state
`waitForTimeout(2000)` passes on a fast machine and flakes on a slow one — and asserts nothing
about what the app did.

### FP-16 · Order-dependent shared state
Passes only because a previous test left data behind. Fails alone, "flakes" in parallel.

### FP-17 · Data that satisfies the assertion by accident
A filter test where every seeded row matches the filter passes with the filter removed.

### FP-18 · `expect.soft` that never fails
Soft assertions that are never checked at the end report failures nobody reads.

### FP-19 · Hardcoded environment
A hardcoded URL or credential silently points the test at the wrong environment — often one where
the behavior does not exist at all.

### FP-20 · Retry masking determinism
`retries: 3` on a test that fails deterministically 1 in 4 times hides a real defect behind a
green check.

## P2 — decay

### FP-21 · Zombie spec
Covers a feature that no longer exists; passes because the code path is unreachable.

### FP-22 · Duplicate coverage
Twelve tests that always fail together cover one behavior. Keep the clearest, delete the rest.

### FP-23 · Manual dependency
"Before running, set the feature flag by hand" — the test passes in CI only because someone did,
once, months ago.

### FP-24 · Fixture defeats the test
An authorization test whose fixture seeds an admin session verifies nothing about authorization.

---

**Prior art.** Related public catalogues informed the shape of this one, notably the
[e2e-skills](https://github.com/voidmatcha/e2e-skills) anti-pattern taxonomy and the
false-positive framing in Playwright's own testing guidance. The entries above are our own
formulation, written for this repository.

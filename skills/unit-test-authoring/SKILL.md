---
name: unit-test-authoring
description: Write unit tests that actually constrain behavior — Jest, Vitest, pytest, Go, JUnit — using red-first discipline, behavior-named cases, and boundary tables. Use when asked to write, add, or improve unit tests, or when implementing a feature test-first.
---

# Unit Test Authoring

## The red-first law

```
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST.
NO TEST ENTERS THE SUITE WITHOUT HAVING BEEN SEEN RED.
```

If the test was written after the code, you must still see it red: break the production
line it covers (comment the branch, invert the operator), run it, confirm the failure
message names the real behavior, restore. That is the minimum ritual — the full version
lives in `mutation-proof`.

A test you never watched fail is a test whose assertion you never verified.

## Naming

Name the behavior and the condition, never the function:

- Bad: `test('getTotal')`, `it('works')`, `test_calculate_2`
- Good: `it('excludes refunded items from the order total')`
- Good: `def test_rejects_expired_token_with_401()`

The name is the spec. If the assertion drifts from the name, `false-positive-hunter`
flags it as P0 — so keep them in sync or rename.

## Boundary table

For every input with an ordering or a size, write the table before the code:

| Class | Cases |
|---|---|
| Numeric | 0, 1, -1, max, max+1, NaN/Infinity, floating-point cents |
| Collection | empty, one, many, duplicate, ordering-dependent |
| String | empty, whitespace-only, unicode/emoji, length limit + 1, injection payload |
| Time | epoch, DST shift, leap day, timezone-crossing, expired-by-1s |
| Optional | null, undefined, missing key, explicit null vs absent |

Parametrize the table; do not copy-paste six near-identical tests.

## Structure

```js
it('excludes refunded items from the order total', () => {
  // arrange — one intent per test, factories not fixtures
  const order = orderFactory({ items: [item({ cents: 1000 }), item({ cents: 500, refunded: true })] })

  // act — exactly one call under test
  const total = getTotal(order)

  // assert — on the value, with a specific expectation
  expect(total).toBe(1000)
})
```

## Hard rules

- **One reason to fail per test.** Multiple unrelated assertions = a test whose failure is ambiguous.
- **Assert on values, not on truthiness.** `expect(x).toBe(1000)` — never `expect(x).toBeTruthy()`.
- **Never assert that a mock was called** as the only assertion. That tests your wiring, not behavior.
- **Mock at the boundary only** (network, clock, filesystem, randomness). Mocking your own module under test makes the test tautological.
- **No conditionals or loops around assertions.** A test with an `if` can silently assert nothing.
- **No shared mutable state between tests.** Each test must pass when run alone and in a shuffled order (`--shuffle` / `-p no:randomly` off).
- **Deterministic by construction**: fake the clock, seed the RNG, freeze IDs.

## Framework notes

- **Vitest/Jest**: prefer `toStrictEqual` over `toEqual`; `vi.useFakeTimers()`; MSW for fetch,
  never a hand-rolled `global.fetch = vi.fn()` that drifts from the real contract.
- **pytest**: `@pytest.mark.parametrize` for the boundary table; fixtures with explicit scope;
  `freezegun` for time; avoid `autouse` fixtures that hide setup.
- **Go**: table-driven with `t.Run(name, ...)`, `t.Parallel()` only when the case owns its state.

## Done means

Run the suite, paste the output, and report: `<n> passed, <n> failed`, plus which production
line each new test was proven against. No output, no claim.

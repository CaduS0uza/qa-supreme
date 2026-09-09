---
name: test-data-management
description: Design test data that makes tests fast, isolated and deterministic — factories over fixtures, per-test tenancy, frozen clocks, seeded randomness, and cleanup strategy. Use when tests interfere with each other, depend on a shared seed database, or fail only in CI.
---

# Test Data Management

Most flake and most false positives trace back to data: shared rows, leftover state, a clock
that moved, an ID that collided.

## Factories, not fixtures

A fixture file is a snapshot of assumptions that rot. A factory is a function with defaults
and overrides — the test states only what it cares about:

```ts
const user = userFactory({ plan: 'pro' })              // everything else is a sane default
const order = orderFactory({ user, items: [item({ cents: 1000 })] })
```

Read the test and you see exactly which fields drive the assertion. That is the point.

## Isolation ladder (pick the highest rung you can afford)

1. **In-memory / pure** — no shared state at all.
2. **Transaction per test**, rolled back after. Fast, total isolation, no cleanup code.
3. **Namespace per test** — unique tenant/org/prefix per test, parallel-safe.
4. **Truncate between tests** — slow, order-sensitive, last resort.
5. **Shared seeded database** — where flake is born. Migrate away.

Parallel workers each need their own namespace or their own schema. A worker id in the tenant
name (`tenant-w${process.env.TEST_WORKER_INDEX}`) is usually enough.

## Determinism

- **Clock**: inject it. `vi.setSystemTime`, `freezegun`, or a `Clock` port. Never `new Date()`
  inside code under test without a seam. Test the month-end and DST cases explicitly.
- **Randomness**: seed it, and assert on the seeded output.
- **IDs**: deterministic in tests (`uuid('order', 1)`), so failures are readable and diffs stable.
- **Ordering**: never assume database return order. Assert on sets, or order explicitly.

## Sensitive data

Never copy production data into a test environment without anonymization — it is a breach
waiting for a screenshot. Generate realistic-looking data instead (`@faker-js/faker`,
`factory_boy`, `gofakeit`), seeded so it is reproducible.

## Cleanup

Prefer strategies that cannot leak: rollback, ephemeral namespace, containerized database per
run. If you must delete, do it in a fixture teardown that runs even when the test fails, and
verify the teardown ran — a silent teardown failure looks exactly like a flaky test tomorrow.

---
name: database-testing
description: Test the data layer — migrations forward and back, constraints, transactions, tenant scoping in queries, and the row-level policies that decide who sees what. Use when the change touches schema, migrations, queries, RLS policies, or when data integrity is the risk.
---

# Database Testing

Application bugs are annoying. Data bugs are permanent: by the time you find them, the wrong rows
have been wrong for weeks and there is no rollback for that.

## Migrations

Every migration is tested in three directions, on a copy of production-shaped data — never on an
empty schema, where every migration passes:

1. **Forward** on a database with real volume and real edge rows (nulls, legacy encodings, the
   row created before the column existed).
2. **Backward**, or a written forward-fix plan if the migration is genuinely irreversible. "We
   won't need to roll back" is not a plan.
3. **Both at once**: the old code against the new schema. Deploys are not atomic, so for a window
   the previous version is talking to the migrated database. That window is where the incident lives.

Additive first (add column nullable → backfill → start writing → make required → drop old) is what
makes that window safe. Test each step as its own deploy.

```sql
-- the backfill nobody tests: does it terminate, and does it lock the table?
EXPLAIN (ANALYZE, BUFFERS) UPDATE orders SET total_cents = ROUND(total * 100) WHERE total_cents IS NULL;
```

## Constraints are tests that run in production

Prefer a constraint over a test where you can, then test that the constraint exists:

- `NOT NULL`, `UNIQUE`, foreign keys with the right `ON DELETE`, `CHECK (amount_cents >= 0)`.
- Try to insert the violating row and assert the database refuses it. A constraint nobody tested
  has a real chance of never having been applied.
- Assert the index that the hot query depends on exists — a dropped index is a silent outage.

## Tenant scoping and row-level security

The highest-value data test in a multi-tenant product:

```sql
SET request.jwt.claims = '{"sub":"user-b","tenant":"globex"}';
SELECT count(*) FROM orders WHERE tenant = 'acme';   -- must be 0, not "the app filters it"
```

Test the policy at the database, not through the app: an ORM filter is one forgotten `where`
away from a leak, and the policy is the layer that survives that mistake. Prove each policy with
`mutation-proof` — drop it and confirm the test goes red.

## Transactions and concurrency

- Multi-step writes are one transaction; assert that a failure in the middle leaves **nothing**.
- Two clients writing the same row: exactly one wins, the loser gets a coherent error (test with
  two connections, not two sequential calls).
- Test the isolation level you actually run in — read-committed and serializable behave differently
  under exactly the interleaving that will happen in production.
- Deadlock path: acquire in a fixed order, and test that the retry converges.

## Test data

Rolled-back transaction per test, or a namespace per worker (`test-data-management`). Never a
shared seed database — that is where order-dependent flake is born.

## Done means

Migration tested in all three directions with timings on production-shaped volume, constraints
proven by rejected inserts, scoping proven by a query that returns zero rows for the wrong tenant.

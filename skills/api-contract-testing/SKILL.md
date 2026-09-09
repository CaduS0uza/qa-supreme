---
name: api-contract-testing
description: Test HTTP/GraphQL APIs and the contracts between services — status codes, schema shape, authz, idempotency, pagination, error bodies — with Supertest, httpx, RestAssured, or Pact. Use when asked to test an endpoint, a backend route, a webhook, or an integration between services.
---

# API & Contract Testing

The integration level is where most real bugs live and where tests are cheapest per bug
caught. Spend here before spending on E2E.

## The seven questions every endpoint must answer

Write one test per row. An endpoint without rows 3, 4 and 5 is untested, whatever the
coverage report says.

| # | Question | Typical assertion |
|---|---|---|
| 1 | Happy path shape | 200 + schema match (not just a status code) |
| 2 | Validation | 400 with a field-level error body, not a 500 |
| 3 | **Authentication** | no token / expired token / token for a deleted user -> 401 |
| 4 | **Authorization** | valid token of user B against user A's resource -> 404 or 403, never 200 |
| 5 | **Tenant scoping** | list endpoints return only the caller's tenant rows |
| 6 | Idempotency & retries | same request twice -> one side effect (charges, emails, rows) |
| 7 | Not-found & conflict | unknown id -> 404; duplicate create -> 409, not 500 |

Add pagination (first page, last page, beyond-last, bad cursor), rate limiting, and
content negotiation when they exist.

## Schema over field-picking

Assert the whole response shape, not two fields — a silently added `password_hash` in the
payload is a leak your `expect(res.body.id)` will never catch.

```js
// zod / ajv / pydantic — pick the project's validator
expect(() => UserResponse.parse(res.body)).not.toThrow()
expect(Object.keys(res.body).sort()).toEqual(['createdAt', 'email', 'id', 'name'])
```

## Real data path

Hit a real database (containerized, migrated, seeded per test) — mocking your own
repository turns an integration test into a slow unit test. Mock only third parties, and
mock them with a recorded contract (MSW, WireMock, VCR), never an ad-hoc stub that returns
a shape the vendor never sends.

## Consumer-driven contracts (Pact)

Use when two services deploy independently:

1. Consumer test declares the interaction and generates a pact file.
2. Provider verifies the pact in **its own** CI against a real provider state.
3. Broker gates deploy: provider cannot ship while a consumer pact is unverified.

Without step 3 the contract is decoration. Say so explicitly if the broker is missing.

## Webhooks

- Signature verification: valid, tampered body, replayed timestamp, wrong secret.
- Idempotency: same event id twice -> one effect. This is a P0 in every payment system.
- Out-of-order delivery: `updated` before `created`.

## Hard rules

- Never assert only the status code. `200` with a wrong body is the most common silent bug.
- Never share auth state across tests without proving the scoping test still isolates users.
- Time-sensitive endpoints: control the clock server-side (test seam), do not `sleep`.
- Every test creates its own data and cleans up, or runs inside a rolled-back transaction.

## Done means

Runner output pasted, the seven questions answered per endpoint (or explicitly marked N/A),
and every authz test proven to fail when the guard is removed (`mutation-proof`).

---
name: chaos-resilience
description: Test how the system behaves when its dependencies fail — timeouts, 500s, slow networks, partial outages, retries and idempotency. Use when asked about resilience, failure modes, error handling, or "what happens if the payment provider is down".
---

# Chaos & Resilience

Every dependency will fail. The only question is whether your product degrades or corrupts.

## Failure injection at the boundary

Start in tests, not in production. Playwright and MSW can break any dependency deterministically:

```ts
await page.route('**/api/payments/**', route => route.fulfill({ status: 503, body: '{"error":"unavailable"}' }))
await page.route('**/api/products', route => route.abort('failed'))                    // network dead
await page.route('**/api/search', async route => { await new Promise(r => setTimeout(r, 12000)); route.continue() })  // slow
```

## The failure matrix

For each external dependency (payment, email, storage, auth provider, search, queue, third-party API):

| Failure | Expected behavior | Never acceptable |
|---|---|---|
| Timeout | bounded wait, user told, retry offered | infinite spinner |
| 500 | actionable error, state preserved | white screen, lost form data |
| 429 | backoff with jitter, queued | hammering the provider |
| Partial success | idempotent retry converges to one effect | double charge, duplicate email |
| Slow (10s+) | loading state, cancel option | frozen UI, main thread blocked |
| Dead entirely | degraded mode or clear outage message | cascading failure of unrelated features |

## Non-negotiable properties

- **Timeouts everywhere.** A request without a timeout is an outage waiting for a slow dependency.
- **Idempotency keys** on every write that can be retried. Test the retry explicitly.
- **Backoff with jitter.** Synchronized retries are a self-inflicted DDoS.
- **Circuit breaker** on repeated failures, with a tested half-open recovery.
- **No data corruption on partial failure**: either the whole transaction or none of it.
- **The user always learns something true.** "Something went wrong" with no state is a defect.

## Beyond the test suite

Game days on staging with real infrastructure faults (kill a pod, sever the database, fill the
disk) belong to SRE, in a rehearsed window, with a rollback path and an owner watching. Never
inject faults into production traffic on your own initiative — that is an operational decision
with blast radius far beyond QA.

## Output

```
DEPENDENCY payments
  timeout 12s      -> spinner never resolves, no error shown          FAIL  checkout.tsx:120
  503              -> error shown, cart preserved, retry works        PASS
  retry after 500  -> second charge created                           FAIL  charges.ts:88 (no idempotency key)
```

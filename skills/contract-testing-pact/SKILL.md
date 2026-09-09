---
name: contract-testing-pact
description: Set up consumer-driven contract testing between services with Pact so independently deployed services cannot break each other. Use when working on microservices or a BFF, when cross-service integration tests are slow and brittle, or when asked how to test a service boundary.
---

# Contract Testing

End-to-end tests across services are slow, flaky and owned by nobody. Contracts move the check
to each side of the boundary, where it is fast and owned.

## The loop

1. **Consumer** writes a test against a mock provider, declaring exactly the requests it makes
   and the responses it needs. This generates a pact file.
2. The pact is published to a **broker**, tagged with the consumer version and branch.
3. **Provider** verifies every pact against a real running provider with seeded provider states.
4. The broker's **can-i-deploy** check gates both pipelines.

Without step 4 the contract is documentation. Say so explicitly if the broker is missing — a
team believing it has contract safety without deployment gating is worse off than a team that
knows it has none.

```js
// consumer
await provider.addInteraction({
  state: 'an order 42 exists for tenant acme',
  uponReceiving: 'a request for order 42',
  withRequest: { method: 'GET', path: '/orders/42', headers: { Authorization: like('Bearer x') } },
  willRespondWith: { status: 200, body: { id: like(42), total: like(1000), status: term({ matcher: 'paid|pending', generate: 'paid' }) } },
})
```

```bash
# provider CI
pact-provider-verifier --provider-base-url=http://localhost:8080 --provider-states-setup-url=/_pact/state
pact-broker can-i-deploy --pacticipant orders-api --version $SHA --to-environment production
```

## Rules that keep contracts useful

- **Match on shape, not on values** (`like`, `term`, `eachLike`). A contract pinned to literal
  values fails on every seed change and teaches the team to ignore it.
- **Only what the consumer actually uses.** Declaring the whole response makes the provider
  unable to evolve; that flexibility is the entire point.
- **Provider states are real setup**, not mocks: the provider must genuinely be in that state.
- **Contracts do not replace the provider's own tests.** They prove compatibility, not correctness.
- One pact per consumer-provider pair, versioned with the consumer's commit.

## When not to use it

A single deployable, or two services always deployed together: use integration tests, they are
simpler. Contracts pay off exactly when deployment schedules are independent.

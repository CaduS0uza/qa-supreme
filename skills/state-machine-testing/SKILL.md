---
name: state-machine-testing
description: Test stateful flows exhaustively by modeling states and transitions — checkout, onboarding, subscription lifecycle, order status — covering every valid transition and rejecting every invalid one. Use for multi-step flows, wizards, status fields, or anywhere "it got stuck in a weird state" happens.
---

# State Machine Testing

Any entity with a `status` column is a state machine, whether or not anyone drew it. The bugs
live in the transitions nobody drew.

## Model first

```
draft --submit--> pending --approve--> active --cancel--> cancelled
                     |                   |
                   reject             expire
                     v                   v
                 rejected            expired
```

List every state and every event. Then build the transition table, including the cells that must
be refused:

| From \ Event | submit | approve | cancel | expire |
|---|---|---|---|---|
| draft | pending | **reject** | **reject** | **reject** |
| pending | **reject** | active | cancelled | **reject** |
| active | **reject** | **reject** | cancelled | expired |
| cancelled | **reject** | **reject** | **reject** | **reject** |

**The bold cells are the tests nobody writes and the bugs everybody ships.** Approving a
cancelled order, cancelling twice, submitting a draft twice from two tabs — each is one cell.

## Coverage targets, in order

1. **Every valid transition** — one test each, asserting the new state *and* its side effects.
2. **Every invalid transition** — asserted to be refused, with the state unchanged afterwards.
3. **Every terminal state** — no event escapes it.
4. **Idempotency** — the same event twice produces one effect (see `chaos-resilience`).
5. **Concurrency** — the same event from two clients simultaneously; exactly one wins, and the
   loser gets a coherent error rather than a corrupted row.

## Generate rather than hand-write

```ts
for (const [from, events] of Object.entries(TRANSITIONS)) {
  for (const [event, expected] of Object.entries(events)) {
    test(`${from} + ${event} -> ${expected ?? 'rejected'}`, async () => {
      const order = await seedOrderInState(from)
      const res = await api.post(`/orders/${order.id}/${event}`)
      if (expected) { expect(res.status).toBe(200); expect(await stateOf(order.id)).toBe(expected) }
      else { expect(res.status).toBe(409); expect(await stateOf(order.id)).toBe(from) }
    })
  }
}
```

The table is the specification, the tests are generated from it, and a new state is one row —
not twelve copy-pasted tests.

## Property-based extension

For deep flows, random walks find sequences no human enumerates: apply random valid events and
assert the invariants hold at every step (fast-check, Hypothesis). Invariants beat expected
values here — "a cancelled order never has a charge created afterwards" holds for every path.

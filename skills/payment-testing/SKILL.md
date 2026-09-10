---
name: payment-testing
description: Test checkout, charges, refunds and subscriptions without ever creating a real charge — provider sandboxes, the decline matrix, webhook idempotency, and the money invariants that must never break. Use when the change touches payment, billing, pricing, refunds, plans, or anything that moves an amount.
---

# Payment Testing

Every other defect costs trust. This one costs money, twice: once to the customer and once to
whoever refunds it. Payment code is P0 by definition — `risk-map` never has to think about it.

## Never test against live keys

`sk_live_*` in a test environment is an incident waiting for a CI run. Use the provider sandbox
(Stripe test mode, PagSeguro sandbox, Mercado Pago test users), seeded per environment, and make
the suite fail loudly if a live key is ever present:

```js
expect(process.env.STRIPE_KEY, 'live key in a test run').toMatch(/^sk_test_/)
```

## The decline matrix

Test the failures, not the happy path — the happy path is the one everyone already checked:

| Case | Provider test card | The product must |
|---|---|---|
| Approved | `4242 4242 4242 4242` | create exactly one charge and one order |
| Generic decline | `4000 0000 0000 0002` | show why, keep the cart, allow retry |
| Insufficient funds | `4000 0000 0000 9995` | distinguish from a generic decline |
| Expired card | `4000 0000 0000 0069` | ask for a new card, not "try again later" |
| Wrong CVC | `4000 0000 0000 0127` | flag the field, not the whole form |
| Requires 3DS | `4000 0025 0000 3155` | complete the challenge, and handle abandoning it |
| Fraud block | `4100 0000 0000 0019` | fail closed, never create the order |

The abandoned-3DS path is the classic silent bug: the customer closes the challenge window and
the product is left holding a pending order it never resolves.

## Money invariants (assert these, always)

- **Integer cents, never floats.** `0.1 + 0.2 !== 0.3` is a rounding bug with a refund attached.
  Assert the stored type as well as the value.
- **One payment, one charge.** No path — retry, double-click, refresh, back button, duplicate
  webhook — produces two charges. Test the double-click explicitly; users double-click.
- **Total = sum of parts.** Items + shipping + tax − discount, asserted end to end, with a
  discount larger than the subtotal (must clamp to zero, never negative).
- **Currency is never assumed.** Amount and currency travel together; a BRL amount displayed as
  USD is a 5× error.
- **Refund ≤ captured**, partial refunds sum to no more than the charge, and a refunded order
  cannot be refunded again.
- **State machine is closed.** Use `state-machine-testing`: pending → paid → refunded, and every
  invalid transition refused (approving a cancelled order, capturing twice).

## Webhooks are the real risk

Providers retry. Networks duplicate. Order of delivery is not guaranteed.

- Same event id twice → **one** effect. This is the single most valuable payment test you can write.
- Signature verification: valid, tampered body, replayed timestamp, wrong secret → rejected.
- Out-of-order: `payment_succeeded` arriving before `checkout_completed`.
- Unknown event type → 200 and ignored, never a 500 that makes the provider retry forever.
- The idempotency key is written **in the same transaction** as the effect, not after it.

## Reconciliation

The strongest test in the whole area: after a batch of simulated activity, the sum of charges in
your database equals the sum in the provider's. Run it nightly against sandbox data. It catches
the class of bug no unit test sees — the one where your record and the money disagree.

## Done means

The decline matrix run with output pasted, the duplicate-webhook test proven with `mutation-proof`,
and an explicit line saying no live key was in scope.

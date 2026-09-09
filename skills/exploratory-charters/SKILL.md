---
name: exploratory-charters
description: Run session-based exploratory testing with time-boxed charters, heuristics and structured notes — the human/agent judgment layer that scripted automation cannot replace. Use before a release, on a new feature, or when asked to "just test it and see what breaks".
---

# Exploratory Charters

Automation checks what you already thought of. Exploration finds what you did not. It is not
random clicking: it is a time-boxed investigation with a stated mission and a written trail.

## The charter

```
CHARTER   Explore the checkout with expired and declined cards
           to discover error-handling and state-recovery defects.
TIMEBOX   45 minutes
SETUP     staging, seeded tenant `acme`, Stripe test cards
```

One mission per charter. When you find something outside the mission, note it and continue —
that is the discipline that keeps a session from dissolving.

## Heuristics to attack with

- **Boundaries**: 0, 1, max, max+1, empty, huge, negative, unicode, emoji.
- **Interruption**: refresh mid-flow, back button, duplicate tab, close and reopen, lose network.
- **Sequence**: do things out of order — pay before choosing shipping, submit twice fast.
- **Identity**: different role, expired session, two tabs as two users, logged out mid-flow.
- **Time**: leave a form open for an hour, cross midnight, set the clock forward.
- **Data**: the same name twice, a deleted item still in the cart, a stale link.
- **CRUD symmetry**: create, read, update, delete, then read again — most bugs live in the last step.
- **Follow the money**: anything that charges, refunds, or changes a plan gets double attention.

## Notes as you go (SBTM)

Record continuously, not at the end:

```
14:02 setup done, tenant acme, card 4000000000000002 (declined)
14:09 BUG? declined card leaves the cart empty but the order shows as pending in /orders
14:14 confirmed, reproduced twice — screenshot 3, request id req_8812
14:20 QUESTION should a pending order be cancellable by the user?
14:31 covered: decline, expiry, 3DS challenge. NOT covered: partial refund (no test data)
```

Tag lines as BUG, QUESTION, IDEA, RISK, SETUP. The session report is these notes plus a one-line
verdict — nothing needs to be rewritten into prose.

## Session report

```
CHARTER   checkout error handling      TIMEBOX 45m (used 38m)
COVERED   decline, expired, 3DS, network drop mid-payment
NOT       partial refunds (blocked: no test data), Apple Pay (no device)
BUGS      2 confirmed (1 P0: pending order created for a declined card), 1 unconfirmed
RISK      the retry path is untested by the automated suite — added to risk register
```

Feed every confirmed bug to `bug-repro`, and every recurring class of finding into an automated
test so the next session explores new ground instead of the same ground.

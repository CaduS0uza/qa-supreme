---
name: root-cause-protocol
description: Find the actual cause of a failure before changing any code — read the error, reproduce, bisect, form and test one hypothesis at a time. Use for any failing test, production incident, or unexplained behavior, especially when under time pressure.
---

# Root Cause Protocol

```
NO FIX WITHOUT A NAMED CAUSE.
```

Guess-and-check produces fixes that work by accident and break by surprise. Under pressure the
protocol is faster than thrashing, because thrashing has no end condition.

## Phase 1 — Read

Read the **entire** error: message, stack, cause chain, line numbers, request id, exit code.
Most stack traces name the file and line of the actual problem, and most rushed engineers skip
past them. Quote the relevant frame before you theorize.

## Phase 2 — Reproduce

Reproduce deterministically, at the smallest scale (see `bug-repro`). Record the exact command.
Intermittent? Amplify it (`--repeat-each`, load, parallelism) until the rate is measurable —
you need a rate to prove the fix later.

## Phase 3 — Locate

- **Bisect in time**: `git bisect run <command>` — the fastest tool in this entire skill set
  when a thing used to work.
- **Bisect in space**: disable half the input, half the config, half the middleware.
- **Compare the working case**: same code, different environment/tenant/user — diff those, not
  the code.
- Instrument at the boundary between "state is correct" and "state is wrong". Binary search on
  the data flow, not on your intuition.

## Phase 4 — Hypothesize, one at a time

Write the hypothesis as a falsifiable sentence: *"the second webhook is processed because the
idempotency key is written after the charge, so a retry within the window sees no key."*

Then design the cheapest experiment that could **disprove** it. Change one thing. If the
experiment fails to disprove it, you have a cause. If you changed three things, you have nothing.

## Phase 5 — Fix at the cause, then prove

- Fix the cause, not the symptom. If you find yourself adding a retry, a `sleep`, a
  `try/except: pass`, or a null check to silence a crash — stop, you are at a symptom.
- Add the regression test **before** the fix if `bug-repro` has not already.
- Prove: the test was red, is now green, and the original reproduction no longer reproduces.
- Ask "where else does this pattern exist?" — the same cause usually has siblings. Grep for them.

## Output

```
SYMPTOM   duplicate charges, 3 reports this week
CAUSE     charges.ts:88 writes the idempotency key after the charge insert (non-atomic)
EVIDENCE  git bisect -> 8b1d07e; repro 2/2 within the 5s retry window; 0/20 after the fix
FIX       single transaction, key written first
SIBLINGS  same pattern in refunds.ts:41 (filed as a separate bug)
```

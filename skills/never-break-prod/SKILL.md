---
name: never-break-prod
description: The supreme protocol — seven gates that stand between a change and production, each one closed only by evidence. Use when the cost of a regression is high, when working on a system that is already live, before any release, or whenever the user says nothing can break in production. This is the skill that decides which other QA skills run, in what order, and refuses to hand back work that has not been proven.
---

# Never Break Prod

Every other skill in this repository makes a thing. This one is responsible for the **outcome**:
that the change reaches production without breaking what already worked. It is the protocol you
run when "we think it's fine" is not an acceptable answer.

## The execution contract

Every gate item carries one of four states. Nothing else counts, and reading, delegating, or a
tool failing is never proof:

| State | Means |
|---|---|
| `PENDING` | not attempted yet — never a final state |
| `PROVEN` | evidence exists, from this build, in this session |
| `CLEARED` | evidence that the condition does not apply here (with the evidence) |
| `UNPROVEN` | attempted, and the evidence could not be obtained — this is a finding |

Before returning any verdict, resolve every `PENDING`. Count only `PROVEN` and `CLEARED`.
**An `UNPROVEN` blocking item is a NO-SHIP**, exactly like a failure — the difference between
"it works" and "we could not tell" is the difference that kills production.

## The journal (context is volatile, disk is not)

Create `.qa-supreme/state.md` before anything else and write to it continuously — after every
two investigative steps, and after every gate. A long QA session outlives the model's context;
what is not on disk did not happen.

```markdown
## <date> — <change under test>
GATE 3 baseline      PROVEN   `npm test` -> 248 passed, 0 failed, sha 8b1d07e
GATE 4 mutation      UNPROVEN could not break charge.ts:88 without breaking the build — see note
DECISION             kept the retry in webhook handler; alternative (queue) rejected: no infra
```

## The seven gates

Run in order. A gate that fails stops the line — later gates report noise on a broken base.

### Gate 1 · Know what breaking would cost
Run `risk-map` on the change, not on the repository. Name the money paths, the auth and tenant
boundaries, and the irreversible operations the diff can reach. **If the change touches none of
them, say so explicitly and drop to a lighter protocol** — over-testing a copy change is how
teams learn to skip the protocol entirely.

### Gate 2 · Reproduce before you touch anything
Fixing a bug? `bug-repro` first: minimal steps, then a test that is red **because of the defect**.
Classification comes after reproduction, never before — an early label poisons everything downstream.
Building a feature? Write the failing test first (`unit-test-authoring`, `api-contract-testing`).

### Gate 3 · Baseline the current truth
Run the suite **before** your change and record the exact output. Without a baseline you cannot
tell a regression from something that was already broken, and you will spend the day proving the
wrong thing. Record: command, counts, duration, commit sha.

### Gate 4 · Prove the tests can fail
`mutation-proof` on every test that guards a P0 path. Break the production line, confirm red,
restore, confirm the tree is clean (`git diff --exit-code`). A test that survives its own
mutation is deleted or fixed — never counted.

### Gate 5 · Judge what you did not write
`false-positive-hunter` over the changed tests and over the suite that claims to protect the
touched code. Zero P0 findings is the bar. A suite full of tests that cannot fail is worse than
an empty one, because it produces confidence.

### Gate 6 · Exercise it like a user
`autonomous-exploration` against the running app — every reachable control clicked, console
errors and failed requests collected, a11y and security regressions checked. This is the gate
that catches what nobody wrote a test for, which is most of what actually breaks.

### Gate 7 · Decide, with the rollback in hand
`release-gate`. Every row evidenced, waivers named and owned. **Plus the two rows people skip:**
the rollback command, tested, with a named owner; and the migration's reverse path or the
forward-fix plan. Then say the verdict in one sentence.

## Rules that hold in every gate

1. **Never change an expected value to make a test pass.** Classify first: product regression,
   stale requirement, or timing. Only the second one is allowed to change the expectation, and it
   changes with a note saying who decided the requirement moved.
2. **Three attempts, then escalate.** Same failure three times means your model of the problem is
   wrong. Stop fixing, go back to `root-cause-protocol`, and say what you do not understand.
3. **Never repeat an action that failed.** The next attempt must differ in a named way.
4. **Never retry a non-idempotent action** to recover from an unclear UI state — no re-submitting,
   re-charging, re-sending, re-deleting. Re-establish clean state or stop and report.
5. **Retries and quarantine preserve the first failure.** A retry that turns an initial failure
   into a silent pass has destroyed the only evidence that mattered.
6. **Coverage is discovery, never proof.** An executed line with no oracle proves nothing.
7. **Separate what a test is worth from whether it passed.** `KEEP / ADD / UPDATE / MERGE / DELETE`
   is a portfolio decision; `PASS / FAIL / BLOCKED / UNPROVEN / QUARANTINED` is an execution fact.
   Conflating them is how a suite silently loses its regression guards.
8. **Nothing green is claimed from memory.** If the output is not in this session, re-run it.

## When the protocol says stop

Say it in one sentence, name the gate, name the owner, and stop. Do not soften it, do not offer
a "probably fine", and do not let a deadline edit the evidence. The protocol reports; a human
decides to override and owns that decision in writing.

```
NEVER-BREAK-PROD  change: webhook retry handling  build 8b1d07e
  1 risk mapped          PROVEN    2 P0 paths touched: charge, refund
  2 reproduced           PROVEN    tests/api/orders.spec.ts:88 red for the right reason
  3 baseline             PROVEN    248 passed / 0 failed before the change
  4 mutation proof       PROVEN    3/3 P0 tests died on mutation, tree restored clean
  5 false positives      PROVEN    0 P0 in 31 changed tests
  6 exploration          PROVEN    40 clicks, 5 states, 0 uncaught exceptions
  7 release gate         UNPROVEN  rollback never tested on this service
VERDICT: NO-SHIP — gate 7. Owner: on-call. One command to test, then re-run this gate.
```

## What this protocol is not

It is not a substitute for a human owning the release. It is the thing that makes sure the human
is deciding with facts instead of vibes.

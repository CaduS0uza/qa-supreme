---
name: test-strategy
description: Turn a risk register into a concrete, decision-complete test plan — which level tests what, what is deliberately NOT tested, and what the exit criteria are. Use after risk-map, when a team asks for a QA strategy, or when a suite grew without a rationale.
---

# Test Strategy

A strategy is a set of decisions, not a wish list. Every line answers "what do we do
Monday" and every omission is deliberate and written down.

## Level assignment

Assign each P0/P1 risk to the **cheapest level that can actually catch it**:

| Level | Catches | Cost | Use when |
|---|---|---|---|
| Unit | logic, branches, math, parsing | ~ms | the rule lives in one function |
| Integration / API | contracts, persistence, authz, wiring | ~100ms | the risk crosses a boundary |
| E2E | the user's actual path through real UI | ~seconds | the risk only exists end to end |
| Non-functional | a11y, perf, security regressions | varies | the risk is a property, not a path |

Default split for a web product: 70/20/10 by count, but **100% of P0 risks get at least one
test at the level that can catch them** — that rule outranks the ratio.

## The NOT-testing list (mandatory section)

Name at least three things you will not test and why. Examples: third-party SDK internals,
generated code, styling that no assertion can meaningfully pin, admin tooling used by two
people. A strategy without exclusions is a fantasy.

## Procedure

1. Load `.qa-supreme/risk-register.md` (run `risk-map` first if absent).
2. For each P0/P1: assign level, name the specific assertion that proves it, name the owner
   skill (`unit-test-authoring`, `api-contract-testing`, `e2e-authoring`, `security-regression`...).
3. Define **test data**: factories over fixtures, one seeded tenant per test, no shared
   mutable state, deterministic clock and IDs.
4. Define **environments**: where each level runs, what is mocked (see `ci-wiring`).
5. Define **exit criteria** as booleans, not adjectives:
   - every P0 has a passing test that has been mutation-proven
   - flake rate on the E2E suite < 1% over the last 20 CI runs
   - no test in the suite is on the `false-positive-hunter` P0 list
6. Write to `.qa-supreme/test-strategy.md` and print the summary table only.

## Output

```markdown
| Risk | Tier | Level | Assertion that proves it | Skill | Status |
|---|---|---|---|---|---|
| double charge on retry | P0 | integration | second webhook with same id -> 1 charge row | api-contract-testing | todo |
```

## Rules

- Never propose a level whose infrastructure does not exist without also proposing the setup task.
- Never write "increase coverage to N%" as an exit criterion. Coverage is a symptom (see `coverage-ratchet`).
- Strategy fits on one screen. Longer means undecided.

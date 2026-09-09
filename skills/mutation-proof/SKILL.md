---
name: mutation-proof
description: Prove that a test detects the bug it claims to prevent by deliberately breaking the production code and confirming the test goes red. Use before merging any new test, after fixing a bug, or when asked whether a suite is trustworthy. Includes running real mutation testing tools (Stryker, mutmut, go-mutesting).
---

# Mutation Proof

Coverage says the line ran. Mutation says the test would have **noticed**. Only the second
is quality.

## Level 1 — Targeted proof (always, per test, seconds)

For each new or suspect test:

1. Identify the exact production line the test exists to defend.
2. Apply one mutation to it:

| Original | Mutation |
|---|---|
| `if (a > b)` | `if (a >= b)` |
| `return total` | `return 0` |
| `if (!user.isAdmin) throw` | delete the guard |
| `status = 402` | `status = 200` |
| `items.filter(x => !x.refunded)` | drop the filter |

3. Run **only that test**. Record the result.
4. **Red** -> restore the code, the test is proven, note the mutation in the commit message.
   **Green** -> the test is a false positive. Fix the assertion, do not fix the mutation.
5. Restore the file and re-run to confirm you are back to a clean tree (`git diff --exit-code`).

Never leave a mutation behind. Verify with `git status` before finishing — a forgotten
mutation shipped to production is the one way this skill can hurt you.

## Level 2 — Tool-driven mutation testing (per module, minutes)

| Stack | Tool | Command |
|---|---|---|
| JS/TS | Stryker | `npx stryker run --mutate 'src/checkout/**/*.ts'` |
| Python | mutmut | `mutmut run --paths-to-mutate src/checkout` |
| Go | go-mutesting | `go-mutesting ./checkout/...` |
| Java | PIT | `mvn org.pitest:pitest-maven:mutationCoverage` |

**Scope it to P0 code only.** Whole-repo mutation runs are slow, noisy, and get switched off
within a week. Set a threshold on the P0 module and let the rest report without gating:

```jsonc
// stryker.conf.json
{ "mutate": ["src/checkout/**/*.ts"], "thresholds": { "high": 90, "low": 80, "break": 75 } }
```

## Reading the survivors

Each surviving mutant is a sentence: "we can change this behavior and nobody complains".
Triage into three buckets:

- **Real gap** -> write the missing assertion.
- **Equivalent mutant** (behaviorally identical, e.g. a swapped order in a commutative op)
  -> annotate and exclude with a comment naming why.
- **Dead code** -> the mutation survives because nothing depends on the line. Delete the line.

## Interaction with other skills

`unit-test-authoring`, `api-contract-testing` and `e2e-authoring` all end here. A test that
has not been through Level 1 does not count as done, and the orchestrator will not report it
as coverage.

## Output

```
PROVEN  tests/checkout.spec.ts:42  <- mutated charge.ts:88 (`>=` -> `>`)  -> 1 failed  ✓
UNPROVEN tests/cart.spec.ts:10     <- mutated cart.ts:31 (return 0)       -> 0 failed  ✗ false positive
Tree restored: git diff --exit-code -> clean
```

---
name: qa-triage
description: Entry point for any ambiguous quality request. Classifies the ask into one of six QA jobs, scopes it to the real risk surface, and routes to the right skill. Use when the request is vague ("improve our testing", "make this reliable", "QA this") or when several QA jobs are tangled in one sentence.
---

# QA Triage

Most quality requests arrive tangled: "the checkout is flaky and we have no tests and I
think there's a bug". Three jobs, three different skills, one wrong order away from waste.

## The six jobs

| Job | Signal | Route |
|---|---|---|
| **Decide** what to test | no suite, or suite with no rationale | `risk-map` → `test-strategy` |
| **Create** tests | feature exists, coverage missing | `unit-test-authoring` / `api-contract-testing` / `e2e-authoring` |
| **Judge** existing tests | suite exists, trust is low | `false-positive-hunter` → `mutation-proof` |
| **Stabilize** | tests pass sometimes | `flake-forensics` |
| **Diagnose** | something is broken | `root-cause-protocol` → `bug-repro` |
| **Gate** | a release decision is pending | `release-gate` |

## Procedure

1. **Split the ask.** Rewrite the request as one line per job. Show the list.
2. **Order by dependency, not by mention.** Diagnose before Create (a test written against
   broken behavior enshrines the bug). Judge before Create when a suite already exists
   (adding tests to a false-positive suite multiplies the lie). Gate last, always.
3. **Scope it.** Ask exactly one question if — and only if — the answer changes the route:
   - What is the blast radius: a diff, a feature, a service, the product?
   - Is there a deadline that forces triage over completeness?
4. **State the plan in three lines max**, then start job one. Do not narrate the rest.

## Anti-patterns this skill exists to prevent

- Writing tests before reproducing a reported bug — you encode the defect as expected.
- Chasing coverage % when the suite has never caught a regression.
- Stabilizing a flaky test that asserts nothing (delete it instead — see `false-positive-hunter`).
- Running every QA skill "to be thorough". Thoroughness is depth on the right target.

## Output

```
JOBS: <n>
1. <job> -> <skill>   [scope: <files/feature>]
2. ...
STARTING: <job 1>. Reason: <one clause>.
```

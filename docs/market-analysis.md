# What the market already built, and what it left open

Before writing a line of this repository's second version, we cloned and read the public QA
skill collections rather than their READMEs: **143 skills across six repositories**, 85 of them
QA-related. This is what they do well, what they miss, and what we took from each.

Nothing here was copied. Every skill in `skills/` is original text. Prior art is credited by name
because the ideas are theirs.

## The collections

| Source | Skills | What it is best at | Where it stops |
|---|---|---|---|
| [petrkindlmann/qa-skills](https://github.com/petrkindlmann/qa-skills) | 50 | the broadest taxonomy in existence — from payment and database to postmortems and synthetic monitoring | breadth over depth; nothing verifies the tests it produces |
| [voidmatcha/e2e-skills](https://github.com/voidmatcha/e2e-skills) | 6 | the sharpest thinking on false positives: an anti-pattern catalogue, a zero-P0 gate, a bounded auto-fix loop | Playwright/Cypress only, by design |
| [levnikolaevich/claude-code-skills](https://github.com/levnikolaevich/claude-code-skills) | 25 | audit rigour: an execution contract where every check is PROVEN, CLEARED or UNPROVEN | audits, does not execute a release |
| [fugazi/test-automation-skills-agents](https://github.com/fugazi/test-automation-skills-agents) | 10 | investigation as a discipline: a file-backed journal, classify-after-reproducing, ISTQB artefacts | single-failure scope |
| [JanSzewczyk/claude-plugins](https://github.com/JanSzewczyk/claude-plugins) | 38 | coverage gaps ranked by churn and branch, not by line percentage | tied to a Next.js stack |
| [anthropics/skills](https://github.com/anthropics/skills) | 20 | the reference for how a skill should be written | testing is one skill, not a discipline |

## What we took (as ideas, credited)

| Idea | From | Where it lives here |
|---|---|---|
| Four-state execution contract — `PROVEN` / `CLEARED` / `UNPROVEN` / `PENDING`, and "reading is not proof" | levnikolaevich | [`never-break-prod`](../skills/never-break-prod/SKILL.md) |
| The journal on disk: context is volatile, the filesystem is not; write findings every two steps | fugazi | `never-break-prod`, the agent's session state |
| Classify a failure **after** reproducing it, never before | fugazi | [`bug-repro`](../skills/bug-repro/SKILL.md), [`flake-forensics`](../skills/flake-forensics/SKILL.md) |
| A bounded auto-fix loop: three attempts, then escalate — never a fourth | voidmatcha | `never-break-prod` rule 2 |
| Never change an expected value to go green; classify the failure first | voidmatcha | `never-break-prod` rule 1 |
| Never replay a non-idempotent action to recover an unclear state | voidmatcha | `never-break-prod` rule 4 |
| Separate portfolio action (KEEP/ADD/DELETE) from execution status (PASS/FAIL/BLOCKED) | levnikolaevich | `never-break-prod` rule 7, [`regression-curation`](../skills/regression-curation/SKILL.md) |
| Rank coverage gaps by churn and branches, never by line percentage | JanSzewczyk | [`coverage-ratchet`](../skills/coverage-ratchet/SKILL.md), [`risk-map`](../skills/risk-map/SKILL.md) |
| A retry must preserve the first failure, not convert it into a silent pass | levnikolaevich | `flake-forensics`, the runner's retry counter |
| The taxonomy of QA domains worth covering at all | petrkindlmann | the five skills added in this pass |

## What none of them do

1. **Nothing verifies that a generated test can fail.** Mutation is mentioned; no collection makes
   it the gate a test must pass before it counts. Here it is [`mutation-proof`](../skills/mutation-proof/SKILL.md),
   and gate 4 of the protocol.
2. **Nothing owns the outcome.** Every collection is a set of capabilities; none says "these run,
   in this order, and here is what blocks a release". That is [`never-break-prod`](../skills/never-break-prod/SKILL.md).
3. **Nothing ships a runner.** All of them instruct an agent to write tests. None arrives with an
   executable that drives a real browser, clicks every control and returns a verdict. That is `runner/`.
4. **Nothing judges the controls themselves.** Clicking is treated as a means to run a scripted
   flow, never as an audit of whether each control does anything. The button report is ours.
5. **Nothing shows you the run.** Test output is text after the fact. The HUD, the transcript and
   the state graph exist because a QA you cannot watch is a QA you have to take on faith.

## The gaps we closed in this pass

Read against the widest taxonomy (petrkindlmann's 50), version 1 of this repository covered 26 of
its domains and added 6 the taxonomy lacked. Five domains were missing and mattered for products
that handle money and traffic, so they were written:

- [`payment-testing`](../skills/payment-testing/SKILL.md) — decline matrix, webhook idempotency, money invariants
- [`database-testing`](../skills/database-testing/SKILL.md) — migrations in three directions, constraints, tenant scoping at the database
- [`tracking-testing`](../skills/tracking-testing/SKILL.md) — pixel and conversion events asserted on the network request, consent gating, dedup ids
- [`transactional-email-testing`](../skills/transactional-email-testing/SKILL.md) — capture inbox, exactly-once, links exercised in a real browser
- [`environment-parity`](../skills/environment-parity/SKILL.md) — why "it worked in staging" keeps being true and irrelevant

## What we deliberately did not write

Metrics dashboards, shift-left advocacy, manual test-case management, QA postmortem templates,
compliance checklists, framework migration guides, synthetic monitoring, observability-driven
testing, service virtualisation, AI-feature testing. They exist in the collections above and are
covered better there. A skill that repeats what a neighbouring repository already does well makes
this one worse: it dilutes the thing that is actually different.

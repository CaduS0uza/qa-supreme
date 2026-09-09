<div align="center">

# QA Supreme

**A complete QA department for your coding agent.**
29 testing skills, an orchestrator agent that refuses to call anything green without proof,
and an autonomous runner that clicks every button in your app and counts each one on screen.

[![validate](https://github.com/CaduS0uza/qa-supreme/actions/workflows/validate.yml/badge.svg)](https://github.com/CaduS0uza/qa-supreme/actions/workflows/validate.yml)
[![license](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![skills](https://img.shields.io/badge/skills-29-blue.svg)](#the-skills)
[![action](https://github.com/CaduS0uza/qa-supreme/actions/workflows/example-action.yml/badge.svg)](#use-it-in-ci-one-step)
[![agents](https://img.shields.io/badge/works%20with-Claude%20Code%20·%20Codex%20·%20Cursor%20·%20Gemini%20CLI-8b5cf6.svg)](#install)

</div>

---

## Why this exists

Most QA skill collections are catalogues: a folder of markdown files, each telling an agent how
to write a kind of test. They all share the same blind spot — **nothing checks whether the tests
they produce can actually fail.**

A test that passes whether or not the code works is worse than no test. It is a lie that
compounds: it inflates coverage, it survives refactors, it gets cited in release meetings, and
it is silent on the day it matters.

QA Supreme is built around three laws instead of a file listing:

> **1. Risk before coverage.** Untested checkout is an incident. Untested `formatDate` is a rounding error.
>
> **2. A test that cannot fail is worse than no test.** Nothing enters the suite until it has been proven to go red against broken behavior.
>
> **3. No claim without fresh output.** "Should pass" and "looks correct" are not statuses. Command → output → verdict, or say nothing.

Everything here — the skills, the agent, the runner, the CI — exists to enforce those three.

---

## What you get

| | |
|---|---|
| 🧠 **1 orchestrator agent** | Routes any quality request to the right skill, holds session state, enforces the Evidence Contract, returns ship / no-ship |
| 📚 **29 skills** | Strategy, authoring, judgment, diagnosis, non-functional, process — every test type a senior QA owns |
| 🤖 **1 autonomous runner** | Playwright pipeline that crawls your whole app, clicks every control, and proves what it found |
| 🔍 **24-entry false-positive catalogue** | The tests that pass while your product is broken, and how to spot them |
| ✅ **Self-testing CI** | The runner is held to its own standard: a fixture with seeded defects it must keep finding |

---

## The autonomous runner

This is the part nobody else ships. Point it at any web app — SaaS, dashboard, landing page,
storefront — and it explores the whole thing on its own.

```bash
git clone https://github.com/CaduS0uza/qa-supreme && cd qa-supreme/runner
npm install && npx playwright install chromium

node bin/qa-supreme.mjs run --url http://localhost:3000                  # full pipeline
node bin/qa-supreme.mjs crawl --url http://localhost:3000 --headed --slowMo 120   # watch it work
```

**Behind a login? That is the normal case:**

```bash
node bin/qa-supreme.mjs login --url https://app.example.com \
  --login-url https://app.example.com/login --user qa@example.com --pass "$QA_PASSWORD"

node bin/qa-supreme.mjs run --url https://app.example.com --storage .qa-supreme/auth.json
```

The login form is detected automatically; override with `--user-selector` / `--pass-selector`
when the markup is unusual. Without credentials the pipeline **says so and stops** —
`authentication: target is behind a login` — instead of reporting an empty product. While a
session is active it also refuses to click its way out of it.

**Eight stages, in order, each gating the next:**

| # | Stage | What it does |
|---|---|---|
| 1 | `smoke` | is the build alive at all — 6 checks, seconds |
| 2 | `crawl` | **clicks every reachable control**, follows links, opens tabs, enters modals, maps the state graph |
| 3 | `forms` | every form submitted three ways: empty, junk, plausible |
| 4 | `console` | every exception, console error and failed request raised while the app was driven |
| 5 | `a11y` | WCAG 2.2 A/AA via axe-core, on every discovered state |
| 6 | `perf` | LCP, CLS, TTFB, payload — against explicit budgets |
| 7 | `visual` | pixelmatch baseline per state, diff image + exact pixel count |
| 8 | `security` | headers, cookie flags, client-side secrets, insecure forms |

**Every click is counted on screen.** A HUD is injected into the page — live click count, the
element being hit (flashed in green), queue depth, error count. In `--headed` mode you watch it.
In headless CI it lands in the screenshots and the video. The report carries a full click ledger:
every interaction, in order, with what it led to.

<div align="center">

```
▶ STAGE 2/8 · CRAWL  click every reachable control, follow every tab
   n1 http://localhost:8099/index.html  (17 interactive, depth 0)
   · +1 new controls revealed by "Add to cart"
   n2 http://localhost:8099/products.html  (6 interactive, depth 1)
   · +2 new controls revealed by "Filter"
   n3 http://localhost:8099/account.html  (3 interactive, depth 1)
   [  23] clicks performed
   [   3] states discovered
   [  12] transitions mapped
   [   3] guarded skips (destructive)
   [   0] click errors
   ▲ 11 controls did nothing observable (candidate dead buttons)
  ✔ PASS crawl · 9.2s

────────────────────────────────────────────────────
  VERDICT: NO-SHIP
  failing stages: console, a11y, security
────────────────────────────────────────────────────
```

</div>

Output: a self-contained `report.html` (no CDN, opens anywhere), `run.json` for machines,
screenshots per state, `*.diff.png` for visual changes, and **exit code 1 on NO-SHIP** so it
gates a pipeline directly.

The report opens with an **interactive state graph** — every state the crawler reached, every
transition, colour-coded by kind (navigation, new tab, in-place change), with the control that
caused it on hover. Click a state to see the screenshot the crawler saw there. Below it, the
click ledger: every interaction in order, with what it led to.

### Use it in CI, one step

```yaml
- uses: CaduS0uza/qa-supreme@v1
  with:
    url: http://localhost:3000
    user: qa@example.com
    password: ${{ secrets.QA_PASSWORD }}
    fail-on: no-ship        # or `never` while you build trust
```

Writes a stage table to the job summary, exposes `verdict` / `clicks` / `states` as outputs, and
uploads the full evidence as an artifact.

### Safety, by default

The crawler refuses to click anything whose label matches a destructive verb — delete, pay,
logout, publish, transfer, cancel subscription, in English and Portuguese. That guard is the
difference between exploration and an incident.

- Point it at **local, preview or staging**. Not production with real customer data.
- Use a **seeded, disposable account**.
- `data-qa-skip` on any element it must never touch.
- `--full-send` removes the guard. Only on an environment you can rebuild from scratch.

---

## Install

### As a Claude Code plugin

```
/plugin marketplace add CaduS0uza/qa-supreme
/plugin install qa-supreme
```

Gives you the `qa-supreme` agent and four commands: `/qa`, `/qa-explore`, `/qa-gate`,
`/qa-review-tests`.

### As portable skills (Codex, Cursor, Gemini CLI, Windsurf, any Agent Skills runtime)

```bash
npx skills add CaduS0uza/qa-supreme                     # everything
npx skills add CaduS0uza/qa-supreme false-positive-hunter mutation-proof risk-map   # or pick
```

Or vendor them directly — every skill is a self-contained `SKILL.md` with no runtime dependency:

```bash
git clone https://github.com/CaduS0uza/qa-supreme
cp -r qa-supreme/skills/* .claude/skills/       # or .cursor/skills, .agents/skills, ...
```

---

## The skills

### Decide what to test
| Skill | Use it when |
|---|---|
| [`qa-triage`](skills/qa-triage/SKILL.md) | the request is vague or tangles several QA jobs |
| [`risk-map`](skills/risk-map/SKILL.md) | "where do we start" — blast radius × likelihood × detectability |
| [`test-strategy`](skills/test-strategy/SKILL.md) | turning risk into a plan, including what you will **not** test |

### Create tests
| Skill | Use it when |
|---|---|
| [`unit-test-authoring`](skills/unit-test-authoring/SKILL.md) | Jest, Vitest, pytest, Go — red-first, boundary tables |
| [`api-contract-testing`](skills/api-contract-testing/SKILL.md) | endpoints, webhooks — the seven questions every endpoint must answer |
| [`e2e-authoring`](skills/e2e-authoring/SKILL.md) | Playwright / Cypress journeys that do not flake |
| [`state-machine-testing`](skills/state-machine-testing/SKILL.md) | anything with a status: checkout, onboarding, subscriptions |
| [`contract-testing-pact`](skills/contract-testing-pact/SKILL.md) | services that deploy independently |
| [`test-data-management`](skills/test-data-management/SKILL.md) | factories, isolation, frozen clocks, seeded randomness |

### Judge the tests you already have
| Skill | Use it when |
|---|---|
| [`false-positive-hunter`](skills/false-positive-hunter/SKILL.md) | **the highest-value audit on any inherited suite** |
| [`mutation-proof`](skills/mutation-proof/SKILL.md) | prove a test fails when the code breaks — targeted and tool-driven |
| [`coverage-ratchet`](skills/coverage-ratchet/SKILL.md) | coverage as a one-way floor on changed lines |
| [`regression-curation`](skills/regression-curation/SKILL.md) | the suite is slow, noisy, or nobody trusts it |

### Diagnose
| Skill | Use it when |
|---|---|
| [`root-cause-protocol`](skills/root-cause-protocol/SKILL.md) | anything is broken — no fix without a named cause |
| [`bug-repro`](skills/bug-repro/SKILL.md) | a vague report becomes a minimal repro and a red test |
| [`flake-forensics`](skills/flake-forensics/SKILL.md) | a test passes sometimes — eight root-cause families |
| [`exploratory-charters`](skills/exploratory-charters/SKILL.md) | time-boxed session-based hunting before a release |
| [`autonomous-exploration`](skills/autonomous-exploration/SKILL.md) | drive the runner: click everything, find dead buttons |

### Non-functional
| Skill | Use it when |
|---|---|
| [`a11y-audit`](skills/a11y-audit/SKILL.md) | WCAG 2.2 — automated sweep **plus** the manual two thirds |
| [`perf-budget`](skills/perf-budget/SKILL.md) | Core Web Vitals with budgets that fail the build |
| [`load-and-stress`](skills/load-and-stress/SKILL.md) | k6 load, stress, spike, soak, breakpoint |
| [`security-regression`](skills/security-regression/SKILL.md) | the authorization matrix, IDOR, headers, client secrets |
| [`chaos-resilience`](skills/chaos-resilience/SKILL.md) | what happens when a dependency dies |
| [`visual-regression`](skills/visual-regression/SKILL.md) | deterministic pixel baselines that do not cry wolf |
| [`responsive-mobile-testing`](skills/responsive-mobile-testing/SKILL.md) | breakpoints, touch targets, Detox / Appium |
| [`i18n-l10n-testing`](skills/i18n-l10n-testing/SKILL.md) | missing keys, RTL, plurals, timezones |

### Ship
| Skill | Use it when |
|---|---|
| [`smoke-and-sanity`](skills/smoke-and-sanity/SKILL.md) | the 60-second gate that decides if a build is worth testing |
| [`ci-wiring`](skills/ci-wiring/SKILL.md) | tiering, sharding, caching, artifacts, flake reporting |
| [`release-gate`](skills/release-gate/SKILL.md) | ship / no-ship with 12 evidenced rows |

---

## The Evidence Contract

Every skill ends the same way. Before any status claim, produce **command → output → verdict**:

| Claim | Required evidence |
|---|---|
| "tests pass" | full runner output, exit code, failure count |
| "bug fixed" | the regression test failing before, passing after |
| "coverage improved" | before/after ratchet numbers on changed lines |
| "not flaky anymore" | 20 consecutive green runs, or the root cause named |
| "safe to ship" | a completed release gate, every row evidenced |

If evidence is impossible, say so and downgrade the claim. Never upgrade a claim to fill a silence.

---

## This repository tests itself

`examples/demo-app/` is a fixture with deliberately seeded defects: a missing `alt`, a button
that throws, dead buttons, a destructive control, a modal, tab panels, a form with weak
validation. It also ships a real auth wall: `login.html` guards `dashboard.html` and `billing.html`.

CI runs the full pipeline against both halves and asserts, in
[`evals/assert-demo-findings.mjs`](evals/assert-demo-findings.mjs) and
[`evals/assert-auth-findings.mjs`](evals/assert-auth-findings.mjs), that every expected finding
is still found — including that the crawler produces **zero** click errors, never audits its own
HUD, never clicks its way out of a session, and reaches pages that only exist behind the login.

```
21/21 expectations met          # the public app: clicks, modal, tabs, dead buttons, a11y, security
8/8 auth expectations met       # the protected area: wall detected, login works, private pages reached
```

A pipeline that demands evidence from you and provides none about itself would be the largest
false positive in the repository.

```bash
node scripts/validate-skills.mjs   # frontmatter, naming, links, agent routing
node evals/assert-demo-findings.mjs .qa-out/run.json
```

---

## Prior art

QA Supreme stands on work published by others, and says so:

- [petrkindlmann/qa-skills](https://github.com/petrkindlmann/qa-skills) — the broadest QA skill catalogue for agent runtimes
- [voidmatcha/e2e-skills](https://github.com/voidmatcha/e2e-skills) — E2E anti-pattern taxonomy and false-positive framing
- [Playwright](https://playwright.dev) and [axe-core](https://github.com/dequelabs/axe-core) — the runner is built on both
- ISTQB test-type taxonomy, session-based test management (Bach/Bolton), and mutation testing literature

Everything in `skills/` and `runner/` is original text and code written for this repository.
Where a concept is borrowed, the source is named above rather than absorbed silently.

## Author

Built by **Carlos Eduardo** ([@CaduS0uza](https://github.com/CaduS0uza)).

## Contributing

New skills, new stages, better heuristics — all welcome. `CONTRIBUTING.md` has the bar every
skill must clear (it is short, and CI enforces most of it).

## License

MIT © [Carlos Eduardo](https://github.com/CaduS0uza)

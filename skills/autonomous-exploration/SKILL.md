---
name: autonomous-exploration
description: Drive the qa-supreme runner to click every reachable control of a web app, follow every link and tab, count each click on screen, and report dead buttons, broken states and click errors. Use when asked to "test the whole app", "click everything", "find dead buttons", "map the UI", or when there is no test suite at all and coverage must start somewhere.
---

# Autonomous Exploration

The fastest way to learn what an app actually does is to click all of it. This skill drives
the bundled runner (`runner/`), which performs a breadth-first exploration of every reachable
UI state and produces an evidence report.

## Run it

```bash
cd runner && npm install                 # first time only
node bin/qa-supreme.mjs run --url https://app.example.com          # full pipeline
node bin/qa-supreme.mjs crawl --url http://localhost:3000          # exploration only
node bin/qa-supreme.mjs crawl --url http://localhost:3000 --headed --slowMo 120   # watch it live
```

The on-screen HUD counts every click as it happens, flashes the element being hit, and shows
queue depth and error count — so a human watching, a screenshot, or a recorded video all
carry the same proof.

## Apps behind a login (most of them)

An unauthenticated run against a protected app explores the login page and reports an empty
product. The runner names that instead of pretending: smoke fails with `authentication —
target is behind a login`, and the run stops there rather than producing noise.

```bash
# log in once, keep the session
node bin/qa-supreme.mjs login --url https://app.example.com --login-url https://app.example.com/login \
  --user qa@example.com --pass "$QA_PASSWORD"

# every later run reuses it
node bin/qa-supreme.mjs run --url https://app.example.com --storage .qa-supreme/auth.json
```

The login form is found automatically (username/email + password + submit). When the markup
defeats the heuristics, name the fields: `--user-selector`, `--pass-selector`,
`--submit-selector`, `--success-selector`. Success is judged by the login form being gone, not
by a URL change — SPAs authenticate without navigating.

While a session is active the crawler also refuses to click anything that ends it (log out,
sign out), on top of the destructive-action guard. One stray click on "Sign out" would turn
every remaining state into the login page.

## What it produces

| Signal | Meaning | What you do with it |
|---|---|---|
| `clicks performed` | interactions actually executed | the coverage number nobody else reports |
| `states discovered` | distinct UI states reached | compare against the sitemap — gaps are unreachable UI |
| `transitions mapped` | control → destination edges | the app's real navigation graph |
| `no-op` controls | click produced no observable change | **candidate dead buttons — triage every one** |
| `click errors` | control refused a click in 4s | overlay traps, disabled-but-visible, z-index bugs |
| `guarded skips` | destructive and session-ending controls not clicked | verify the guard list matches your app |
| `clicks that needed a retry` | control was transiently covered | a rising number means overlay/timing problems |

## Triaging dead buttons

A `no-op` is not automatically a bug — it may be a no-change tab, an already-active state, or
a control whose effect is server-side only. For each one, answer: *what should a user expect
to happen?* If the answer is "something", you found a defect before any user did. Record the
confirmed ones as bugs, and add the rest to `denySelectors` so the next run stays signal.

## Safety

By default the crawler refuses to click anything whose label matches a destructive verb
(delete, pay, logout, publish, transfer...). That guard is the difference between exploration
and an incident.

- Point it at local, preview, or staging environments. Not production.
- Use a seeded, disposable account. Never a real customer's.
- `--full-send` removes the guard. Only ever on a throwaway environment you can rebuild.
- Add `data-qa-skip` to any element the crawler must never touch.

## Turning exploration into a suite

Exploration is reconnaissance, not regression protection. Feed what it found back into real
tests: the discovered journeys become `e2e-authoring` specs, the dead buttons become bug
reports through `bug-repro`, and the state graph becomes the input to `risk-map`.

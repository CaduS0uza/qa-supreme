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
node bin/qa-supreme.mjs here                              # detects the project, starts it, tests it, stops it
node bin/qa-supreme.mjs run --url https://app.example.com # full pipeline against a running app
node bin/qa-supreme.mjs watch --url http://localhost:3000 # real window, slowed down, video recorded
```

`here` reads the project in the current directory — Next, Vite, CRA, Nuxt, Astro, Remix, Angular,
Django, Rails, Laravel, or a plain static folder — starts it on its own port, waits for it to
answer, runs the pipeline and shuts it down. That is what makes this usable on any project
without configuring anything first.

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
| **button verdicts** | every control judged, not just counted | the list of what is broken and what is dead |
| `click errors` | control refused a click in 4s | overlay traps, disabled-but-visible, z-index bugs |
| `guarded skips` | destructive and session-ending controls not clicked | verify the guard list matches your app |
| `clicks that needed a retry` | control was transiently covered | a rising number means overlay/timing problems |

## The button report

Every control gets one verdict, decided from what the click actually caused:

| Verdict | What happened | What it means |
|---|---|---|
| `works` | navigation, new tab, reload, or a visible change | fine |
| `network only` | nothing visible, but a request went out | probably fine — confirm the effect is real |
| `dead` | no visible change, no request, no error | **nobody wired this control** |
| `suspect` | a console error or a failed request | wired, but something under it is failing |
| `broken` | an uncaught exception or a 5xx | **a defect, with the exception as evidence** |
| `unclickable` | refused a click twice from a clean state | an overlay traps it, or it is disabled but looks enabled |

Effects are attributed to a control **only when it owns them**: errors thrown while a new page
loads belong to that page, not to the link that led there. Blaming the link is exactly the false
positive this repository exists to hunt, so navigations are judged by what they reached, not by
what the destination logged.

## Triaging dead buttons

A `dead` verdict is not automatically a bug — it may be a no-change tab, an already-active state, or
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

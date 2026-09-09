---
description: Autonomously click every reachable control of a running web app and report what broke
argument-hint: <url> [--headed]
---

Run the autonomous exploration pipeline against: $ARGUMENTS

1. Confirm the target is a local, preview, or staging environment — never production with real
   customer data. If it looks like production, stop and ask.
2. `cd runner && npm install` if `runner/node_modules` is absent.
3. Run `node bin/qa-supreme.mjs run --url <target> --out .qa-supreme` (add `--headed --slowMo 120`
   if the user wants to watch it).
4. Read `.qa-supreme/run.json`. Report: clicks performed, states discovered, dead buttons,
   click errors, console exceptions, failed requests, a11y violations, security findings.
5. Triage every `no-op` control: is it a dead button or expected? File the real ones through
   `bug-repro`.
6. State the verdict and the path to `report.html`.

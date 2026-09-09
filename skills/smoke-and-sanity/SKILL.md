---
name: smoke-and-sanity
description: Build the 60-second smoke suite that decides whether a build is worth testing at all, plus the post-deploy sanity check that runs against production. Use after a deploy, when CI needs a fast first gate, or when asked "is the build alive".
---

# Smoke & Sanity

Smoke answers one question: **is this build worth anyone's time?** It runs in under a minute,
it never flakes, and if it is red nothing else runs.

## The smoke set (5-10 checks, no more)

1. The app responds — expected status, not a 500 or a maintenance page.
2. The root document renders real content, not an empty shell.
3. Auth works: one seeded user can log in and reach a private route.
4. The primary read path returns data (list loads with at least one row).
5. The primary write path accepts one write and reflects it.
6. No uncaught JS exception and no 5xx on load.
7. The version/build id served matches the version just deployed.

If a check needs setup that can fail for its own reasons, it does not belong in smoke.

```bash
node runner/bin/qa-supreme.mjs smoke --url https://staging.example.com
```

## Sanity after deploy (production-safe)

Same shape, read-only, no data written, no destructive verbs. Run it within 60 seconds of
every promotion, and again 5 minutes later — the second run catches cache and CDN issues the
first cannot see.

## Rules

- Smoke is a gate, not a report. Its only outputs are GO and NO-GO with the failing check named.
- A flaky smoke test is an emergency: it destroys the meaning of the gate. Fix or delete it same day.
- Never grow smoke into a regression suite. When it passes 90 seconds, split it.
- Version assertion is not optional: half of "the fix didn't work" incidents are "the fix wasn't deployed".

## Output

```
SMOKE https://staging.example.com  build 4f2a91c
  reachable                PASS  HTTP 200 in 240ms
  auth round-trip          PASS  seeded user reached /dashboard
  primary read             PASS  12 rows
  version matches deploy   FAIL  served 4f2a91c, expected 8b1d07e
VERDICT: NO-GO — the deploy did not reach the served build
```

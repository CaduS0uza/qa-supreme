---
name: ci-wiring
description: Wire the test suite into CI so it is fast, parallel, and produces readable evidence — job tiering, sharding, caching, artifacts, required checks, and flake reporting. Use when asked to set up CI for tests, speed up the pipeline, or make failures debuggable.
---

# CI Wiring

A suite nobody can read the output of is a suite nobody will fix.

## Job tiering (mirrors `regression-curation`)

```yaml
name: qa
on: [push, pull_request]

jobs:
  smoke:                       # < 90s, blocks everything
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run test:smoke

  core:                        # < 8 min, sharded, required check
    needs: smoke
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix: { shard: [1, 2, 3, 4] }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - name: Cache Playwright browsers
        uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: pw-${{ runner.os }}-${{ hashFiles('package-lock.json') }}
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test --shard=${{ matrix.shard }}/4
      - if: always()
        uses: actions/upload-artifact@v4
        with:
          name: report-shard-${{ matrix.shard }}
          path: |
            playwright-report/
            test-results/
          retention-days: 7
```

`fail-fast: false` matters: with it enabled you see one shard's failure and lose the other three,
turning one CI run into four.

## Non-negotiables

- **Artifacts on failure**: trace, screenshot, video, server logs. Debugging a CI failure without
  a trace costs more than the whole pipeline.
- **`if: always()`** on upload steps — the artifact you need most is from the run that failed.
- **Required checks** on the protected branch, and the list reviewed when jobs are renamed. A
  renamed job silently stops being required.
- **Flake reporting**: publish retried-but-passed tests to a dashboard or a comment. A flake that
  passes on retry and is never counted is a flake nobody will ever fix (`flake-forensics`).
- **Deterministic environment**: pinned Node/Python, pinned browser version, `TZ` set explicitly
  (use a non-UTC one on at least one job — see `i18n-l10n-testing`), `CI=true`.
- **Secrets**: never in logs; use masked repository secrets; a test environment token, never a
  production one.

## Autonomous exploration in CI

The published action is the one-line form:

```yaml
      - uses: CaduS0uza/qa-supreme@v1
        with:
          url: http://localhost:3000
          user: qa@example.com
          password: ${{ secrets.QA_PASSWORD }}
          fail-on: no-ship          # or `never` while you build trust
```

It writes a stage table to the job summary, exposes `verdict`, `clicks` and `states` as outputs,
and uploads the evidence as an artifact. The manual form, if you want to control every step:

```yaml
  explore:
    needs: smoke
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npx playwright install --with-deps chromium
      - run: npm start & npx wait-on http://localhost:3000
      - run: node runner/bin/qa-supreme.mjs run --url http://localhost:3000 --out .qa-supreme
      - if: always()
        uses: actions/upload-artifact@v4
        with: { name: qa-supreme-report, path: .qa-supreme/ }
```

Non-blocking at first: run it for a week, triage what it finds, then promote the stages you trust
into required checks. A gate nobody trusts gets bypassed on day two.

## Reporting

Publish a single comment per PR: stage table, verdict, links to artifacts. Twelve separate
red checks is not a report, it is noise — and noise is how a red build becomes normal.

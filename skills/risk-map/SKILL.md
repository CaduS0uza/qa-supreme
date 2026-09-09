---
name: risk-map
description: Build a risk register for a codebase, feature, or diff, then rank what to test first by blast radius x likelihood x detectability. Use before writing any test, when starting QA on an untested project, or when asked "where do we start" / "what should we test first".
---

# Risk Map

Coverage is a budget. This skill spends it where failure hurts.

## Scoring

For each candidate area, score three axes 1-3 and multiply (`RPN`, 1-27):

| Axis | 1 | 2 | 3 |
|---|---|---|---|
| **Blast radius** | cosmetic, one user | one tenant / one flow degraded | money, data loss, auth bypass, all tenants |
| **Likelihood** | stable, rarely touched | changed monthly | changed this sprint, or churn-heavy |
| **Detectability** | fails loudly in CI | surfaces in logs within a day | silent — users notice before you do |

Tiers: **P0** = RPN >= 18 or any blast-radius 3 + detectability 3. **P1** = 9-17. **P2** = rest.

## Always-P0 candidates (check each explicitly, mark N/A if absent)

- Payment / checkout / refund, and anything that writes an amount
- Authentication, session expiry, password reset, OAuth callback
- Authorization and tenant scoping — "can user A read user B's row"
- Data migrations and destructive operations (delete, overwrite, bulk update)
- Anything that emails, charges, or publishes to the outside world
- Idempotency of webhooks and retried jobs

## Procedure

1. **Enumerate the surface.** Scoped to a diff: changed files plus their direct callers.
   Scoped to a project: entry points (routes, jobs, handlers, CLI commands) — not every file.
   Use churn as a likelihood proxy: `git log --since='6 months' --name-only --pretty=format: | sort | uniq -c | sort -rn | head -40`.
2. **Score** every candidate on the three axes. No unscored area survives into the plan.
3. **Check detectability honestly.** If a failure only appears in a monthly report, it is a 3.
4. **Write the register** to `.qa-supreme/risk-register.md`.
5. **Cut.** Present only P0 and P1 as the work plan. P2 is documented, not scheduled.

## Output format

```markdown
| Area | Blast | Likely | Detect | RPN | Tier | Failure mode in one line |
|---|---|---|---|---|---|---|
| checkout/charge.ts | 3 | 3 | 3 | 27 | P0 | double charge on webhook retry |
```

Close with: `P0: <n> areas. P1: <n>. Recommended first target: <area> — <why in one clause>.`

## Rules

- Never rank by coverage gaps. An untested constant is not a risk.
- A risk you cannot phrase as a concrete failure ("user X sees Y") is not a risk — drop it.
- Re-run on every significant diff. Risk moves with the code.

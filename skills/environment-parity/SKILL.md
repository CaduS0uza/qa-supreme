---
name: environment-parity
description: Prove that staging actually predicts production — same config keys, same migrations, same feature flags, same integrations — and catch the differences that make a green staging run meaningless. Use before trusting a staging result, after a deploy that behaved differently than expected, or when something worked in staging and broke in production.
---

# Environment Parity

"It worked in staging" is the most expensive sentence in software. It is usually true, and it is
usually irrelevant, because staging differed from production in exactly the way that mattered.

The failure is almost never the code. It is a missing environment variable, a migration that ran
in one place, a flag on in one place, an integration pointing somewhere else.

## The parity check

Run it **before** you trust any staging result, and again after any environment change:

| Dimension | Prove it by | Typical divergence |
|---|---|---|
| Config keys | list keys (never values) in both, diff the sets | a token that exists only in prod, so the feature is untested |
| Config *shape* | same key, different kind of value | a sandbox URL in staging and a live one in prod |
| Migrations | compare applied migration lists | staging is ahead, so the schema you tested is not the one you ship to |
| Feature flags | dump flag state per environment | flag on in staging, off in prod: you tested code nobody will run |
| Integrations | resolve each third party's target | staging pointing at a production webhook — the dangerous one |
| Data shape | row counts and cardinality of key tables | 50 rows in staging, 5M in prod: every query plan differs |
| Runtime | language, framework, region, memory, timezone | UTC in staging, local in prod |
| Build | the served commit sha | you tested a build that was never deployed |

```bash
# keys only — never print values
diff <(vercel env ls preview | awk '{print $1}' | sort) \
     <(vercel env ls production | awk '{print $1}' | sort)
```

## The three rules

1. **Assert the served build.** Expose the commit sha on a health endpoint and assert it matches
   what you deployed. Half of "the fix didn't work" is "the fix was never deployed".
2. **A key that exists in only one environment is a finding**, even when nothing is failing yet.
   It means one of the two environments is not testing that path at all.
3. **Never let a test environment reach a production integration.** Not the payment provider, not
   the mail sender, not the webhook target, not the customer's database. Assert the target hosts
   at startup and refuse to boot on a mismatch — that check is cheaper than the incident.

## Where parity is allowed to break

Perfect parity is not the goal; **known** divergence is. Write the exceptions down and justify
each one: smaller instance sizes, sandbox payment keys, anonymised data volume, a shorter
retention window. Anything not on that list is a defect.

Any behaviour that only exists where parity is broken — a webhook that only production can
receive, a provider that has no sandbox — cannot be validated before release. Say that out loud
in the `release-gate` rather than letting a green staging run imply coverage it does not have,
and plan the post-deploy check that will actually verify it (`smoke-and-sanity`).

## After the deploy

Parity is not a one-time audit. Re-run the check after every environment change, and run a
production sanity pass within 60 seconds of every promotion — then again five minutes later,
because caches and CDNs lie for a while.

## Done means

A diff of config keys, migration lists and flag state between environments; the served sha
asserted; the exception list written down; and any behaviour that staging structurally cannot
prove named explicitly.

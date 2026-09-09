---
name: security-regression
description: Own the security checks that belong to QA rather than to a pentest — authorization and tenant isolation as tests, headers, cookie flags, client-side secrets, injection-safe inputs. Use when asked whether users can see each other's data, about IDOR, security headers, or a pre-release security pass.
---

# Security Regression

This is not a penetration test. It is the set of security properties a QA suite can assert on
every commit, forever, so a regression cannot ship silently.

## The authorization matrix (the highest-value tests in any multi-tenant product)

Build the grid once, generate a test per cell:

| Actor | Own resource | Other user's resource | Other tenant's resource | No auth |
|---|---|---|---|---|
| owner | 200 | 403/404 | 403/404 | 401 |
| member | 200 (scoped) | 403/404 | 403/404 | 401 |
| admin | 200 | per policy | 403/404 | 401 |

Every endpoint that takes an id gets a row. IDOR — swapping an id and getting someone else's
data — is the most common serious vulnerability in SaaS, and it is trivially testable:

```ts
const other = await seedTenant('acme')
const res = await api.as(userFromTenant('globex')).get(`/orders/${other.orderId}`)
expect(res.status).toBe(404)          // not 403: do not confirm existence
expect(res.body).not.toHaveProperty('total')
```

Prove each of these with `mutation-proof` by removing the guard — an authorization test that
stays green without the guard is the most dangerous false positive in the codebase.

## Automated sweep

```bash
node runner/bin/qa-supreme.mjs security --url https://app.example.com
```

Covers headers (CSP, HSTS, X-Content-Type-Options, framing), cookie flags (HttpOnly, Secure,
SameSite), client-side secret patterns (live API keys, JWTs, private keys in markup or
localStorage), `target=_blank` without `noopener`, and forms posting over http.

## Input safety as regression tests

For every input that reaches a query, a template, a filesystem path or a shell:

- SQL/NoSQL: `' OR 1=1 --`, `'; DROP TABLE`, `{"$ne": null}` — expect a validation error, never
  a 500 and never extra rows.
- XSS: `<img src=x onerror=alert(1)>` stored and reflected — assert it renders as text.
- Path traversal: `../../etc/passwd` — expect rejection.
- Mass assignment: post `role: "admin"` to a profile update — expect it ignored.
- Rate limiting: N+1 requests in a window -> 429.

These are regression tests, not exploitation. Report what failed and where; do not chain into
exploitation of a system you were not engaged to attack.

## Scope boundary

Vulnerability classes requiring active exploitation (SSRF chains, deserialization, auth bypass
research) belong to a scoped, authorized penetration test — not to a CI suite. State that
boundary in your report instead of implying full coverage.

## Output

```
AUTHZ MATRIX  42 cells, 40 pass, 2 FAIL
  FAIL GET /api/orders/:id  member of tenant B receives 200 for tenant A order  (orders.ts:31)
  FAIL GET /api/exports     no tenant filter on the query                       (exports.ts:12)
HEADERS  CSP missing, HSTS present, X-Frame-Options missing
SECRETS  none found in client bundles
```

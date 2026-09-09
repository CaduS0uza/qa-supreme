---
name: e2e-authoring
description: Write end-to-end browser tests that are stable and that actually verify user-visible outcomes — Playwright and Cypress, with resilient locators, page objects, reused auth state, network control, and no hardcoded waits. Use when asked to write, port, or repair E2E/UI tests or user-journey coverage.
---

# E2E Authoring

E2E is the most expensive level. Every test must earn its seconds: it exists to prove a
**user-visible outcome on a P0 journey**, not to click around.

## Choose the journey first

One test per journey, not per page. A journey ends in a state the user can see and the
business cares about: order placed, invite accepted, subscription cancelled. If the test
ends at "the modal opened", it belongs at the component level.

## Locator hierarchy (top wins)

1. Role + accessible name — `getByRole('button', { name: 'Place order' })`
2. Label / placeholder / text the user actually reads
3. `data-testid` — deliberate, added to the app, documented
4. CSS / XPath — **forbidden** in new tests; every `.css-1a2b3c` is a future flake

A locator that breaks on a copy change is a bad locator; a locator that breaks on a CSS
refactor is a broken test. Prefer accessible names: they double as an a11y assertion.

## Waiting

```js
// forbidden
await page.waitForTimeout(2000)
// correct — assert the state you actually need
await expect(page.getByRole('status')).toHaveText('Order placed')
await expect(page.getByRole('button', { name: 'Place order' })).toBeDisabled()
```

Web-first assertions retry; `sleep` gambles. If you need a wait that is not an assertion,
wait on the specific response: `page.waitForResponse(r => r.url().includes('/api/orders') && r.ok())`.

## Structure

- **Page objects hold locators and navigation. Never assertions.** Assertions live in the
  spec so a reader can see what is being proven.
- **Auth once**: log in in a setup project, save `storageState`, reuse it. Never log in
  through the UI in every test — except in the one test that covers login itself.
- **Isolation**: each test creates its own data via API (fast) and asserts through the UI
  (real). Never depend on a record another test created, and never on execution order.
- **Network**: mock third parties (payment provider sandbox, maps, analytics) and let your
  own backend run for real. A fully-mocked E2E test proves your mocks work.

## Fixtures (Playwright)

```ts
export const test = base.extend<{ order: Order }>({
  order: async ({ request }, use) => {
    const order = await api(request).createOrder()   // arrange via API
    await use(order)
    await api(request).deleteOrder(order.id)          // always clean up
  },
})
```

Fixtures must not swallow failures: no `try/catch` that lets setup fail silently.

## Config baseline

- `retries: 2` **in CI only**, `retries: 0` locally — a retry that hides a real bug locally
  is how flake enters the suite.
- `trace: 'on-first-retry'`, `screenshot: 'only-on-failure'`, `video: 'retain-on-failure'`.
- `fullyParallel: true` — if it breaks, your tests share state; fix the state, not the flag.
- One `baseURL`, no environment branching inside specs.

## Cypress notes

`cy.session()` for auth reuse, `cy.intercept()` for third parties, never `cy.wait(ms)` —
`cy.wait('@alias')` instead. Avoid chaining off `cy.get()` results across commands.

## Before you commit

Every new spec goes through `false-positive-hunter`, then `mutation-proof`. A green E2E
test that has never been seen red is decoration.

## Done means

Runner output pasted (`<n> passed`), plus the trace/screenshot artifacts path, plus the
journey each spec covers named in one line.

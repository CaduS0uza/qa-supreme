---
name: tracking-testing
description: Test analytics and conversion tracking as a product feature — pixel fires, event payloads, consent gating, deduplication and server-side events. Use when the change touches GA4, Meta Pixel, GTM, conversion events, attribution, or when marketing reports numbers that do not match the product.
---

# Tracking Testing

Broken tracking does not throw. Nothing turns red. The product works perfectly and the business
spends a month optimising against numbers that were never real — and by the time someone notices,
the data for that month cannot be recovered.

For a company that buys traffic, this is not a nice-to-have: a conversion event that stops firing
silently teaches the ad platform to optimise for the wrong people.

## Assert on the request, not on the console

The only trustworthy oracle is the network call that leaves the browser:

```ts
const hits = []
await page.route('**/*', route => {
  const u = route.request().url()
  if (/google-analytics|analytics\.google|facebook\.com\/tr|googletagmanager/.test(u)) {
    hits.push({ url: u, body: route.request().postData(), method: route.request().method() })
  }
  route.continue()
})

await checkout(page)
const purchase = hits.find(h => /(\ben=purchase\b|"event":"purchase"|ev=Purchase)/.test(h.url + h.body))
expect(purchase, 'purchase event never left the browser').toBeTruthy()
```

Then assert the **payload**, not just that something fired: value, currency, transaction id,
items, and the user/consent identifiers. A `purchase` with no `value` is worse than no event —
it looks correct in the tag debugger and reports zero revenue.

## The event contract

Write the contract once, generate the tests from it (`state-machine-testing` style), and keep it
next to the code:

| Event | Fires when | Required fields | Must not |
|---|---|---|---|
| `view_item` | product page rendered | `item_id`, `value`, `currency` | fire on a 404 page |
| `add_to_cart` | item added | `item_id`, `quantity`, `value` | fire on quantity change to 0 |
| `begin_checkout` | checkout opened | `value`, `currency`, `items` | fire twice on a refresh |
| `purchase` | order confirmed | `transaction_id`, `value`, `currency`, `items` | fire on a declined payment |
| `generate_lead` | form submitted successfully | `form_id`, `value` | fire on a validation error |

**The two rows that cost the most money:** `purchase` on a declined payment (inflates conversions,
poisons the ad platform's model) and duplicate `purchase` on refresh (same, doubled). Test both by
name.

## Deduplication and server-side

When the same conversion is sent from browser and server (Meta CAPI, GA4 Measurement Protocol),
both must carry the **same** `event_id` — otherwise every conversion is counted twice. Assert the
id matches across the two payloads in one test; nothing else catches this.

## Consent

- Before consent: no tracking request leaves at all. Assert **zero** matching hits, not "a hit
  with anonymised data".
- After accept: events fire, with consent flags set.
- After reject: still zero, and still zero after a reload — the classic bug is consent that resets.

This is also `compliance`: LGPD and GDPR make an ungated pixel a legal exposure, not just a data
quality problem.

## Guard against silent death

Tracking breaks by disappearing. Add a synthetic check that runs the money journey daily against
production and fails when the `purchase` request stops arriving. A test that only runs in CI
cannot catch a tag manager change someone made in a web console at 4pm on a Friday.

## Done means

Per event: fired / not fired, payload asserted field by field, consent states covered, and the
dedup id proven identical across browser and server.

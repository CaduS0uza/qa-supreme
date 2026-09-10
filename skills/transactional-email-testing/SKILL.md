---
name: transactional-email-testing
description: Test the emails the product sends — that they are sent exactly once, to the right person, with working links, correct content and no leaked data — using a capture inbox instead of real recipients. Use when the change touches signup, password reset, receipts, invitations, notifications or any provider webhook that sends mail.
---

# Transactional Email Testing

Email is the part of the product that runs where nobody looks: outside the app, in someone else's
client, often at the worst moment (a password reset at 2am). It is also the easiest place to send
a customer someone else's data.

## Never send to a real address

Route everything to a capture inbox in test: **Mailpit** or **MailHog** locally, **Mailtrap** or
the provider's sandbox in CI. Then assert against its API — the message becomes a normal test
fixture:

```ts
await requestPasswordReset('qa@example.com')
const mail = await mailpit.latestFor('qa@example.com')       // poll with a timeout, never sleep
expect(mail.subject).toBe('Redefinir sua senha')
const link = extractFirstLink(mail.html)
expect(link).toMatch(/^https:\/\/app\.example\.com\/reset\?token=/)
```

Add a guard that fails the suite if the configured transport is the production one. One test run
against live SMTP is a mass-mail incident.

## What every transactional email must prove

1. **Sent exactly once.** Not zero (silent failure), not twice (retry or duplicate webhook). Assert
   the count, then repeat the trigger and assert it is still one.
2. **To the right person.** The recipient is the actor of the action — assert it explicitly. The
   worst bug in this area sends user A's receipt to user B.
3. **The link works and expires.** Click it in a real browser (`e2e-authoring`): valid token
   completes the flow; expired token, reused token, and a tampered token all fail closed with a
   readable message.
4. **Content is not a template with holes.** Assert no `{{`, no `undefined`, no `null`, no
   `[object Object]` in subject or body. This is the most common production email bug and it is a
   one-line assertion.
5. **Nothing leaked.** No internal ids, no other tenant's data, no debug payload, no stack trace.
6. **Renders where people read it.** HTML plus a plain-text alternative, tables not flexbox for
   layout, inline CSS, images with `alt` (many clients block images by default), and a subject
   that survives truncation on mobile.
7. **Unsubscribe** on anything that is not strictly transactional, and it must actually work.

## Timing and queues

Most email goes through a queue. Test the queue, not just the enqueue:

- Job fails mid-send → retried, and the retry does not send a second copy.
- Provider returns 429 → backoff, no duplicate.
- Bounce and complaint webhooks are handled, and a hard bounce stops future sends to that address.

## Localisation

If the product speaks more than one language, the email does too: assert the locale of the
recipient decides the template, and that dates, currency and plurals are formatted for it
(`i18n-l10n-testing`).

## Done means

Per email: count asserted, recipient asserted, link exercised end to end in a browser, template
holes checked, and the capture transport named in the output so nobody wonders where the mail went.

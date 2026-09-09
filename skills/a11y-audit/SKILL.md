---
name: a11y-audit
description: Audit and fix accessibility against WCAG 2.2 A/AA — automated axe-core sweep plus the manual checks automation cannot make (keyboard, focus order, screen-reader semantics, zoom, contrast). Use when asked about accessibility, a11y, WCAG, screen readers, or keyboard navigation.
---

# Accessibility Audit

Automation finds roughly a third of real accessibility defects. Report both halves or the audit
is a false positive at the process level.

## Layer 1 — Automated sweep

```bash
node runner/bin/qa-supreme.mjs a11y --url https://app.example.com   # every crawled state
```

Or inside your suite:

```ts
import AxeBuilder from '@axe-core/playwright'
const results = await new AxeBuilder({ page })
  .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
  .analyze()
expect(results.violations).toEqual([])
```

Run it on **every meaningful state**, not just the landing page: modal open, form in error,
empty state, loaded state. Most violations hide in states a page-level scan never reaches.

## Layer 2 — Manual checks (the two thirds automation misses)

| Check | How | Pass condition |
|---|---|---|
| Keyboard only | unplug the mouse, Tab through the whole flow | every action reachable, nothing trapped |
| Focus visible | Tab slowly | focus indicator always visible, 3:1 contrast |
| Focus management | open/close a modal | focus moves in, returns to the trigger on close |
| Reading order | Tab order vs visual order | they match |
| Screen reader | VoiceOver (Cmd+F5) / NVDA | every control announces role + name + state |
| Zoom 200% / 400% | browser zoom, 320px viewport | no loss of content or function, no horizontal scroll |
| Motion | `prefers-reduced-motion` | animation respects it |
| Error identification | submit an invalid form | error is announced, associated to the field, and describes the fix |
| Target size (2.2) | measure interactive controls | 24x24 CSS px minimum |

## Triage

Rank by impact, not by count: `critical` and `serious` block, `moderate`/`minor` become debt
with a date. One missing form label on the signup flow outranks fifty low-contrast items in the
footer, and any keyboard trap is a release blocker regardless of tooling severity.

## Common findings and their fixes

- `image-alt` — decorative images need `alt=""`, informative ones need a description of the
  information, not the filename.
- `button-name` — an icon-only button needs `aria-label`; the visible tooltip is not enough.
- `color-contrast` — 4.5:1 for body text, 3:1 for large text and UI boundaries.
- `label` — placeholder is not a label; it disappears exactly when the user needs it.
- `aria-*` misuse — a wrong ARIA role is worse than none. Prefer native elements.

## Output

Report per state: violations by impact, the manual checklist with pass/fail, and the blocking
list with file locations. Close with the WCAG level actually met — never claim "accessible",
claim "no automated WCAG 2.2 AA violations on N states, manual checklist X/9".

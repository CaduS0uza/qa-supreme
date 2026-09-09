---
name: i18n-l10n-testing
description: Test internationalization and localization — missing keys, text expansion, RTL layout, plural rules, date/number/currency formatting, timezone handling, and locale-dependent bugs. Use when the product ships in more than one language or region.
---

# i18n & l10n

Localization bugs are invisible in the developer's locale and obvious to every affected user.

## Automated checks

- **Missing keys**: fail the build on any key present in the default locale and absent elsewhere,
  and on any hardcoded user-facing string in the source (lint rule).
- **Unused keys**: dead translations cost money to maintain.
- **Pseudo-localization**: render `[!!! Ŧḗẋŧ ḗẋpȧȧƞḓḗḓ !!!]` — 40% longer, accented, bracketed. One
  pass over the app exposes truncation, clipping and untranslated strings at once.
- **Interpolation safety**: every placeholder present in every locale; no locale silently drops
  `{count}`.

## Layout under translation

German and Finnish expand ~35% over English; Japanese contracts. Test the longest realistic
translation of every button, tab and label — a nav that wraps to two lines at `de-DE` is a
layout bug, not a translation issue.

**RTL** (ar, he, fa) is not a mirror of the CSS: check icon direction, progress and slider
direction, text alignment, punctuation placement, and that numbers and embedded Latin words read
correctly. Use logical CSS properties (`margin-inline-start`) and assert `dir="rtl"` renders
without overlap.

## Formatting

| Thing | Trap |
|---|---|
| Dates | `03/04/2026` is March 4 or April 3 depending on locale. Assert with `Intl.DateTimeFormat`, never string equality |
| Numbers | `1.234,56` vs `1,234.56`; Indian grouping `12,34,567` |
| Currency | symbol position, spacing, and the fact that formatting is not conversion |
| Plurals | Polish and Arabic have more than two plural forms — test each category, not just 1 and 2 |
| Sorting | locale-aware collation (`Intl.Collator`), not byte order |
| Names & addresses | no first/last assumption, no fixed postcode format |

## Timezones (the silent data corruption)

Store UTC, render local. Test: a user in `Pacific/Auckland` creating a record at 23:30 local sees
it under today, not yesterday. Run the suite under at least one non-UTC timezone in CI
(`TZ=Pacific/Auckland`) — it catches an entire class of off-by-one-day bugs that a UTC-only CI
never will.

## Output

Per locale: missing keys, truncations found (with screenshots), formatting failures, RTL layout
defects. Never report "translations look fine" — report the locales actually exercised.

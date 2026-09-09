---
name: responsive-mobile-testing
description: Test responsive web across breakpoints and real mobile behavior — touch targets, safe areas, virtual keyboard, orientation, offline — plus native/React Native flows with Appium or Detox. Use when asked about mobile testing, responsive layout, breakpoints, or app testing.
---

# Responsive & Mobile

## Breakpoint matrix

Test the boundaries, not the middles — bugs live at the edges of media queries:

| Width | Represents | Check |
|---|---|---|
| 320px | smallest supported phone | no horizontal scroll, nothing clipped |
| 375 / 390px | common phone | primary flow completable one-handed |
| 768px | tablet portrait / breakpoint edge | layout switches cleanly, no duplicate nav |
| 1024px | tablet landscape / small laptop | — |
| 1440px+ | desktop | no absurd line lengths |

```ts
for (const vp of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 768, height: 1024 }]) {
  test(`checkout at ${vp.width}px`, async ({ page }) => {
    await page.setViewportSize(vp)
    await expect(page.getByRole('button', { name: 'Place order' })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    expect(overflow, 'horizontal overflow at this breakpoint').toBe(false)
  })
}
```

## Mobile-specific behavior the desktop suite never catches

- **Touch targets**: 24x24 CSS px minimum (WCAG 2.2), 44x44 recommended; check spacing between
  adjacent targets too.
- **Virtual keyboard**: does it cover the submit button? Does the focused field scroll into view?
- **Safe areas**: notch and home indicator — `env(safe-area-inset-*)`.
- **Orientation change** mid-flow: state must survive.
- **Real touch events**: `page.tap()` with `hasTouch: true`, not `click()`. Hover-only affordances
  are invisible on touch — flag every one.
- **Network reality**: throttle to Fast 3G and test the offline/reconnect path.
- **Pull-to-refresh and back gesture** must not destroy unsaved form state.

Use Playwright device descriptors (`devices['iPhone 14']`) for shape and touch, but remember
they emulate — final verification of gestures, permissions and push belongs on a real device
or a device cloud.

## Native apps

- **Detox** (React Native): gray-box, synchronizes with the app's own idle state — far less
  flaky than black-box waits.
- **Appium**: cross-platform, black-box; use accessibility ids as locators, never coordinates.
- Always cover: cold start, background/resume with state, permission denied paths, deep links,
  offline launch, and upgrade-over-existing-install (the most skipped and most damaging).

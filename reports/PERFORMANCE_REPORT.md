# SONARA Performance Report

Date: 2026-07-15

## Implemented controls

- Server-rendered HTML remains usable before client JavaScript runs.
- Appearance and interface enhancement are contained in small static CSS/JS files.
- Visual quality has four device-local modes: Automatic, Full, Reduced, and Off.
- Automatic mode disables continuous canvas work for reduced-motion, data-saving, and lower-power contexts.
- Reduced and Off keep the core interface static; Full never overrides the user's reduced-motion preference.
- Canvas device-pixel ratio remains capped, animation pauses in hidden tabs, and no WebGPU adapter is requested at page load.
- Static asset version changed to `interface-dom-20260715`, and the service-worker cache version matches it.

## Browser proof

- Desktop dark mode: 1440 by 1000, command palette opened and keyboard focus moved to search.
- Mobile light mode: 390 by 844, document width equaled viewport width, four quick actions fit, and minimum tested action height was 44px.
- Browser console: zero warnings and zero errors on the verified product page.

Evidence:

- `output/playwright/products-desktop-dark-command.png`
- `output/playwright/products-mobile-light-verified.png`

## Honest limitations

No Lighthouse score, Core Web Vitals percentile, cold-start latency, or production function duration is claimed from local testing. Run Lighthouse and inspect Vercel Observability on the deployed commit before publishing performance claims.

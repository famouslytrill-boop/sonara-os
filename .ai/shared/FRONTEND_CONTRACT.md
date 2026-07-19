# Frontend Contract — owner: Claude (Agent B)

## Rendering architecture (current, verified)
- Server-rendered HTML from `layout()` in server.js. No SPA. Progressive enhancement only (`public/sonara-experience.js`, `public/sonara-interface-engine.js`, `public/sonara-cohesive-2027.js`).
- Navigation and forms work without JavaScript. Ctrl+K palette, canvas scenes, product tabs, founder-milestone switching, service-worker registration, and aria-current marking are enhancements.
- The public homepage content is rendered by `lib/sonara-cohesive-homepage.cjs` from `lib/sonara-brand-registry.cjs` and the non-secret `getReadiness()` object.

## Preference initialization contract

- `renderHead()` resolves the device-local `sonara-appearance` value before styles load and writes `data-sonara-appearance` plus canonical `data-theme` on `<html>`.
- Only `system`, `light`, and `dark` are accepted. System mode follows `(prefers-color-scheme: dark)` with a safe light fallback.
- Deferred theme controls must update the same `data-theme` attribute; do not introduce a second selector contract.
- Interface haptics are off unless device-local `sonara-haptics` is exactly `on`, and remain off under reduced motion. No other global action listener may call `navigator.vibrate`.
- The cohesive public script does not initialize sound or haptics.

## CSS layer roles (load order matters)
1. `layout()` inline `<style>` — design tokens + element base.
2. `sonara-brand-system.css` — product accent token families.
3. `sonara-friendly-premium.css` — editorial typography.
4. `sonara-interface-engine.css` — hero command panel, status chips, palette, and mobile quick bar.
5. `sonara-launch-ui.css` — master components, responsive behavior, and admin density.
6. `sonara-cohesive-2027.css?v=cohesive-ui-20260719` — homepage-only cohesive presentation, scoped to `.sonara-home-v3` and `.sonara-cohesive-shell`; it must not restyle private application routes.

## Public brand registry

- Canonical public company: SONARA Industries.
- Canonical shared platform: SONARA One.
- Canonical products: Business Builder, Creator Studio, Growth Studio.
- Canonical public message: Build. Create. Grow.
- Canonical approved monthly prices: Free `$0`, Starter `$7`, Core `$19`, Pro `$39`.
- Runtime routes, logos, product descriptions, and public plan prices live in `lib/sonara-brand-registry.cjs`; do not create a conflicting second public registry.

## PWA and cache contract

- `public/site.webmanifest` is the single canonical install manifest. The legacy `/manifest.webmanifest` URL is an Express `308` redirect.
- The service worker handles only allowlisted public navigations. Authenticated/private navigations remain browser-network controlled and must never receive an offline cached page.
- Public navigation is network-first with an offline fallback. Same-origin static assets use stale-while-revalidate.
- The cohesive files use a unique asset name/version and do not expand the private navigation cache surface.

## State presentation rules
Every data-bearing screen renders one honest state: working / needs login / needs workspace / needs payment / needs admin setup / needs provider / permission denied / error. The cohesive homepage uses the existing readiness object and must never fabricate success.

## Hard constraints
- No retired product names; no fake stats or guaranteed outcomes.
- 44px touch targets on mobile; no horizontal overflow at 360px+.
- Status = text + dot, never color-only. Reduced-motion fully static.
- Keep `layout()` call signature `{title,eyebrow,heading,body,sections,actions,variant}` stable.
- New private/product routes reuse existing server render helpers and authorization middleware.

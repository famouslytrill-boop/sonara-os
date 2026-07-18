# Frontend Contract — owner: Claude (Agent B)

## Rendering architecture (current, verified)
- Server-rendered HTML from `layout()` in server.js. No SPA. Progressive
  enhancement only (`public/sonara-experience.js`, `public/sonara-interface-engine.js`).
- Navigation and forms work without JavaScript. Ctrl+K palette, canvas scenes,
  service-worker registration, and aria-current marking are enhancements.

## Preference initialization contract

- `renderHead()` resolves the device-local `sonara-appearance` value before styles load and writes `data-sonara-appearance` plus canonical `data-theme` on `<html>`.
- Only `system`, `light`, and `dark` are accepted. System mode follows `(prefers-color-scheme: dark)` with a safe light fallback.
- Deferred theme controls must update the same `data-theme` attribute; do not introduce a second selector contract.
- Interface haptics are off unless device-local `sonara-haptics` is exactly `on`, and remain off under reduced motion. No other global action listener may call `navigator.vibrate`.

## CSS layer roles (load order matters; all versioned ?v=clark-ui-20260718-preferences)
1. layout() inline <style> — design tokens + element base (light theme;
   body.sonara-admin = dark remap). Pinned by tests: the auto-fit 280px grid,
   `overflow-wrap: anywhere`, `word-break: break-word` strings must remain.
2. sonara-brand-system.css — product accent token families + tokens-v2
   (motion/status vars) + html[data-theme="dark"] remap. Pinned: `sonara-tokens-v2`,
   `--sonara-motion-base`, `--sonara-status-critical`.
3. sonara-friendly-premium.css — editorial typography. Pinned:
   `sonara-hero-clip-fix`, `overflow-wrap: break-word`.
4. sonara-interface-engine.css — dark hero command panel, status chips,
   palette, mobile quick bar. Pinned: `prefers-reduced-motion`,
   `.sonara-quick-bar`, literal `aria-current="page"`.
5. sonara-launch-ui.css — master components + responsive + admin density.
   Pinned: `sonara-home-v3`, `@media (max-width: 760px)`, `min-height: 44px`.

## PWA and cache contract

- `public/site.webmanifest` is the single canonical install manifest. The legacy `/manifest.webmanifest` URL is an Express `308` redirect to `/site.webmanifest`; no second static manifest may be introduced.
- `public/sonara-experience.js` registers `/sw.js` only from explicitly listed public pages and only in a secure context or local development. It never registers from authenticated customer, account, or admin routes.
- The service worker handles only allowlisted public navigations. Authenticated/private navigations remain browser-network controlled and must never receive an offline cached page.
- Public navigation is network-first with an offline fallback. Same-origin static assets use stale-while-revalidate.
- Responses marked `private` or `no-store`, responses carrying `Set-Cookie`, opaque responses, API responses, and the service-worker script itself are not written to the PWA cache.
- Cache cleanup is prefix-scoped to SONARA public caches; it must not delete unrelated site/browser caches.
- Service-worker `VERSION`, rendered `?v=` asset tokens, and tests remain synchronized at `clark-ui-20260718-preferences` until the next coordinated asset change.
- Update discovery may show a polite refresh notice, but installation/update behavior must never block navigation, login, checkout, or forms.

## State presentation rules (per master directive §13)
Every data-bearing screen renders one honest state: working / needs login /
needs workspace / needs payment / needs admin setup / needs provider /
permission denied / error. Server helpers already emit these (setup_required
JSON or responsePage HTML); frontend must never fabricate success.

## Hard constraints
- No "shell" in public HTML; no retired product names; no fake stats.
- 44px touch targets on mobile; no horizontal overflow at 360px+.
- Status = text + dot, never color-only. Reduced-motion fully static.
- Theme and haptic preference tests must execute the shipped JavaScript; string-presence assertions alone are insufficient.
- Service worker version must move in lockstep with ?v= asset token
  (public/sw.js VERSION + tests/premium-application.test.js).
- PWA registration/cache tests must execute the shipped browser script and assert that private routes are not intercepted.

## Asks of Codex
- Keep layout() call signature {title,eyebrow,heading,body,sections,actions,variant} stable; coordinate here before changing.
- New routes should reuse existing render helpers (brandCard/actionCard/linkAction) so they inherit the system.

# SONARA Motion Brand System — 2026

**Status:** implemented on a protected feature branch  
**Production format:** local SVG + CSS + JavaScript  
**Heavy 3D framework:** none  
**Pricing change:** none

## Scope

This system applies the approved visual direction to the actual SONARA One runtime:

- new parent and product SVG logo family;
- light and dark startup interfaces;
- first-session startup sequence;
- shorter internal-route loading sequence;
- restrained CSS 3D depth and motion;
- reduced-motion and skip controls;
- PWA manifest, favicon, cache, registry, and regression-test integration.

The generated concept images are visual direction, not production screenshots. The production implementation is original SONARA geometry and does not copy another company’s trade dress.

## Motion sequence

The startup sequence follows four conceptual stages:

1. **Form** — orbit lines and light establish the Nexus frame.
2. **Materialize** — the flat SVG mark receives temporary presentation depth through CSS perspective.
3. **Load** — restrained orbit and particle movement communicate activity without a fictional percentage.
4. **Resolve** — the overlay exits and exposes the real SONARA interface.

The application does not pretend to know a percentage that it cannot measure. The loading track is indeterminate.

## Runtime behavior

### First page in a browser session

- Uses `sessionStorage` key `sonara:startup:v3`.
- Displays the complete SONARA One startup composition.
- Holds only for a short minimum presentation window when motion is enabled.
- Exits after the page load event or a hard fail-safe timeout.
- Includes a visible **Skip animation** control.

### Later internal navigation

- Uses the same local assets in a compact route-loading mode.
- Removes the large wordmark, tagline, and skip action.
- Shows `Loading SONARA One` while navigation begins.
- Resets correctly when a page is restored through browser back/forward cache.

## Light and dark interfaces

The startup overlay follows the existing SONARA appearance preference:

- `system` follows the device preference;
- `light` uses the primary Nexus mark and bright neutral surfaces;
- `dark` uses the dedicated lighter-contrast Nexus mark and near-black surfaces.

The theme is applied by the prepaint script before the interface becomes visible, preventing an avoidable light flash on dark-mode devices.

## Accessibility

- `role="status"` and `aria-live="polite"` communicate startup state without interrupting the user.
- Decorative orbits, particles, and duplicate marks are hidden from assistive technology.
- `prefers-reduced-motion: reduce` disables nonessential animations.
- The skip control remains keyboard accessible and uses a mobile-sized target.
- A timeout prevents the overlay from trapping the interface.
- No critical meaning is communicated only through color or movement.

## Performance

The implementation deliberately avoids:

- WebGL and 3D runtime frameworks;
- startup video;
- remote animation dependencies;
- large raster concept boards in the critical path;
- fake progress polling;
- network requests solely for decorative motion.

The production startup uses local SVGs, transforms, opacity, and small CSS effects. Static assets are added to the existing service-worker cache.

## Logo inventory

### Parent

- `public/brand/sonara-one-mark-v3.svg`
- `public/brand/sonara-one-mark-v3-dark.svg`
- `public/brand/sonara-one-mark-v3-mono.svg`
- `public/brand/sonara-industries-logo-v3.svg`

### Business Builder

- `public/brand/business-builder-mark-v3.svg`
- `public/brand/business-builder-logo-v3.svg`

### Creator Studio

- `public/brand/creator-studio-mark-v3.svg`
- `public/brand/creator-studio-logo-v3.svg`

### Growth Studio

- `public/brand/growth-studio-mark-v3.svg`
- `public/brand/growth-studio-logo-v3.svg`

## Source integration

- `scripts/apply-motion-brand-system.cjs` applies the system idempotently.
- `ui/sonara/styles/99-sonara-cinematic-system.css` remains the canonical style source.
- `ui/sonara/scripts/99-sonara-cinematic-system.js` remains the canonical interaction source.
- `lib/sonara-brand-registry.cjs` publishes current brand assets to runtime consumers.
- `public/site.webmanifest` exposes the v3 parent and product icons to PWA surfaces.
- `public/sw.js` caches the new identity and canonical motion assets.
- `tests/motion-brand-system.test.js` enforces the contract.

## Runtime ordering

The motion transform runs after the premium conversion transform so it receives the final public layout. Existing governance transforms keep their established order, and Market R&D remains the final runtime transform.

## Acceptance criteria

- The rendered header, footer, startup overlay, and product cards use the v3 logo family.
- Light and dark startup variants are available.
- Startup motion is skippable and reduced-motion safe.
- Route loading is shorter than first-session startup.
- No fake loading percentage is rendered.
- All SVG assets are served locally.
- The PWA manifest and service worker reference the v3 identity.
- Existing legacy asset URLs remain available for migration compatibility but are not the visible identity.
- Plan prices and production entitlement rules are unchanged.
- Full CI must pass before merge.

## Production boundary

This visual system does not prove that catalog migrations, paid entitlements, provider integrations, or restricted workflows are operational. Those remain separate fail-closed production gates.

# Design Contract

## Brand system

- Parent: SONARA Industries / SONARA OS platform.
- Products retain distinct identities: Business Builder, Creator Studio, Growth Studio.
- Do not reuse legacy public product names or copy third-party branding/layouts.

## Experience hierarchy

- Public pages: clear, friendly, product-led, and conversion-aware.
- Customer app: operational, repeatable, and optimized for scanning/action.
- Product workspaces: shared interaction patterns with distinct product identity.
- Admin: dense, calm, technical, and truthful.

## Required presentation states

Loading, empty, populated, validation error, dependency error, setup required, login required, workspace required, payment required, permission denied, success, and in-development.

## Accessibility and performance

- Practical WCAG 2.2 AA target.
- Semantic structure, keyboard access, visible focus, labels/errors, contrast, reduced motion, screen-reader announcements, chart summaries, and touch targets.
- Lazy-load expensive graphics. Pause animation off-screen/hidden. Provide static fallbacks.
- Sounds and haptics are optional and off/no-op safely.

## Coordination

Claude owns implementation of this contract. Shared renderer, route, manifest, service worker, API-state, or package changes require locks and cross-agent handoff.


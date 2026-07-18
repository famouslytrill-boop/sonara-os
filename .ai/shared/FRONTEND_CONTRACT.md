# Frontend Contract

## Current architecture

- Source: `packages/web/src`.
- Artifact: `packages/web/dist`.
- Route source: `packages/web/src/routes/route-manifest.ts`.
- Renderer/router source: `packages/web/src/app.ts`.
- Deployment is a static SPA with Vercel `/api/*` functions; it is not currently a Next.js application.

## Claude ownership

Claude owns presentation, design system, responsive layout, navigation, product workspaces, public pages, frontend state presentation, graphics, progressive motion/3D, accessibility presentation, and frontend tests.

## Stable boundaries

- Frontend must consume API contracts without changing request/response shapes silently.
- Auth, organization, entitlement, provider, and setup states must be rendered truthfully.
- Paid access is never inferred from a redirect.
- No secret or service-role value enters browser code.
- Route additions update the route manifest, app renderer, route tests, and shared route registry.
- PWA/service-worker changes are shared/high-conflict and require a lock.

## Required state vocabulary

Working, ready, login required, workspace required, payment required, administrator setup required, database/storage/email/webhook/provider required, permission denied, temporarily unavailable, and explicitly in development.

## UX quality

- Mobile-first, keyboard accessible, visible focus, reduced motion, no color-only status, no horizontal overflow, and 44px minimum touch targets.
- 3D, motion, haptics, and sound are progressive enhancements with static/no-op fallbacks.
- No fake metrics, fake saves, dead buttons, or provider overclaims.


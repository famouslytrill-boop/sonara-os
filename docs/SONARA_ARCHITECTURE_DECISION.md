# SONARA Architecture Decision

Status: Accepted  
Date: 2026-07-15  
Decision: Stabilize the current Express/Vercel MVP.

## Context

The repository contains historical frontend and service experiments, but production routing is controlled by the root Express application. That application already owns customer sessions, administrator authorization, Supabase persistence, Stripe checkout and signed webhooks, Resend delivery, readiness responses, product routes, and legal/support flows.

## Decision

Use Path A: preserve `server.js` as the application composition root and keep `api/index.js` as the Vercel function entry.

New route families may be placed in dependency-injected CommonJS modules under `routes/`. Shared deterministic metadata belongs under `lib/`. Static progressive enhancement belongs under `public/`. Database changes remain additive, idempotent migrations under `supabase/migrations/`.

## Why

- It preserves working provider and webhook behavior.
- It matches the active Vercel rewrite and local test harness.
- It allows route completeness and accessibility improvements without a high-risk framework migration.
- It keeps server-only credentials and authorization checks on the server.
- It can be verified with the existing Mocha/Supertest suite and direct Express route inspection.

## Boundaries

- `server.js` remains the only exported Express app.
- Stripe webhook raw-body routes must stay before URL-encoded/JSON middleware.
- Customer and administrator authorization is enforced server-side; UI visibility is not authorization.
- Paid access comes only from verified billing state or explicit authorized override.
- Provider failures return truthful setup-required/unavailable states; they never generate fake records or success messages.
- No database migration runs from a public or administrator web route.
- Route metadata must not place auth, customer, product-workspace, or administrator pages in the public sitemap.
- Optional motion, haptics, sound, location, camera, microphone, and similar device capabilities remain off or reduced by default unless a user deliberately enables them.

## Deployment shape

```text
Browser
  -> Vercel rewrite /(.*) -> /api
  -> api/index.js
  -> server.js
     -> public assets
     -> route modules
     -> Supabase Auth/REST/Storage
     -> Stripe Checkout/Portal/Webhooks
     -> Resend delivery
```

## Rejected alternative

A new Next.js application was rejected for this release. It would require reimplementing or bridging hundreds of routes plus auth cookies, raw webhook parsing, provider fallbacks, and tests before it could reach parity. That may be reconsidered only as a separately scoped migration with compatibility tests and a reversible cutover.

## Consequences

The current app remains deployable with low structural risk. The tradeoff is that `server.js` is still large and server-rendered HTML is less componentized than a modern frontend framework. Future refactors should extract bounded route groups while preserving the public contract and proof gates.

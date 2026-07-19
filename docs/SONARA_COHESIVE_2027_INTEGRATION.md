# SONARA Cohesive 2027 Integration

## Scope

The supplied cohesive design was integrated into the accepted root Express runtime as progressive enhancement. The change does not introduce a SPA, replace server-rendered routes, alter billing authorization, or change the database schema.

## Runtime integration

- `lib/sonara-brand-registry.cjs` is the canonical public presentation registry for company, platform, products, routes, logos, and approved plan prices.
- `lib/sonara-cohesive-homepage.cjs` renders the homepage from the registry and the live non-secret readiness object.
- `public/sonara-cohesive-2027.css` is scoped to `.sonara-home-v3` and the cohesive homepage shell.
- `public/sonara-cohesive-2027.js` adds product tabs, founder milestones, visible announcements, and fine-pointer depth. It does not enable sound or haptics.
- `scripts/apply-cohesive-2027-ui.cjs` applies the homepage and asset wiring idempotently at the end of `apply:runtime`.

## Database boundary

Supabase Postgres remains the authoritative database. This integration adds no migration, policy, secret, or customer-data mutation. The public page reports the existing readiness contract, including database, payment, webhook, email, founder/admin, and legal-review states.

The organization setup compatibility fix already merged to `main` remains responsible for the hosted legacy `company_key` and `created_by` requirements. An authenticated deployed organization-creation smoke test remains required before that write path is called production-proven.

## Brand system

The parent mark is the SONARA Trinity Loop. It represents Business Builder, Creator Studio, and Growth Studio connected around one trusted center. Product marks remain distinct and use the accepted light-first palette.

## Verification contract

Required before merge:

- deterministic patch applies twice without drift;
- full tests, typecheck, lint, build, dependency scan, Docker, route smoke, database contract, route registry, and OpenAPI checks pass;
- Vercel Preview is READY for the exact head;
- homepage, CSS, JavaScript, logos, readiness, products, and pricing routes return expected responses;
- production deployment and exact SHA are verified after merge.

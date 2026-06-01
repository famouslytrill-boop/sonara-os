# Security Hardening

This repo is currently a static TypeScript web shell with generated deployment artifacts. Security work must not imply live server enforcement where no server route exists.

## Current Hardening

- Static build emits `_headers` for hosts that support header files.
- Local dev server applies the same security headers.
- CSP baseline includes `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, and `frame-ancestors 'none'`.
- Frame embedding is blocked with `X-Frame-Options: DENY`.
- MIME sniffing is blocked with `X-Content-Type-Options: nosniff`.
- Referrer leakage is reduced with `Referrer-Policy: strict-origin-when-cross-origin`.
- Browser capabilities are limited with `Permissions-Policy`.

## Setup-Mode Security Helpers

- Env validation blocks dangerous `NEXT_PUBLIC_*` secret names.
- API validation helpers define method, JSON, and body-size requirements for future routes.
- Rate-limit policies exist as stubs for billing, admin, webhooks, AI providers, file uploads, and payment link changes.
- CSRF helpers mark mutating routes as requiring token validation.
- Webhook signature helpers require raw body, timestamp tolerance, and HMAC match.
- File upload policy blocks storage until MIME checks, size limits, scanning, and storage rules are live.
- Sensitive action audit models exist for billing, owner lock, provider config, AI provider use, legal packets, payment links, and role changes.

## Launch Gate

Review `/security-center/launch-security-gate` before enabling live workflows. It is an admin-ready setup page and does not display secrets, payment data, customer records, webhook payloads, or uploaded files.

## Validation

Run:

```bash
pnpm run security:scan-artifacts
pnpm run validate:infrastructure
pnpm run typecheck
pnpm test
pnpm run build
pnpm run smoke
```

Do not treat this pass as production API hardening. Real API enforcement requires a server runtime, durable rate-limit storage, CSRF token issuance, webhook routes wired to raw-body verification, and durable audit writes.

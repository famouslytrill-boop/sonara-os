# Admin Setup

Admin routes are protected and must not be exposed without authentication.

## Temporary protection

Until OAuth-backed admin sessions are complete, admin routes require a server-only `ADMIN_ACCESS_TOKEN`.

Supported request methods:

- `Authorization: Bearer <token>` header
- `X-Admin-Token` header
- `X-Admin-Access-Token` header
- `?admin_token=<token>` query parameter for temporary manual browser review
- `/admin/login` browser form, which stores a signed HTTP-only session cookie

Prefer the bearer header or browser login flow. The query parameter is temporary and should only be used for manual review over HTTPS. Never display the token in the UI. Never commit the token.

## Routes

- `/admin`
- `/admin/support`
- `/admin/billing`
- `/admin/env-readiness`

## Required Vercel variables

- `ADMIN_ACCESS_TOKEN`
- `ADMIN_EMAILS`

`ADMIN_EMAILS` is reserved for OAuth-backed authorization once persistent sessions are enabled.

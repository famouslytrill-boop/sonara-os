# Admin Setup

Admin routes are protected and must not be exposed without authentication.

## Temporary protection

Until OAuth-backed admin sessions are complete, admin routes require a server-only `ADMIN_ACCESS_TOKEN`.

Supported request methods:

- `X-Admin-Access-Token` header
- `Authorization: Bearer <token>` header
- `?token=<token>` query parameter for manual browser review

Never display the token in the UI. Never commit the token.

## Routes

- `/admin`
- `/admin/support`
- `/admin/billing`
- `/admin/env-readiness`

## Required Vercel variables

- `ADMIN_ACCESS_TOKEN`
- `ADMIN_EMAILS`

`ADMIN_EMAILS` is reserved for OAuth-backed authorization once persistent sessions are enabled.

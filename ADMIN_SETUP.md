# Admin Setup

Admin routes are protected and must not be exposed without authentication.

## Temporary protection

Until OAuth-backed admin sessions are complete, admin routes require a server-only founder password.

Preferred production variable:

- `ADMIN_PASSWORD_HASH`

Temporary fallback variables:

- `ADMIN_PASSWORD`
- `ADMIN_ACCESS_TOKEN` legacy fallback only

`ADMIN_PASSWORD_HASH` uses this format:

```text
scrypt$saltHex$hashHex
```

Generate it locally without committing the value:

```powershell
node -e 'const crypto=require("node:crypto"); const password=process.argv[1]; const salt=crypto.randomBytes(16).toString("hex"); const hash=crypto.scryptSync(password, Buffer.from(salt,"hex"), 64).toString("hex"); console.log("scrypt$"+salt+"$"+hash);' "PASTE_STRONG_PASSWORD_HERE"
```

Supported request methods:

- `/admin/login` browser form, which accepts the founder password and stores a signed HTTP-only session cookie
- `Authorization: Bearer <legacy value>` header for temporary break-glass compatibility
- `X-Admin-Token` or `X-Admin-Access-Token` header for temporary break-glass compatibility
- `?admin_token=<legacy value>` query parameter for temporary manual browser review

Prefer the browser login flow. The query parameter is temporary and should only be used for manual review over HTTPS. Never display passwords, hashes, or legacy access values in the UI. Never commit them.

## Routes

- `/admin`
- `/admin/support`
- `/admin/billing`
- `/admin/env-readiness`

## Required Vercel variables

- `ADMIN_PASSWORD_HASH`
- `ADMIN_EMAILS`

`ADMIN_EMAILS` is reserved for OAuth-backed authorization once persistent sessions are enabled.

`ADMIN_PASSWORD` may be used as a short-lived fallback only if a hash cannot be generated before deployment. `ADMIN_ACCESS_TOKEN` remains supported only for legacy header/query automation and should be replaced.

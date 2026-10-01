> **Retired on 1 October 2026.** The operator console this describes was removed
> at the owner's instruction: 58 registered routes under `/admin` and
> `/api/admin`, the admin login and session, and the `requireAdmin` gate. Every
> path named below now answers 404, and
> `tests/the-operator-console-is-gone-and-so-is-its-bypass.test.js` keeps it that
> way. The business-owner controls that replaced the customer-facing part of this
> are at `/owner/administration`.
>
> Kept as history, in `docs/archive/` so nothing reads it as a current
> instruction. Do not follow the steps below.

# Admin System

SONARA admin access is organization-scoped. A user must have an active organization membership with an owner/admin role before protected admin screens should unlock.

## Access Model

- Logged-out users are sent to `/login`.
- Signed-in users without a workspace or membership receive setup guidance.
- Owner/admin users can access admin command surfaces.
- Service-role operations stay server-only.
- Sensitive actions require audit coverage and owner review before production enablement.

## Bootstrap

Use `docs/admin/OWNER_BOOTSTRAP.md` for first-owner setup. The owner email must sign in once before SQL bootstrap is run, because Supabase Auth owns the user record.

## Server-Only Rules

- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.
- Never put service-role credentials in `NEXT_PUBLIC_*`.
- Never perform service-role admin actions from client components.
- Never paste service-role keys into screenshots, docs, or public comments.

## Launch Checks

```powershell
pnpm run verify:env
pnpm run verify:db
pnpm run typecheck
pnpm run build
```

> This block used to open with `pnpm run check:env-safety` and
> `pnpm run check:risky-features`. Neither is defined in `package.json`, so the
> checklist failed on its first line. Corrected 18 September 2026.
> `pnpm run verify:env` is the live equivalent for the first: it fails the build
> when the code reads a variable nobody has classified. There is no successor to
> the second — `pnpm run verify:launch` runs the whole release chain if you
> want everything.


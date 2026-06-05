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
pnpm run check:env-safety
pnpm run check:risky-features
pnpm run verify:db
pnpm run typecheck
pnpm run build
```

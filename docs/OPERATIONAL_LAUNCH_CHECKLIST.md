# Operational Launch Checklist

## A. Code Readiness

- `pnpm install --frozen-lockfile` passes.
- `pnpm run lint` passes.
- `pnpm run typecheck` passes.
- `pnpm run build` passes.
- No secret leakage.
- No `package-lock.json`.
- No dead public routes.
- No dead sidebar links.
- Password visibility works on password fields.
- Google login is wired and documented.
- Phone OTP login is wired and documented.
- Language preference saves for signed-in users.
- Metric/imperial unit preference saves for signed-in users.

## B. Vercel Readiness

- Env vars added.
- Production deployment successful.
- Custom domain configured if available.
- HTTPS active.
- Build cache cleared after env changes.
- Install command is `pnpm install --frozen-lockfile`.
- Build command is `pnpm run build`.

## C. Supabase Readiness

- Auth Site URL configured.
- Redirect URLs configured.
- Email auth enabled.
- Google provider configured if used.
- Phone provider and SMS provider configured if used.
- Migrations applied.
- RLS enabled.
- First user signup tested.
- Profile/org/membership created.
- User preferences persisted.
- Admin bootstrap verified.

## D. Stripe Readiness

- Test keys configured.
- Checkout tested.
- Webhook endpoint configured.
- Webhook signing secret configured.
- Duplicate webhook handling verified.
- Live keys not used until test mode passes.

## E. Resend Readiness

- Domain verified.
- From email configured.
- Support/contact emails tested.
- No API key exposure.

## F. Go/No-Go

GO only if auth, RLS, preferences, payments, email, and dashboard routes pass.

NO-GO if private data leaks, webhook verification fails, support intake fails silently, service-role keys appear client-side, or public pages show unsafe claims.

# ADR-0004: Supabase email/password and Google OAuth with server-side authorization

Status: ACCEPTED baseline, amended 2026-09-18

## Decision

SONARA uses Supabase Auth for customer identity. Email/password and Google OAuth both terminate in the same server-managed SONARA session contract: HttpOnly access/refresh cookies, server-side customer/workspace/business-manager/paid-or-owner/admin authorization, and fail-closed provider behavior.

Google OAuth is a required production sign-in method. SONARA starts Google through the hosted Supabase Google provider using PKCE, stores the PKCE verifier only in a short-lived HttpOnly cookie, exchanges the one-time callback code server-side at `/auth/callback`, and then passes the resulting Supabase session through the same SONARA two-factor checkpoint used by password login before issuing session cookies.

Google Client ID and Client Secret belong only in Supabase Authentication -> Providers -> Google. They are not duplicated into SONARA/Vercel environment variables. Google Cloud's authorized redirect URI is the Supabase Auth provider callback. Supabase's application redirect allow-list contains SONARA's `https://sonaraindustries.com/auth/callback`.

Production deployment must fail before migration/deploy if the live Supabase Auth settings do not report the Google provider enabled.

Magic links, phone OTP, passkeys, recovery expansion, and additional social providers are not customer-visible capabilities until their provider configuration, callback/session security, abuse controls, tests, and UI contracts are implemented together.

## Consequences

- Frontend code may render only server-documented authenticated, unauthorized, forbidden, and setup-required states.
- Client state never grants a role, workspace membership, or paid entitlement.
- Google and password login share the same authorization and two-factor boundary.
- No OAuth verifier, provider token, Google client secret, or Supabase service-role credential is exposed to browser JavaScript.
- OAuth return destinations are same-origin relative paths only; external and protocol-relative redirects are discarded.
- A visual Google button is not proof of readiness. The hosted Supabase provider must be verified by the production release gate.

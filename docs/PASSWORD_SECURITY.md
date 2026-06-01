# Password Security

SONARA One should use the configured auth provider for password handling. The app must not store plaintext passwords.

## Requirements

- Passwords handled by Supabase Auth or another reviewed auth provider.
- No plaintext password storage.
- No password logs.
- No password values in analytics.
- Password reset handled through provider-supported flows.
- MFA/passkey readiness documented before public launch.
- Auth redirect URLs include production and local development URLs.

## Admin Rules

- Admin routes require owner/admin role.
- Critical routes require owner role only.
- Session handling and role membership must be verified before launch.

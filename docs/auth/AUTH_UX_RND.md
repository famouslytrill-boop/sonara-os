# Auth UX R&D

## Current UX Contract

- Login supports Google, email magic link, and email/password flows when Supabase is configured.
- Signup collects name, email, password, product interest, and terms/privacy consent.
- Password fields include show/hide controls.
- Missing Supabase config should show a readiness message instead of crashing.
- Error copy must be generic and must not reveal whether an email address exists.

## Launch Rules

- OAuth providers are disabled until configured in Supabase.
- Password reset links require Supabase redirect URL setup.
- Admin access requires an active owner/admin organization membership.
- MFA and session/device management remain placeholders until implemented and tested.

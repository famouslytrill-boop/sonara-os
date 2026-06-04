# Password and MFA Policy

## Passwords

- Passwords are handled by Supabase Auth.
- The app must not store raw passwords.
- Password reset must use Supabase-managed reset links.
- Auth errors must stay generic.

## MFA

MFA is a launch-readiness placeholder until configured and tested in Supabase. Public copy must not claim MFA is live until it is enabled and verified.

## Admin Actions

High-risk admin actions should require reauthentication, owner/admin role checks, and audit logging before production execution.

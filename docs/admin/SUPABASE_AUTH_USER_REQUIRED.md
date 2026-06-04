# Supabase Auth User Required

Organization membership rows must point to a real Supabase Auth user.

The owner bootstrap flow intentionally fails closed when no matching
`auth.users.email` exists. Create or sign in with the intended owner email first,
then rerun the bootstrap.

Expected missing-user message:

`Create/login with this email first using Supabase Auth, then rerun owner bootstrap.`

Do not create placeholder membership rows for unknown users. Do not auto-admin a
new signup.

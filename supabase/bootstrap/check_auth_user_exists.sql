-- Check whether the intended first owner already exists in Supabase Auth.
-- Replace <OWNER_EMAIL> locally before running. Do not commit a real email.

select
  id,
  email,
  created_at,
  last_sign_in_at
from auth.users
where lower(email) = lower('<OWNER_EMAIL>');

-- Create/login with this email first using Supabase Auth, then rerun owner bootstrap.

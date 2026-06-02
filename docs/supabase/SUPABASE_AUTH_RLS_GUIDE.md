# Supabase Auth and RLS Guide

Launch auth depends on Supabase Auth plus organization membership rows.

Required behavior:

- Signed-out users see setup/sign-in gates.
- Signed-in users without an active organization membership see owner bootstrap guidance.
- Member users may read only organization-scoped records they are allowed to access.
- Owner/admin users may access admin surfaces after role verification.
- Service-role use is server-only.

RLS policies must be tested against anonymous, member, non-member, admin, and service-role cases before production migration approval.

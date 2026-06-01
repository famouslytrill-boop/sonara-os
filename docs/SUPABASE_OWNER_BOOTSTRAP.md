# Supabase Owner Bootstrap

Owner bootstrap is a manual provider task until a reviewed server-only admin workflow exists.

1. Create or sign in as the first owner user.
2. Find the auth user id in Supabase.
3. Create the row in `public.user_profiles`.
4. Create the organization row in `public.organizations`.
5. Create the membership row in `public.organization_members`.
6. Set `role` to `owner`.
7. Set `status` to `active`.
8. Verify protected app routes unlock only for the active owner.

Do not create an unauthenticated public owner-creation endpoint. Do not paste service-role keys into browser tools or prompts.

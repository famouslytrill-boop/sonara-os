# Supabase Preview Checks

Supabase Preview is required before merge when secrets are available.

## Behavior

- Skip only when `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID`, or `SUPABASE_DB_PASSWORD` is missing.
- Fail on real migration syntax errors, duplicate migration versions, missing relations, or invalid policy dependencies.
- Do not mark a skipped preview as a passed database validation.

## Manual Follow-up

After CI passes, rerun Supabase Preview and confirm production migration approval with the owner.

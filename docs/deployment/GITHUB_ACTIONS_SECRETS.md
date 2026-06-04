# GitHub Actions Secrets

## Supabase Preview

Required for Supabase Preview validation:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_ID`
- `SUPABASE_DB_PASSWORD`

If these are missing, the workflow should skip Supabase Preview with a clear reason. If present, migration errors must fail the workflow.

## Optional Provider Secrets

- `RESEND_API_KEY`
- `GITHUB_TOKEN` for custom sync jobs

Never commit real secrets to the repository.

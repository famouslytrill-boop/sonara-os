# Controlled Production Retry — 2026-07-26

This documentation-only commit intentionally retriggers the `Controlled Production Deployment` workflow after the repository `production` environment was reported to contain `SUPABASE_SERVICE_ROLE_KEY`.

## Required gates

The retry is successful only if the workflow completes all existing fail-closed stages:

1. protected production credential guard;
2. locked dependency installation and audit;
3. complete release-candidate verification;
4. linked Supabase migration dry run and apply;
5. production product-catalog database verification;
6. removal of temporary production environment material;
7. exact-source Vercel production deployment;
8. apex and `www` exact-commit verification;
9. authentication and restricted-route boundary checks;
10. production catalog-page and configured-plan verification.

No credential value is recorded in this file. A successful run is the evidence that the protected secret exists and is usable; a manual redeploy of an older Vercel build is not sufficient evidence.

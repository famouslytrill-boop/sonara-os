# Vercel deployment quota policy

## Incident

On July 23, 2026, the Vercel Hobby account reached the platform limit of 100 deployments per rolling 86,400-second window. Automatic preview deployments for feature-branch commits, repeated redeployments, and duplicate deployments of identical Git SHAs consumed the allowance before a validated production update could be deployed.

A follow-up test on July 24 exposed a second issue: the branch pattern `"*": false` did not suppress branch names containing `/`, such as `feature/company-product-lifecycle-20260724`. Those pushes still created Vercel previews.

## Permanent policy

`vercel.json` disables every automatic Git deployment:

```json
"git": {
  "deploymentEnabled": false
}
```

Production is deployed only through `.github/workflows/controlled-production-deploy.yml` after the repository validates the complete release candidate. That workflow:

1. installs the locked dependency graph;
2. blocks moderate-or-higher dependency findings;
3. runs the full SONARA validation suite;
4. previews and applies versioned Supabase migrations;
5. creates one Vercel production deployment from the validated `main` SHA;
6. verifies both production aliases and authentication boundaries.

Feature branches continue to run GitHub Actions but do not automatically create Vercel deployments. When a live preview is materially required, create exactly one deliberate manual preview from a reviewed commit and do not redeploy the same SHA repeatedly.

## Why an Ignored Build Step is not the fix

Vercel counts canceled deployments initiated through an Ignored Build Step against deployment quotas. SONARA prevents automatic Git deployment creation entirely and uses a controlled source deployment only after validation.

## Production release rules

1. Merge only validated changes to `main`.
2. Allow the controlled workflow to run database migrations and create one production deployment for the resulting `main` commit.
3. Do not use `--force` unless cache invalidation is part of a documented incident response.
4. Before manually redeploying, confirm that the current `main` SHA does not already have a READY production deployment.
5. Verify both production aliases, required public and protected routes, authentication boundaries, database migration state, and runtime errors before closing a release issue.
6. Leave provider credentials and approval-gated adapters disabled unless their separate acceptance process is complete.

## Capacity response

When the rolling quota is reached, leave the existing healthy production deployment and aliases untouched. Wait until enough deployments age beyond 86,400 seconds or upgrade the Vercel plan. Deleting prior deployments does not restore rolling deployment capacity.

# Vercel deployment quota policy

## Incident

On July 23, 2026, the Vercel Hobby account reached the platform limit of 100 deployments per rolling 86,400-second window. Automatic preview deployments for feature-branch commits, repeated redeployments, and duplicate deployments of identical Git SHAs consumed the allowance before the validated Growth Studio public update could be deployed.

## Permanent policy

`vercel.json` permits automatic Git deployments only for the `main` branch:

```json
"git": {
  "deploymentEnabled": {
    "main": true,
    "*": false
  }
}
```

Feature branches continue to run the repository's GitHub Actions validation suite. They do not automatically create Vercel preview deployments.

When a live preview is materially required, create exactly one manual preview from the reviewed branch or commit through the Vercel dashboard or CLI. Do not repeatedly redeploy the same SHA.

## Why an Ignored Build Step is not the fix

Vercel counts canceled deployments initiated through an Ignored Build Step against deployment quotas. The project therefore prevents non-main Git deployments before deployment creation through `git.deploymentEnabled`; it does not rely on `ignoreCommand` as a quota workaround.

## Production release rules

1. Merge only validated changes to `main`.
2. Allow one production deployment for the resulting `main` commit.
3. Do not use `--force` unless cache invalidation is part of a documented incident response.
4. Before manually redeploying, confirm that the current `main` SHA does not already have a READY production deployment.
5. Verify both production aliases, required public copy, authentication boundaries, and runtime errors before closing the release issue.

## Capacity response

When the rolling quota is reached, leave the existing healthy production deployment and aliases untouched. Wait until enough deployments age beyond 86,400 seconds or upgrade the Vercel plan. Deleting prior deployments does not restore rolling deployment capacity.

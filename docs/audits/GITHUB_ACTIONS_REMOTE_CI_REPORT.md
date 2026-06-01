# GitHub Actions Remote CI Report

## Workflow files

- `.github/workflows/ci.yml`
- `.github/workflows/open-source-update-watch.yml`

## Local workflow changes

- Workflows use `pnpm/action-setup@v4`.
- Workflows use `actions/setup-node@v5` with Node 22.
- Workflows use pnpm cache and `pnpm-lock.yaml`.
- Install commands use `pnpm install --frozen-lockfile`.
- Quality gates run through pnpm scripts.

## Remote status

Remote GitHub Actions status must be checked after pushing this branch. This report does not claim remote success before GitHub runs the workflows.

## Merge rule

Do not merge unless CI, dependency scan, route smoke, public claim checks, and migration review pass, and Supabase Preview either passes or intentionally skips due to missing secrets.

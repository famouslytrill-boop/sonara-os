# Security Notes

## Dependency Audit

No audit threshold was lowered in this sprint.

`pnpm audit --audit-level moderate` previously failed because Next.js stable `16.2.6` declares `postcss@8.4.31`, which is affected by GHSA-qx2v-qp2m-jg93. The repo now uses pnpm workspace overrides to resolve PostCSS to `8.5.15` across the workspace while keeping Next on the latest stable version.

Additional moderate findings were resolved by:

- Updating `stripe` to `22.1.1`, removing the vulnerable `qs` path from the Stripe dependency tree.
- Updating the pnpm override for `brace-expansion` to `5.0.6`.
- Keeping a single `postcss@8.5.15` version in the dependency graph.

## Package Manager Boundary

The repo uses pnpm only. `package-lock.json` files were removed, and CI installs from `pnpm-lock.yaml` with `pnpm install --frozen-lockfile`.

## Secret Handling

No real secrets should be committed. `.env.example` contains variable names and empty placeholders only. Service-role keys, Stripe secrets, webhook secrets, and database passwords must stay server-side.

# Windows package-manager access

SONARA intentionally keeps `pnpm-lock.yaml` as its dependency contract. Replacing it with npm or Yarn would require a reviewed lockfile migration and could change the resolved dependency graph.

On Windows, Corepack selects the pinned `pnpm@12.7.0`. If Smart App Control blocks `pnpm-native.exe`, do not disable protection, add a broad exclusion, or install an unreviewed executable. Run the repository's pull-request checks on GitHub Actions instead; they install the same lockfile on a clean Linux runner.

```powershell
node scripts/bootstrap-local.mjs
```

The bootstrap prints the Actions link and exits with a clear policy message when Windows blocks the executable. After Microsoft or the device administrator approves a publisher-supported distribution, rerun the same command.

The blocked binary was verified against the published `@pnpm/exe.win32-x64@12.7.0` npm archive. Microsoft Smart App Control does not provide a per-application exception for this policy.

# Signal OS

Signal OS is scaffolded as a small, dependency-free workspace around the phased gate contracts:

- reconciled shared domain types in `packages/core/src/lib/types.ts`
- canonical `DawName` naming
- five final export bundle tiers
- required session, analysis, compose, and decision result stores
- runtime adapters with an event bus
- workflow state machine
- Provider Gateway music-style safety
- export provenance files
- billing and admin route helpers
- smoke coverage for package scripts

Run the gate locally with:

```sh
npm run typecheck
npm run build
npm run smoke
```

The repository intentionally avoids new product-feature surface in this sprint.

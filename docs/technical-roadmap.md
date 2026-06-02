# SONARA Technical Roadmap

This roadmap tracks the technical foundation required to move SONARA Industries from mock MVP to launch-ready system without forcing heavy services into local builds.

## Technical Principles

- Keep local builds independent of Docker, Supabase, Qdrant, FFmpeg, Python workers, and external services.
- Keep service-role secrets server-only.
- Keep Provider Gateway as the only path for AI/provider calls.
- Keep media capture and sound user-activated with no autoplay.
- Keep all heavy systems behind optional adapters until explicitly configured.

## Roadmap 1: Workspace Hygiene

1. Keep package scripts consistent across `core`, `runtime`, `provider-gateway`, `export`, `routes`, and `web`.
2. Keep `.ts` and `.tsx` tooling in sync across typecheck and build scripts.
3. Maintain a source inventory for routes, adapters, stores, and docs.
4. Remove dead files only after import, export, route, and smoke checks prove they are unused.
5. Run typecheck and build after every cleanup batch.

## Roadmap 2: Route And UI Infrastructure

6. Keep `routes/route-manifest.ts` as the single source for navigation and launch routes.
7. Add route metadata for auth status, workflow requirements, and launch readiness.
8. Keep workflow guard copy centralized.
9. Keep Launch Readiness route checks smoke-covered.
10. Add route-level regression tests before changing navigation behavior.

## Roadmap 3: Environment And Secrets

11. Keep public environment variables limited to safe client values.
12. Keep service-role access behind server-only helpers.
13. Add validation for partial Supabase configuration.
14. Add audit checks for accidental public service-role prefixes.
15. Document configured versus local modes.

## Roadmap 4: Provider Gateway And Safety

16. Keep clone-language detection in the safety layer.
17. Add request IDs and warnings to provider responses.
18. Add prompt size, cost limit, and provider capability checks.
19. Attach safety warnings to provenance when relevant.
20. Keep provider adapters optional and testable without network calls.

## Roadmap 5: Persistence Adapters

21. Keep localStorage adapters typed and versioned.
22. Add migration helpers for previous local session keys.
23. Add no-op remote adapters for future Supabase storage.
24. Keep all remote persistence disabled when configuration is absent.
25. Add tests for adapter fallback behavior.

## Roadmap 6: Export And Provenance

26. Keep final export tiers in one utility.
27. Validate export payloads before generating downloadable artifacts.
28. Attach session, analysis, compose, mutation, and Rights Passport data.
29. Add manifest generation for local exports.
30. Add smoke checks for export tier integrity and provenance coverage.

## Roadmap 7: Media Stack

31. Keep microphone readiness based on MediaDevices API.
32. Keep video readiness based on MediaDevices and MediaRecorder checks.
33. Keep Web Audio UI sound disabled until user activation.
34. Keep FFmpeg as a future optional adapter with LGPL/GPL notes documented.
35. Add SSR-safe tests for all browser API helpers.

## Roadmap 8: Quality Gates

36. Keep visible UI emoji-free.
37. Keep blocked wording scans in smoke coverage.
38. Keep old export tier scans active across source, docs, and scripts.
39. Run `pnpm run check` before release candidate packaging.
40. Record final readiness status in Launch Readiness before launch handoff.

## Completion Gate

Every technical batch ends with:

```sh
pnpm run typecheck
pnpm run build
```

When a batch changes tests, smoke scripts, routes, media helpers, provider safety, or export behavior, also run:

```sh
pnpm test
pnpm run smoke
```

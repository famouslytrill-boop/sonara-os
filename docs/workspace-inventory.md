# SONARA Workspace Inventory

This inventory records the launch-foundation source areas that must stay coherent as the app moves toward release.

## Packages

- `packages/core`: shared domain types, stores, and workflow state machine.
- `packages/runtime`: runtime adapters and event bus.
- `packages/provider-gateway`: provider routing and music-style safety.
- `packages/export`: export bundle generation and provenance files.
- `packages/routes`: billing and admin route helpers.
- `packages/web`: local mock MVP shell, launch readiness, media readiness, and product UI scaffolds.

## Source Areas

- `packages/web/src/app`: route-specific page renderers and launch readiness surfaces.
- `packages/web/src/pages`: Create to Export workflow screens.
- `packages/web/src/lib`: environment, feature flags, logger, and server-secret helpers.
- `packages/web/src/media`: browser-native audio and video readiness helpers.
- `packages/web/src/providers`: UI-facing Provider Gateway scaffold.
- `packages/web/src/routes`: route manifest and navigation metadata.
- `packages/web/src/safety`: anti-clone music-style safety helpers.
- `packages/web/src/sound`: optional Web Audio UI sound engine.
- `packages/web/src/ui`: reusable UI panels and workflow guard card.
- `packages/web/src/workflows`: workflow route guard contracts.

## Documentation

- `docs/media-stack.md`: browser media, Web Audio, MediaRecorder, and FFmpeg notes.
- `docs/launch-foundation.md`: launch architecture and safety boundaries.
- `docs/product-roadmap.md`: product sequencing.
- `docs/technical-roadmap.md`: technical sequencing.
- `docs/completion-roadmap-150.md`: remaining execution batches.

## Audit Command

Run:

```sh
pnpm run audit:workspace
```

The audit checks package scripts, package entry points, and inventory counts without deleting files.

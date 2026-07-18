# ADR-0002: Frontend Architecture

Status: Accepted

## Decision

Keep the existing `packages/web` TypeScript SPA and its canonical route manifest for the current launch path. Do not migrate to Next.js, React framework routing, Expo, or another frontend runtime without a parity plan and owner approval.

## Consequences

- Claude works within current rendering contracts.
- Route additions update manifest, renderer, tests, and shared registry.
- Progressive enhancements remain optional and build-safe.


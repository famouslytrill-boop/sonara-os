# Model Router

## Public name

Model Router

## Internal name

OpenModelCodingRouter

## Purpose

Defines the launch-safe scaffold, ownership boundary, and implementation notes for Model Router.

## Products used by

- Business Builder
- Creator Studio
- Growth Studio

## Feature flags

- See packages/web/src/lib/shared/feature-flags.ts for the exact typed flag defaults.

## Safe use cases

- Planning and review.
- Typed report generation.
- Feature-gated local scaffolding.

## Blocked use cases

- Production automation without approval.
- Secret handling in client code.
- Customer-facing claims that are not verified.
- Public exposure of internal engine names.

## Launch gate

Must pass lint, typecheck, build, infrastructure validation, unsafe flag verification, and manual review.

## Human review requirements

Human review is required before auth, payments, privacy, security, billing, data deletion, customer contact, publishing, or production migrations change behavior.

## Integration points

- Shared feature flags
- Module registry
- Engine registry
- Trust Shield
- Launch Security Gate
- Project Execution Spine
- Final Launch Hardening
- Implementation Sequencer

## Current status

Scaffolded and not production-ready until implementation, credentials, persistence, and review gates are complete.

## Next implementation notes

Follow the Q1 build order in the implementation sequencer and keep beta/admin/research modules gated.

# ADR-0009: OpenAPI contract follows the registered Express runtime

Status: ACCEPTED (2026-07-18)

## Context

The production API is registered across `server.js` and route modules, while the shared API contract was previously a stub. A handwritten subset could drift from the runtime and give the frontend or an external client false confidence.

## Decision

`openapi/sonara.yaml` is the canonical machine-readable contract for every registered `/api/*` method/path. The initial document preserves deployed response behavior and the existing error shape. `pnpm run verify:api` compares the OpenAPI operations with the loaded Express stack in both directions and is part of `verify:launch`.

OpenAPI changes and runtime route changes must land together. Response-envelope, authentication, authorization, or compatibility changes require an explicit contract-first handoff and, when breaking, a separate migration ADR.

## Consequences

- Missing or stale method/path documentation fails the launch gate.
- Generic success schemas are acceptable only for the initial heterogeneous legacy surface; endpoint-specific schemas should replace them incrementally without silently changing runtime output.
- Loading the Express application is the verification source of truth, so route registration must remain side-effect safe.
- The public page route registry and the OpenAPI API registry remain separate gates with separate counts.

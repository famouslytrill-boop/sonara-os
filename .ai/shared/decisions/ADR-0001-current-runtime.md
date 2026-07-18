# ADR-0001: Current Runtime

Status: Accepted

## Context

The master directive references an older Express runtime, but this checkout has no root `server.js`. Its build and Vercel configuration target `packages/web/dist` plus root API functions.

## Decision

Treat the current production architecture in this checkout as a static TypeScript web application built from `packages/web`, served from `packages/web/dist`, with Vercel serverless functions under `api/`.

## Consequences

- Do not implement changes against a nonexistent Express renderer.
- Runtime migration requires a new ADR, route/API parity, deployment changes, and rollback plan.


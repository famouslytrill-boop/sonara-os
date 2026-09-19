# SONARA Platform Foundation v1

Status: implementation contract. This document does not activate background workers or grant new production authority.

## Decision

SONARA uses one shared platform kernel across Business Builder, Creator Studio, Growth Studio, agents, and future interfaces. Product surfaces may specialize their workflows, but they must not invent independent tenant, approval, audit, usage, notification, or execution semantics.

The executable contract lives in `lib/sonara-platform-kernel.cjs`.

## Canonical domains

The kernel names seven shared domains:

- identity: organizations, workspaces, memberships, roles, permissions
- operations: projects, tasks, records, approvals
- assets: assets, files, deliverables
- automation: workflows, workflow runs, events, connectors
- intelligence: AI operations, agents, memory
- commercial: billing, entitlements, usage
- experience: notifications, search, audit

These names are a cross-product contract, not a requirement to create a new table for every noun. Existing canonical tables remain preferred.

## Execution envelope

Every future workflow execution should be representable by one envelope containing:

- organization identity
- human actor identity
- workflow key
- action type
- idempotency key
- correlation id
- optional connector/resource identity
- approval state
- authority classification
- metadata

The kernel requires organization, actor, workflow, action, and idempotency identity. Missing identity fails closed.

The action type is classified by `lib/sonara-agent-authority.cjs`. Unknown actions require owner review. Product code must not override that result by declaring an action safe.

## Lifecycle

The common execution lifecycle is:

`planned -> awaiting_approval -> ready -> running -> succeeded|failed|cancelled`

For actions that do not require approval:

`planned -> ready -> running -> succeeded|failed|cancelled`

Terminal states cannot re-enter execution. Retry must create or explicitly model a new attempt rather than silently changing a completed record.

## Event boundary

`buildPlatformEvent()` derives event identity from the execution envelope so tenant, actor, correlation, workflow, resource, and idempotency identity cannot drift independently.

Persistence should reuse the existing durable-event/outbox and observability infrastructure. This contract deliberately does not start a consumer.

## Product adoption order

1. Operations
2. Creator / Media
3. Growth / Audience
4. Agent control plane
5. Spatial / 3D interfaces
6. External developer platform

Each product adopts the kernel incrementally. Existing working routes do not need a risky bulk rewrite.

## Security invariants

- Tenant identity is mandatory.
- Human actor identity is mandatory for user-triggered workflow envelopes.
- Unknown actions fail into approval.
- Sensitive action classification comes from the shared authority module.
- Idempotency identity is mandatory.
- Lifecycle transitions are explicit and one-way.
- Events inherit tenant and execution identity from the envelope.
- This module does not bypass RLS, the tenant guard, entitlement checks, or provider gates.
- This module does not activate autonomous production execution.

## Definition of done for this engineering slice

The platform has one executable, tested contract that Operations, Creator, Growth, agents, and connectors can adopt without inventing separate execution semantics. Production migration and worker activation remain separately gated changes.

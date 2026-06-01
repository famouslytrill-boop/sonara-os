# AI Provider Registry

## Problem

The platform needs a controlled registry for AI/provider calls so implementations use Provider Gateway, safety checks, cost boundaries, and policy-aware routing.

## Users

- Developers
- Admin reviewers
- Product owners

## User Stories

- As a developer, I can register provider capabilities safely.
- As a reviewer, I can verify provider calls go through the gateway.
- As an owner, I can keep unsafe automation disabled.

## Non-Goals

- No provider policy bypass.
- No system prompt extraction.
- No customer-facing model racing.

## Data Model Notes

- Track provider name, task type, enabled status, cost policy, safety notes, and timestamps when persistence exists.
- Keep local mock provider behavior safe.
- Store secrets only server-side.

## Route Requirements

- Internal/admin registry view.
- No public exposure of internal provider details by default.
- Setup-mode when providers are not configured.

## API Requirements

- All provider calls route through Provider Gateway.
- Enforce prompt-size and anti-clone safety policies.
- Do not expose provider secrets to client code.

## Security Requirements

- Block jailbreak and policy-bypass tooling.
- Keep provider keys server-only.
- Require human review for new provider classes.

## Privacy Requirements

- Do not send private customer data without consent.
- Keep prompt logs scrubbed or disabled until policy exists.
- No private log upload to third parties by default.

## Acceptance Criteria

- Provider registry exports typed provider metadata.
- Unsafe provider flags remain false.
- Gateway safety is enforced before calls.

## Test Requirements

- Test unsafe clone request rewriting or blocking.
- Test oversized prompt rejection.
- Test no client-side secret access.

## Launch Gate Requirements

- Typecheck passes.
- Build passes.
- AI safety review completed before live provider activation.

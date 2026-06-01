# Approved External Services

Status: no new approved integrations in this sprint.

The Open-Source Intake Registry does not approve external services by itself. A project can only move
to approved adapter or approved self-hosting after:

1. License review.
2. Security review.
3. Product-fit review.
4. Owner approval.
5. Audit-log entry.
6. Configuration exists in the target environment.

## Current State

- No owner-provided candidate is marked as a live integration.
- Some projects are reference-only or concept-adapter candidates.
- Some projects are beta-gated or review-required.
- Blocked tools remain blocked by default.

## Documentation Requirement

When a service is approved later, add:

- Service name and repository.
- Approved use mode.
- Owner of integration.
- Required env vars.
- Secret storage boundary.
- Data handled.
- Rollback plan.
- Review date.

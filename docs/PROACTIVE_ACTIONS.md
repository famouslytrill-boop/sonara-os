# Proactive Actions

Proactive actions let each entity propose, approve, track, and log operational work.

Route:

- `/dashboard/entities/[entitySlug]/actions`

## Rules

- Operators, admins, and owners can propose actions.
- High-risk actions require human approval.
- Destructive actions require owner/admin approval.
- Public-facing, billing, role, database-write, mass-notification, and deployment actions are approval-gated.
- Action runs are scoped to an entity and stored separately from other entities.

## Setup Required

Live persistence and assignment require authenticated memberships and migration `008_entity_agent_operations.sql`.

# Entity Infrastructure

SONARA Industries uses four separated operating entities:

- `parent_company`
- `creator_music_technology`
- `business_operations`
- `community_public_information`

Migration `supabase/migrations/008_entity_agent_operations.sql` adds the entity model, membership roles, settings, audit logs, browser workspace records, heartbeats, proactive actions, agent registry, automations, and connectors.

## Data Boundary

Entity-owned records are scoped by `entity_id`. Users read private records only when `entity_memberships` contains their `auth.uid()` for that entity. Parent governance is not a shared customer dashboard; it is an administrative policy layer.

## Roles

- `owner`
- `admin`
- `operator`
- `viewer`

Owners/admins can manage settings, membership, agents, connectors, and automations. Operators can propose work and start non-destructive runs where policies allow. Viewers can read scoped records only.

## RLS Helpers

- `public.is_entity_member(entity_id)`
- `public.has_entity_role(entity_id, roles[])`
- `public.can_manage_entity(entity_id)`

These functions use `auth.uid()` and a locked `search_path`. Private tables do not include broad public policies.

## Manual Step

Apply migration `008_entity_agent_operations.sql` in Supabase after backing up production. Do not apply it automatically from this repo without human review.

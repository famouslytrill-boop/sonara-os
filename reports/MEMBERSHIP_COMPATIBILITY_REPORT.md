# Membership Compatibility Inventory

Date: 2026-07-18
Owner: Codex (Agent A)
Change type: analysis and compatibility decision only; no migration or runtime behavior change

## Result

The apparent naming conflict represents three real authorization domains plus one global override mechanism. The safe decision is not to normalize them into a single table. ADR-0010 makes `organization_memberships` canonical for customer tenancy while preserving `business_memberships` and `entity_memberships` for their narrower domains.

## Inventory

| Source | Scope and key | Roles/status | Current runtime use | Compatibility rule |
| --- | --- | --- | --- | --- |
| `organization_memberships` | Customer tenant; unique `(organization_id, user_id)` | Roles include owner/admin/developer/support/business_owner/creator/agency/member/viewer; status active/invited/suspended | Account setup writes it; organization lookup reads active rows; RLS helpers and broad customer data policies depend on it | Canonical customer membership and the implementation behind generic “workspace membership” language |
| `business_memberships` | Business Builder workforce; unique `(workspace_id, user_id)` plus `organization_id` | Runtime manager check accepts active owner/manager; employee invites create narrower workforce access | Employee manager authorization, workforce counts, invite acceptance; last-resort organization lookup fallback | Product-specific membership only; never the primary customer tenancy source |
| `entity_memberships` | Internal operating entity; unique `(entity_id, user_id)` | Enum owner/admin/operator/viewer | RLS for entity settings, agent runs, incidents, research, automations, connectors, and related internal records | Separate internal authorization domain; never grants customer or paid-product access |
| `user_roles` | Global per-user role grants | Server recognizes owner/admin/customer/employee | Owner/admin override and protected administration | Global override, not organization or workspace membership |
| `organization_members` | Legacy table name not created by repository migrations | Not defined in current migration contract | Read-only fallback in `getCustomerPrimaryOrganization` | Transitional compatibility lookup only; no new writes |
| `workspace_memberships` | No physical table by design | N/A | Mentioned by target/directive language | Alias concept implemented by `organization_memberships`; do not create |

## Evidence and gaps

- Repository migrations explicitly state `workspace_memberships -> organization_memberships` and avoid recreating an equivalent table.
- General RLS helpers (`is_org_member`, `has_org_role`) use active `organization_memberships` rows.
- Business manager middleware queries `business_memberships` for active owner/manager access and optional workspace selection.
- `business_memberships.workspace_id` is required in the current table declaration, but that declaration does not add a foreign key to `business_workspaces`. This is a hardening candidate, not a safe assumption for an immediate migration.
- `getCustomerPrimaryOrganization` checks canonical organization membership first, then legacy `organization_members`, then active business membership. The order is safe for compatibility, but the two fallbacks should be measured and retired only after live-state evidence.
- Role vocabularies intentionally differ. A mechanical role-name merge would be breaking and could widen privileges.

## Recommended migration sequence if normalization is later approved

1. Read-only production inventory: row counts, orphaned workspace IDs, organization/workspace mismatches, duplicate users, active statuses, and actual fallback usage.
2. Publish an explicit role mapping and decide whether Business Builder managers must also hold general organization membership.
3. Backfill missing canonical organization memberships only with owner-approved rules and an audit trail.
4. Add Business Builder workspace/organization consistency constraints through a new CLI-generated migration, after cleaning invalid rows.
5. Add positive owner/manager/employee tests and negative anonymous, wrong-organization, wrong-workspace, suspended, and cross-entity tests.
6. Remove legacy server fallbacks only after a compatibility window and production telemetry prove zero dependence.

## Immediate implementation rule

New general customer flows write and read `organization_memberships`. New Business Builder employee flows use `business_memberships` with an explicit parent organization. Internal entity features use `entity_memberships`. No client may combine those grants or treat a successful lookup in one domain as authorization in another.

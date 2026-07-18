# ADR-0010: Separate customer tenancy, Business Builder workforce, and internal entity memberships

Status: ACCEPTED compatibility baseline (2026-07-18)

## Context

The repository uses several membership names that represent different authorization domains. Treating them as interchangeable would create cross-tenant and privilege-escalation risk. The master directive also uses the generic term `workspace_memberships`, but the production schema deliberately reused existing tables instead of creating another tenancy source.

## Decision

1. `organization_memberships` is the canonical customer-tenancy membership table. An organization is the account/workspace boundary for shared product data, billing, service requests, storage, and general customer access.
2. `workspace_memberships` is documentation language only and maps to `organization_memberships`. Do not create a parallel table or expose it as a second source of truth.
3. `business_memberships` is a distinct Business Builder workforce membership scoped to a `business_workspaces` record and its parent organization. It controls owner/manager/employee operational access; it is not a replacement for general organization membership.
4. `entity_memberships` is a distinct internal operating-entity authorization domain for entity agents, settings, incidents, research, connectors, and automations. It must not grant customer organization, product, billing, or storage access.
5. `user_roles` is a separate global owner/admin override mechanism, not tenancy membership.
6. The server's `organization_members` and `business_memberships` lookups inside `getCustomerPrimaryOrganization` are compatibility read fallbacks only. New customer organization memberships must be written to `organization_memberships`. Remove fallbacks only after live data inventory and migration evidence show they are unused.

## Naming contract

- Use `organizationId` / `organization_id` for the customer tenant.
- Use `businessWorkspaceId` / `workspace_id` only inside Business Builder workforce APIs and records.
- Use `entityId` / `entity_id` only for internal operating-entity infrastructure.
- API documentation must not use a bare `workspaceId` when the authorization domain is ambiguous.

## Consequences

- No migration or runtime behavior changes are authorized by this ADR.
- Future membership APIs must name the authorization domain explicitly and preserve fail-closed server authorization.
- Before hardening `business_memberships`, verify live rows, parent-organization consistency, workspace referential integrity, role/status vocabulary, and invite acceptance behavior. Apply any constraint or foreign-key change through a new migration with cross-tenant negative tests.
- Frontend role labels may be user-friendly, but may not collapse these domains into one client-side role or infer access across them.

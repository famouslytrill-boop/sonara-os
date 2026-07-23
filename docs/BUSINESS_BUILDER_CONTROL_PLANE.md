# Business Builder Control Plane

Business Builder is the customer-controlled operating layer for physical, online, and hybrid businesses created, connected, or imported through SONARA Industries.

## Customer ownership model

The customer controls the business profile, physical locations, online channels, team, customers, products and services, inventory, assets, orders, business integrations, permissions, exports, archives, and ownership-transfer requests.

SONARA controls platform infrastructure, authentication, billing enforcement, tenant isolation, abuse prevention, provider safety boundaries, migrations, and audited support intervention.

## Production routes

### Customer interface

- `GET /business-builder/control-center`
- `GET /business-builder/businesses`
- `GET /business-builder/businesses/:businessId`

### Business lifecycle API

- `GET /api/business-builder/control-plane`
- `GET /api/business-builder/businesses`
- `POST /api/business-builder/businesses`
- `GET /api/business-builder/businesses/:businessId`
- `PATCH /api/business-builder/businesses/:businessId`
- `DELETE /api/business-builder/businesses/:businessId`
- `POST /api/business-builder/businesses/:businessId/archive`
- `POST /api/business-builder/businesses/:businessId/restore`
- `POST /api/business-builder/businesses/:businessId/ownership-transfers`

### Allowlisted operational resources

The following resource keys are supported under `/api/business-builder/businesses/:businessId/:resource`:

- `locations`
- `channels`
- `employees`
- `services`
- `customers`
- `inventory`
- `assets`
- `orders`
- `integrations`
- `permissions`

Each resource supports organization- and business-scoped listing and creation. Individual records support update and soft archive through `/:id`.

The API never accepts a table name from the caller. Resource keys resolve through a fixed server-side registry.

## Access and billing

All control-plane routes use `requirePaidOrOwnerAccess("business_builder")`.

Access is granted when:

1. The requester is an authenticated founder, owner, or administrator; or
2. The requester's organization has a webhook-backed active Business Builder entitlement and the requester holds the required business permission grant.

Owner-only operations include integration administration, permission administration, destructive soft deletion, and ownership transfer.

## Tenant isolation

Every operation verifies:

- Authenticated user
- Active organization membership
- Webhook-backed entitlement or founder/owner override
- Business belongs to the same organization
- Allowlisted resource
- Required permission
- Resource belongs to the same organization and business

Service-role writes are performed only after these checks. New tables also have RLS policies for organization-member reads, owner/admin writes, and service-role execution.

## Ownership transfers

Ownership transfer is intentionally two-stage:

1. Current owner creates a seven-day pending request.
2. Recipient must be authenticated and explicitly accept through a separate completion workflow.

Creating the request never silently changes ownership.

## Integration credentials

`business_integration_connections` stores provider state, capabilities, safe settings, and an opaque `credential_reference` only. Provider secrets and OAuth tokens must remain in the provider, a server-only vault, or protected environment storage.

The API select contract omits `credential_reference`, and the migration revokes direct authenticated selection of that column.

## Migrations

- `20260723060000_business_builder_control_plane.sql`
- `20260723060500_business_integration_connections.sql`

These migrations are additive and do not reset or destructively replace existing business operations tables.

## Required production validation

Before declaring the control plane customer-ready:

1. Apply both migrations to production.
2. Create one physical business, one online business, and one hybrid business.
3. Create and reopen every allowlisted resource type.
4. Verify update and archive behavior.
5. Verify one ownership-transfer request without completing it.
6. Verify an employee with no grants is denied.
7. Grant one scoped permission and verify only that action becomes available.
8. Verify Customer A cannot access Customer B's business or records.
9. Verify cancellation or payment failure removes paid access according to billing policy.
10. Verify audit events exist for creates, updates, archives, deletes, permission changes, and ownership-transfer requests.

# Parent and child operating model — 2026-10-08

SONARA Industries is the corporate parent brand and owns strategy, treasury, legal policy, group finance, procurement, security, brand, shared discovery and independent review boards. Corporate subsidiaries must not be claimed without matching incorporation records.

SONARA One is the shared **application platform**, not a kernel. Its functions are verified identity/session, organization membership, permission grants, approvals, connector gateways, usage accounting, rate limiting, audit, job queues, object storage, observability and disaster recovery.

Business Builder owns industry workspaces, merchant storefronts, inventory, bookings, invoices, POS/provider adapters, staff and customer operational proof. Creator Studio owns creative projects, music/film/art and podcasts, rights and releases, generation/rendering, licensing and delivery. Growth Studio owns audience channels, marketing, SEO, social distribution, lead consent, moderation and analytics. The parent SONARA Public Network indexes explicitly public and rights-cleared content from these products without exposing tenant-private tables.

Customer owners administer **their own** organization: staff and grants, product settings, public profiles, storefronts, analytics, releases, connectors, audit, notifications, usage and data exports. Managers get delegated rights; workers receive scoped task rights; group founder privileges never become an implicit unrestricted tenant bypass.

Authorization contract: verified session AND active tenant membership AND resource ownership AND action grant AND no active lock AND, for sensitive operations, owner approval. Chargeable jobs also need entitlements and a reserve/settle usage budget. UI hiding, membership pricing, supplied organization IDs and user-editable claims are never sufficient authorization.

Operating review boards: security/privacy, architecture/reliability, finance/commerce, creator rights, accessibility and community moderation appeals. Persist proposal, reviewer, owner approval, policy version, decision, UTC time, rationale and expiration. Do not treat template documents as jurisdiction-approved legal advice.

Source-of-truth consolidation: reconcile organizations, organization_memberships, organization_members, entity_memberships, workspace_memberships, app_scopes and approval_queue before adding new role tables. Avoid duplicate ledgers and duplicate login flows.
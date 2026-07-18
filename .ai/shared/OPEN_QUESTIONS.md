# Open Questions

1. OWNER: Keep Google OAuth deferred for launch? It is currently cleanly disabled.
2. OWNER: Adopt the master directive's expanded standard API envelope? This is a breaking change and needs a compatibility ADR; the accepted baseline preserves the deployed shape.
3. OWNER: Is a future React or Next migration desired? ADR-0001 keeps the root Express runtime; any migration needs a parity ADR and is not scheduled.
4. OWNER + CODEX: Must every Business Builder manager and employee also hold a canonical organization membership, or should the current business-membership compatibility fallback remain? Gather live row evidence before deciding.
5. OWNER + CODEX: Approve production application of migrations 40, 41, and 42 in timestamp order after secure operator access is restored, then rerun Supabase advisors, readiness, anonymous, member, tenant-owner, platform-administrator, service-role, and query-index checks.
6. CODEX: After hosted application, what are the row counts and query frequencies for the eight operational index targets?
7. CODEX: Do Supabase database and index advisors recommend retaining all eight indexes after observing actual workload?
8. CODEX: How often does primary organization resolution use the legacy `organization_members` or `business_memberships` fallback instead of canonical `organization_memberships`?
9. OWNER + CODEX: Are any active Business Builder membership rows missing a valid `business_workspaces` parent, and can the deferred foreign key be added without rejecting real data?
10. CODEX: Which heterogeneous OpenAPI payload should be tightened first without changing the deployed runtime response shape?
11. AGENT B: Has a reproducible real-browser PWA install, update, offline, accessibility, overflow, and private-route verification been completed for the current production release?

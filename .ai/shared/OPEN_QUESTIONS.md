# Open Questions

1. OWNER: Keep Google OAuth deferred for launch? It is currently cleanly disabled.
2. OWNER: Adopt the expanded standard API envelope? This is a breaking change and needs a compatibility ADR.
3. OWNER: Is a future React/Next migration desired? ADR-0001 keeps the root Express runtime; a migration requires full parity and a separate ADR.
4. OWNER + CODEX: Complete and document the authenticated Stripe test lifecycle through cancellation and paid-access relock.
5. OWNER + CODEX: Complete one approved production Resend delivery and confirm the persisted provider result.
6. OWNER + COUNSEL: When will qualified legal review of the owner-approved legal baseline be completed?
7. OWNER + CODEX: Must every Business Builder manager/employee hold canonical organization membership, or should the compatibility fallback remain?
8. CODEX: What are production row counts, query frequencies, and planner usage for the eight operational indexes after workload accumulates?
9. CODEX: How many legacy `billing_subscriptions` rows still lack `organization_id`, and can any be reconciled from authoritative billing metadata without guessing?
10. OWNER + CODEX: Are active Business Builder membership rows missing a valid `business_workspaces` parent, and can the deferred foreign key be added safely?
11. CODEX: Which generic OpenAPI payload should be tightened first without changing deployed shapes?
12. AGENT B: Has reproducible browser PWA install/update/offline/accessibility/overflow/private-route verification been completed?

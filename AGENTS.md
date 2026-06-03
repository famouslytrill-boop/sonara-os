# SONARA Industries Agent Instructions

SONARA Industries is the parent platform for Business Builder, Creator Studio, and Growth Studio.

- Research first, then implement the smallest reversible change that advances launch readiness.
- Do not install viral repositories, curl-to-shell installers, or external code without license and security review.
- Do not make full-auto production changes, auto-merge, force-push, or deploy without owner approval.
- Keep secrets, service-role keys, mailbox tokens, webhook secrets, and provider credentials server-only.
- Supabase remains the primary backend until a written migration decision exists.
- Use Prisma as the selected ORM contract, Meilisearch for app search, and Supabase pgvector for vector search.
- Do not add non-commercial code to revenue products or import GPL/AGPL/source-available code without review.
- Do not add surveillance, unofficial account proxies, unofficial token capture, trading advice, piracy, or unsafe security tooling.
- Voice and media tools require consent, disclosure, provenance, and anti-clone safety.
- AI outbound actions require preview, human approval, and audit logs.
- Every organization-scoped record needs organization_id, RBAC checks, and audit coverage.
- High-risk changes require feature flags defaulted off, tests, rollback notes, and audit logs.
- Keep launch infrastructure boring, testable, reversible, and documented.

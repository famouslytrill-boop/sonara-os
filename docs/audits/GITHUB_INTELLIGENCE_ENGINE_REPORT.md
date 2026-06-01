# GitHub Intelligence Engine Report

## 1. GitHub Radar Routes Added

- `/research-lab/github-radar`
- `/research-lab/github-radar/high-value`
- `/research-lab/github-radar/research-only`
- `/research-lab/github-radar/blocked`
- `/research-lab/github-radar/categories`

## 2. Admin Routes Added

- `/app/admin/github-radar`
- `/app/admin/github-radar/search`
- `/app/admin/github-radar/watchlist`
- `/app/admin/github-radar/reviews`
- `/app/admin/github-radar/recommendations`
- `/app/admin/github-radar/blocked`
- `/app/admin/github-radar/codex-prompts`
- `/app/admin/github-radar/sync`
- `/app/admin/github-radar/settings`

## 3. Public Research Lab Routes Added

Public pages describe GitHub Radar as a research and review system. They do not claim that listed repositories are owned, bundled, endorsed, or integrated by SONARA.

## 4. Database Tables Added

Migration `20260601093000_github_intelligence_engine.sql` adds:

- `github_repositories`
- `github_repository_categories`
- `github_repository_reviews`
- `github_repository_license_reviews`
- `github_repository_security_reviews`
- `github_repository_privacy_reviews`
- `github_repository_maintenance_reviews`
- `github_repository_business_reviews`
- `github_repository_product_fit`
- `github_repository_feature_flags`
- `github_repository_watchlist`
- `github_repository_update_events`
- `github_repository_blocklist`
- `github_repository_recommendations`
- `github_repository_codex_prompts`
- `github_repository_audit_logs`
- `github_repository_sync_jobs`
- `github_repository_score_history`

## 5. RLS Policies Added

- Authenticated users can read global repository records.
- Platform owner/admin claims or service role can manage GitHub Radar tables.
- No anonymous write policy was added.
- No secrets are stored in repository metadata by design.

## 6. Repo Records Seeded

Seed registry includes GrowthBook, Flagsmith, Novu, OpenMeter, Documenso, Formbricks, Plunk, Activepieces, n8n, Flowise, Renovate, OSV Scanner, Gitleaks, PostHog, and a blocked copyright-circumvention class. Retained research names include Playwright, Trivy, Semgrep, OpenTelemetry, LangGraph, Temporal, LiveKit Agents, Chatwoot, Medusa, ERPNext, Odoo, Cal.com, PGlite, DuckDB, Ollama, Qdrant, Marker, Surya, Docling, Unstructured, Directus, NocoDB, Baserow, Appsmith, ToolJet, Budibase, Keycloak, Ory Kratos, OpenFGA, authentik, ZITADEL, Infisical, Meilisearch, Typesense, ClickHouse, Immich, GlitchTip, DefectDojo, and ZAP.

## 7. Scoring System Added

Scoring helpers classify repositories into high-value, strong candidate, research-only, low-priority, and blocked ranges.

## 8. Feature Flags Added

GitHub Radar flags include manual mode, sync mode, prompt generator, admin review, public research pages, and explicit auto-install blocking.

## 9. Validation Scripts Added

- `check:github-radar`
- `check:github-radar-risk`
- `check:github-radar-secrets`
- `check:repo-score-thresholds`
- `check:blocked-repo-claims`
- `check:auto-install-disabled`
- `check:github-radar-public-copy`

## 10. Codex Sprint Generator Added

Prompt generation is draft-only and always includes instructions to avoid copying third-party code, committing secrets, enabling without review, or bypassing human approval.

## 11. Auto-Update Policy Added

Allowed: metadata refresh, counts, latest release, last pushed date, archived status, recommendations, prompt drafts, and audit events.

Blocked: dependency install, source copy, production adapters, feature enablement, customer-facing integrations, external tool execution, billing/payment/security changes, merges, and deploys.

## 12. Business Builder Mapping

App builders, database builders, forms, scheduling, CRM, support inbox, commerce, POS, notifications, e-signature, feature flags, and billing/metering.

## 13. Creator Studio Mapping

Media asset management, creative tools, document signing, feedback, content workflows, AI media agents, local asset search, and rights review.

## 14. Growth Studio Mapping

CRM, surveys, email, notifications, workflow automation, social/campaign tools, product analytics, feature experiments, billing/metering, and lead routing.

## 15. Shared Infrastructure Mapping

Security scanning, observability, dependency automation, secrets scanning, feature flags, provider registry, GitHub Radar, license gate, audit logs, admin command center, traces, MCP tool review, and CI reliability checks.

## 16. License Risks

Unknown, GPL, AGPL, fair-code/source-available, and non-commercial licenses remain review-required or restricted. No high-risk repository is marked production-ready.

## 17. Security Risks

The engine blocks auto-install behavior and keeps sync token handling server-only. GitHub API sync is optional and falls back to manual mode.

## 18. Repos Safe To Use Now

None are marked production-integrated by this sprint. Some are safe as reviewed research candidates only.

## 19. Repos Review-Only

Feature flags, notifications, metering, support, automation, analytics, and dependency/security tooling records are review-only until legal/security/privacy checks complete.

## 20. Repos Blocked/Restricted

Copyright-circumvention and illegal streaming classes are blocked. AGPL/GPL/fair-code/source-available records are restricted until legal review.

## 21. Human Approval Required

Owner/admin approval is required before enabling sync, prompt generation beyond drafts, provider adapters, feature flags, or production integrations.

## 22. Commands Run And Results

- `pnpm run check:github-radar`: passed
- `pnpm run check:github-radar-risk`: passed
- `pnpm run check:github-radar-secrets`: passed
- `pnpm run check:repo-score-thresholds`: passed
- `pnpm run check:blocked-repo-claims`: passed
- `pnpm run check:auto-install-disabled`: passed
- `pnpm run check:github-radar-public-copy`: passed
- `pnpm run verify:all`: passed

## 23. Merge Recommendation

Merge only after CI, Vercel, dependency scan, and Supabase Preview pass or Supabase Preview intentionally skips because required secrets are absent.

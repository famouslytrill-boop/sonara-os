# Risks

1. **Server-access replacement:** previously disclosed Supabase server access must be replaced outside chat before public paid launch. Never place replacement values in repository files, reports, commands, browser code, or shared handoffs.
2. **Email proof:** Resend friendly-name validation is fixed and the domain is verified, but one approved production delivery must record a successful provider result before transactional delivery is called proven.
3. **Stripe lifecycle proof:** Stripe, webhook, prices, and checkout are configured; the authenticated checkout → signed webhook → persisted entitlement → unlock → cancel → relock sequence remains unproven.
4. **Legal boundary:** the owner approved the launch baseline, but qualified legal review remains required. Do not describe the pages as attorney-reviewed or as legal advice.
5. **Payload boundary:** structured JSON/form bodies are intentionally capped at 1 MiB. Raising that ceiling toward Vercel's platform limit would increase memory and abuse risk and still would not make function-proxied media uploads valid. Large files must use signed direct-to-storage uploads; provider/global and bucket file-size limits remain separate controls.
6. **Billing legacy data:** migration 42 added canonical billing columns and preserved compatible identifiers, but it intentionally did not invent organization mappings for older rows. Legacy rows with no organization remain ineligible for organization-scoped paid access until reconciled with evidence.
7. **Index effectiveness:** migration 42 applied and indexes are valid/ready, but actual benefit should be checked later against production cardinality and query telemetry.
8. **Membership compatibility:** `business_memberships.workspace_id` still lacks a repository-declared foreign key to `business_workspaces`; do not add one or remove compatibility fallbacks without live inventory and cross-tenant tests.
9. **PWA/browser evidence:** install, update, offline behavior, accessibility depth, and private-route behavior still need a reproducible browser harness.
10. **Physical-device boundary:** haptics consent is regression-tested, but physical vibration hardware is not production-verified.
11. **OpenAPI schema depth:** method/path/auth/error coverage is canonical, while several heterogeneous payloads remain generic and should be tightened without runtime-shape changes.
12. **Service-worker asset coupling:** cached asset changes must synchronize worker version, rendered query tokens, manifest expectations, and tests.
13. **Unrelated local work:** previously recorded untracked operator files must remain untouched and uncommitted.
14. **Execution-environment evidence:** agent runners may lack the expected `/home/user/sonara-os` mount or may terminate because of model/resource failures such as Exit 144. A missing mount, unavailable model, or terminated command must never be classified as an application failure or assumed complete; require a valid checkout plus reproducible commands, or corroborating GitHub CI/Vercel evidence, before changing production code.

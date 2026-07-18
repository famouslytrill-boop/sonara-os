# Database Contract — owner: Codex (Agent A). STATUS: STUB awaiting Codex.

Verified production facts (2026-07-16, Supabase ref yqncsonkxgwhcxedgevk):
- Ledger = 39 migrations = supabase/migrations/** exactly. Do not edit applied files.
- RLS enabled on all org-scoped/private tables; anon reads return 0 rows on
  support_requests/service_requests/billing_subscriptions/organizations.
- Support delivery state: support_requests.{reference_id,consent_accepted,
  email_delivery_status,email_error_summary,email_retry_count} +
  support_email_delivery_attempts (service-role only).
- Storage: 7 launch buckets private (avatars, business-assets, creator-assets,
  music-stems, release-packages, support-attachments, exports) with 8
  org/owner-scoped storage.objects policies. Paths: avatars <uid>/…; org
  buckets <org_id>/<owner_uid>/….
- Paid access source of truth: billing_subscriptions.status ∈ {active,trialing}
  (+ billing_entitlements derived), never a redirect.

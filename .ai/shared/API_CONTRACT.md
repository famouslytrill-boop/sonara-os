# API Contract — owner: Codex (Agent A). STATUS: STUB awaiting Codex.

Verified-behavior notes from Claude's audit (do not break):
- POST /api/checkout/session — auth+org required; plan validated against
  STRIPE_PLANS; 303 to Stripe URL or JSON {ok,checkout_url}; setup_required
  JSON/HTML when unconfigured. Redirects never grant access.
- POST /api/webhooks/stripe (+ /api/stripe/webhook) — express.raw body,
  HMAC-SHA256 timing-safe verify, 400 invalid_signature; idempotent audit via
  on_conflict=provider,provider_event_id.
- GET /api/health — {ok,app,runtime,deployment{commitSha,branch,environment}}.
- GET /api/readiness — names+statuses only, NO secret values (tested).
- Error style today: {ok:false, code, message?, service?} — the master
  directive's error envelope (§12) is NOT yet implemented; adopting it is a
  contract-first breaking change (see TASK_BOARD CODEX-5).

Canonical spec: openapi/sonara.yaml — TODO(Codex).

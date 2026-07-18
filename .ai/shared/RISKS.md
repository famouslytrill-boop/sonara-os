# Risks

1. **Integrated but undeployed:** the Clark redesign and current contract work are local on `codex/integrate-clark-redesign`; they are not production evidence until pushed, reviewed, merged, deployed, and verified by exact SHA.
2. **Paid launch blocked:** email delivery remains unavailable until `RESEND_FROM_EMAIL` is valid; Stripe lifecycle proof, unrestricted live smoke, and owner approvals are still pending.
3. **Preference truth:** the frontend review found that theme JavaScript and dark CSS use different attributes, and a legacy script vibrates without the opt-in preference. Fix and behaviorally test before claiming theme/haptics compliance.
4. **Stale frontend evidence:** older screenshots, accessibility, PWA, and performance reports predate the current redesign; the 248-check harness is not committed and cannot be reproduced from this repository.
5. **PWA drift:** two manifest files and a service worker exist, but the production renderer does not register the service worker. Do not call offline/install behavior operational.
6. **OpenAPI schema depth:** method/path/auth/error coverage is canonical, but several heterogeneous success/request payloads still use generic object schemas. Tighten them incrementally without changing runtime shapes.
7. **Supabase hardening:** recorded advisor items include leaked-password protection, function/search-path/RPC review, and extension placement. Applied migrations are immutable; remediation requires new reviewed migrations and RLS regression tests.
8. **Service-worker cache coupling:** any cached asset change must synchronize the service-worker version, rendered `?v=` tokens, and the corresponding test assertion.
9. **Unrelated file:** `debug-session.cjs` is untracked user work and must remain untouched/uncommitted.

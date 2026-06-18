# Security Review

Launch security posture:
- No provider secrets are committed.
- Service-role keys must remain server-only.
- Stripe checkout stays blocked unless required server env vars and valid `price_` IDs exist.
- Agent actions are scaffolded for approval and audit, not autonomous production execution.
- Phone, SMS, voicemail, browser automation, and file operations remain gated.

Required human review:
- Supabase production migration approval.
- Vercel environment variable entry.
- Legal review for public terms, privacy, refunds, acceptable use, and open-source license risk.
- Privacy review before analytics/session replay/call recording.

Launch blockers:
- Failing CI/build/typecheck.
- Missing owner membership.
- Public legacy brand exposure.
- Any committed secret or client-side service role reference.

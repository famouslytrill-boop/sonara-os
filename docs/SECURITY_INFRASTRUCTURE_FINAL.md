# Security Infrastructure Final

Checklist:

- Security headers and CSP baseline exist.
- Generated `_headers` artifact exists for static hosts.
- Source leak scan runs before release.
- Service-role keys never appear client-side.
- Stripe secret keys never appear client-side.
- AI provider keys never appear client-side.
- Open-Source Intake Registry gates external code and tools.
- Prompt redaction and AI provider privacy gates remain enabled.
- Legal/policy publishing requires owner approval.
- Customer campaigns require owner approval.
- Delete actions require owner approval.
- Audit log deletion is blocked.

Any secret exposure or owner-confirmation bypass is a critical launch blocker.

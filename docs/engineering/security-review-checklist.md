# Security Review Checklist

- Verify no secrets, service-role keys, mailbox tokens, webhook secrets, or database URLs appear in client code.
- Confirm RLS/RBAC deny by default and every organization-scoped record includes organization_id.
- Confirm audit events for sensitive actions.
- Confirm webhook signatures and provider token storage rules.
- Confirm file privacy labels, tenant isolation, and safe attachment handling.
- Confirm AI outbound approval before emails, texts, public notices, payment links, refunds, or permission changes.
- Confirm dependency and provider risk before enabling adapters.

# Security

Every protected action must check identity, organization membership, app access, role permission, plan entitlement where needed, and audit history.

Security patterns:

- RBAC and organization isolation
- app-level data isolation
- audit logs and app access events
- secure CORS allowlist from env
- rate-limit middleware placeholder
- file type and file size validation
- malware scanning placeholder
- Stripe webhook signature verification placeholder
- admin approval placeholders for destructive actions
- least privilege service design

Do not expose Postgres to the public internet. Do not commit secrets. Service credentials belong in environment variables or managed secret stores.

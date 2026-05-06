# Security Model

Every protected action should check:
1. authenticated user
2. organization membership
3. product/app access
4. role permission
5. plan entitlement
6. audit logging

Roles:
- owner
- admin
- manager
- editor
- viewer
- billing_admin
- security_admin

Scopes:
- `soundos.read`
- `soundos.write`
- `tableos.read`
- `tableos.write`
- `alertos.read`
- `alertos.write`
- `billing.manage`
- `security.manage`
- `admin.all`

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
- `trackfoundry.read`
- `trackfoundry.write`
- `lineready.read`
- `lineready.write`
- `noticegrid.read`
- `noticegrid.write`
- `billing.manage`
- `security.manage`
- `admin.all`

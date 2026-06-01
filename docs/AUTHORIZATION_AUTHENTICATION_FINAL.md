# Authentication And Authorization Final

Route rules:

- Public routes stay public.
- `/app` routes require auth in production.
- `/admin` routes require owner/admin role.
- Critical owner routes require owner-only confirmation.

Authorization rules:

- Organization scoping must exist for organization data.
- Membership model must define owner/admin/member/viewer boundaries.
- RLS-ready policies must exist before writes are enabled.
- Admin-only APIs must validate role server-side.
- Owner-only APIs must validate owner role server-side.
- Sensitive actions must call Owner Confirmation Lock before execution.
- Audit logs must record approvals, rejections, blocks, role changes, billing changes, provider changes, and legal/policy publishing.

No auth bypass route is allowed for production.

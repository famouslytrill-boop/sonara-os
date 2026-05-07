# Manual RLS Tests

Use two test users and two organizations.

1. User A creates a TrackFoundry organization.
2. User B creates a LineReady organization.
3. Confirm User A cannot select User B rows from tenant-owned tables.
4. Confirm User B cannot select TrackFoundry rows without `organization_app_access`.
5. Confirm `viewer` cannot insert/update/delete.
6. Confirm `billing_admin` can use billing scope only.
7. Confirm `security_admin` can read audit/security scope only.
8. Confirm NoticeGrid broadcast rows remain `pending_approval`.

Do not use service role keys from the browser when testing RLS.

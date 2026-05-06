# Storage Policy Tests

Run after storage buckets and policies are configured.

## Public Assets

1. Upload a harmless public placeholder image.
2. Confirm anonymous read works only for the public bucket.
3. Confirm anonymous write fails.

## Private User Assets

1. User A uploads a private file.
2. User A can create/read a signed URL.
3. User B cannot read User A file.
4. Anonymous visitor cannot read the file.
5. User B cannot delete User A file.

## Organization Assets

1. Organization member can upload according to role.
2. Non-member cannot read/download/delete.
3. Viewer role cannot delete.
4. Admin/owner can delete according to policy.

## Stop Conditions

Do not launch uploads if private files are publicly readable or unrelated users can access each other's files.

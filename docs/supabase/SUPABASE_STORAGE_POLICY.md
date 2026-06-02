# Supabase Storage Policy

Storage is private by default. Public files require an explicit publish approval flow and metadata linking the object to organization, owner, bucket, purpose, and review status.

Blocked storage content:

- Raw payment data or CVV.
- API keys, provider secrets, private keys, or service-role credentials.
- Unreviewed executable uploads.
- Media without rights/provenance review when intended for public use.

The launch bucket registry lives in `packages/web/src/lib/storage/storage-bucket-registry.ts`.

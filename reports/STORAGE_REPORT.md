# SONARA Storage Report

Date: 2026-07-15

## Contract

The active application expects these Supabase Storage buckets:

- `avatars`
- `business-assets`
- `creator-assets`
- `music-stems`
- `release-packages`
- `support-attachments`
- `exports`

The administrator storage-readiness page and JSON endpoint inspect bucket existence through server-only Supabase access. They display names and readiness only, not service-role credentials.

## Access rules

- Customer and organization assets are intended to remain private.
- Downloads should use short-lived signed URLs.
- User paths require owner checks; organization paths require membership checks.
- Type, size, and rights validation must occur before accepting files.
- Public access is reserved for deliberately published static/brand assets.

## Release status

Storage code, readiness checks, and policy documentation are present. Production buckets, MIME/size restrictions, upload/download/delete behavior, and cross-tenant policies were not exercised because no production Supabase mutation was authorized.

## Required proof

Create or confirm all seven buckets, apply policies, then test upload/read/delete as owner, another organization member, an unrelated tenant, an administrator, and an anonymous visitor. Confirm storage backups separately from database backups.

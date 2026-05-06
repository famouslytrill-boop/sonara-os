# Storage Setup

Storage should use Supabase Storage or a compatible signed URL provider. Private buckets must not be public.

## Buckets

- `public-assets` - intentionally public brand/static assets only.
- `sonara-user-assets` - private user-owned files.
- `sonara-organization-assets` - private organization/business files.
- `sonara-releases` - existing private launch export bucket.

## File Limits

- Public assets: 10 MB.
- Private user assets: 250 MB.
- Organization assets: 500 MB.

## Allowed MIME Types

- Images: PNG, JPEG, WebP, GIF.
- Audio: MP3, WAV, MP4 audio, AAC.
- Video: MP4, WebM, QuickTime.
- Documents: PDF, TXT, CSV, JSON.

## Helpers

Code helpers live in:

- `lib/storage/validation.ts`
- `lib/storage/server.ts`

They support:

- validate file type
- validate file size
- create signed upload URL
- create signed download URL
- delete storage asset

## Policy Rules

- Public assets bucket may be publicly readable only for intended public files.
- Private buckets require signed URLs.
- Users can only access their own private paths.
- Organization files require organization membership checks.
- Deletion must require ownership or admin permission.

## Storage Backups

Storage/media backup is separate from database backup. Do not assume `pg_dump` backs up uploaded files.

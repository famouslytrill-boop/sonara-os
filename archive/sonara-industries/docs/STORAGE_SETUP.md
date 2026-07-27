# Storage Setup

Buckets:
- `profile-images`
- `trackfoundry-media`
- `lineready-documents`
- `noticegrid-imports`
- `public-assets`

Upload route:
- validates auth
- requires org ID
- requires company key
- validates file type and size
- creates a signed upload URL when Supabase service credentials are configured
- returns setup-required metadata when credentials are missing

Storage backups are separate from PostgreSQL backups.

# Supabase Queues

Queues are planned for heavy or retryable tasks:

- Document extraction.
- Video rendering.
- Large imports.
- Email fanout.
- Provider sync jobs.

Jobs must be bounded, auditable, and visible to admins before production use.

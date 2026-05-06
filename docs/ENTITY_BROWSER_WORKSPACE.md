# Entity Browser Workspace

Each entity has a browser-like workspace for source review, bookmarks, and notes.

Routes:

- `/dashboard/entities/[entitySlug]/browser`
- `/dashboard/entities/[entitySlug]/bookmarks`
- `/dashboard/entities/[entitySlug]/notes`

## Safety Model

- Only `http` and `https` URLs are accepted.
- `javascript:`, `data:`, `file:`, local hostnames, and private network address ranges are blocked.
- The app does not proxy arbitrary websites.
- Many websites block iframe embedding; the UI falls back to "Open Externally."
- Do not store credentials, tokens, payment data, or private personal data in research notes.

## Setup Required

Persistence requires Supabase migration `008_entity_agent_operations.sql`, authenticated users, and entity memberships.

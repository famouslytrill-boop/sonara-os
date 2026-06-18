# Architecture Overview

Current launch architecture:
- Frontend static TypeScript shell.
- Protected app and admin surfaces in the web package.
- Supabase Auth, database, storage, and RLS as the backend spine.
- Stripe Checkout and webhooks as provider-hosted payment rails.
- Email provider integration remains provider-configured.
- Agent Control Plane, Model Routing, and Vector Memory are lightweight foundations.

Internal architecture view:
- `/admin/architecture`

Missing integrations are shown as setup-required or future-flagged. No secrets are displayed.

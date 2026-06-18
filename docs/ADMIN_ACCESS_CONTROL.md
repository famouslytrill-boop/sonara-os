# Admin Access Control

Admin routes are protected surfaces. The static shell can render locked previews for launch review, but production data access must stay behind server-side role checks.

Admin-only capabilities:
- Command Center.
- AI cost control.
- Architecture view.
- Growth tactics administration.
- Restaurant future module administration.
- Stripe and Supabase readiness review.

Rules:
- Do not expose service-role actions in client code.
- Do not display raw prompts, secrets, provider keys, webhook payload secrets, or private customer data.
- Sensitive actions require preview, approval, audit logging, and rollback notes where practical.

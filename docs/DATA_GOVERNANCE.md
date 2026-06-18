# Data Governance

SONARA Industries is the parent platform for Business Builder, Creator Studio, and Growth Studio. Supabase remains the source of truth for launch.

Production-ready now:
- Organization-scoped tables use `organization_id`.
- Private records require membership checks through RLS or protected route gates.
- Public marketing pages do not expose tenant records.
- Stripe, Supabase, webhook, and provider credentials stay server-side.

Future-flagged:
- Local vector engines, facility automation, world-model research, and restaurant AI receptionist features are disabled by default.
- Advanced outreach and phone workflows require consent records, opt-out enforcement, and human review.

Owner/provider tasks:
- Confirm production Supabase migrations.
- Verify first-owner organization membership.
- Review legal/privacy claims before launch.

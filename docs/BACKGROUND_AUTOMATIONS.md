# Background Automations

Entity automations are automation-ready definitions for manual triggers, schedules, heartbeat warnings, incidents, notes, public source events, payments, storage events, and deployment events.

Route:

- `/dashboard/entities/[entitySlug]/automations`

## Safety

- Automations are disabled/setup-required until workers or cron are configured.
- Destructive actions require approval.
- Public information publication and mass notifications require approval.
- The system must not scrape or automate external sites without permission and source review.

## Next Step

Wire approved automations to a worker queue or cron route after Supabase migration `008_entity_agent_operations.sql` is applied.

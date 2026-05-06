# Entity Agent Security Model

Entity infrastructure is scoped by membership and approval boundaries.

## Core Checks

- Entity records include `entity_id`.
- Private records use RLS.
- Users can read only entities they belong to unless a record is intentionally public.
- Settings, connectors, agents, automations, and approvals require owner/admin membership.
- Browser workspace rejects unsafe protocols and private network URLs.
- The browser workspace does not proxy arbitrary websites.
- Unsupported external tools are marked `setup_required`.
- Destructive, billing, database-write, role-change, mass-notification, public alert, and deployment actions require human approval.
- The Community/Public Information company must not claim official government authority unless verified by a real public partner.

## Verification

Run:

```bash
npm run verify:entity-security
```

This checks required files, RLS helper presence, URL safety rules, setup-required capability language, and unsafe external capability claims.

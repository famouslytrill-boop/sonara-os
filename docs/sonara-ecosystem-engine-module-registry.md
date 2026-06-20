# SONARA Ecosystem / Engine / Module Registry

This registry collects the ecosystems, systems, and user-facing tools planned across SONARA chats. It gives the product a canonical map instead of scattered dashboard cards pretending to be architecture.

## Database migration

```text
supabase/migrations/018_sonara_ecosystem_engine_module_registry.sql
```

Adds:

- `sonara_ecosystem_registry`
- `sonara_engine_registry`
- `sonara_module_registry`
- `sonara_module_dependencies`

## Ecosystems

- SONARA Industries
- Business Builder
- Creator Studio
- Growth Studio
- Shared Platform

## Main engines

### Shared Platform

- Accounts and Access
- Platform Builder
- Website Pages
- Apps
- Access and Plans
- Payments
- Publish
- Support
- Device Feedback
- Language and Units

### SONARA Industries

- Admin Dashboard
- Software Library
- Legal and Security

### Business Builder

- Business Operations
- Staff
- Restaurant and Margin
- Vehicles and Routes
- Document Scan

### Creator Studio

- Music System
- Audio and DAW
- AI Jobs

### Growth Studio

- Campaigns
- Automations

## Module rule

Every user-facing module must have a real output.

Allowed real outputs:

- saved record
- loaded record
- calculation
- report
- export package
- billing state
- published page
- support request
- employee time entry
- location event
- audio analysis result
- quality check
- setup-required status

No dead buttons. No fake modules. No imaginary engines with shiny names.

## User-facing language

Use plain words:

| Internal | Public |
|---|---|
| ecosystem | Product Area |
| engine | System |
| module | Tool |
| dependency | Requirement |
| entitlement | Access |
| schema | Database Setup |
| RLS | Access Protection |
| publication | Published Version |

## Admin routes to add next

- `GET /admin/ecosystem-registry`
- `GET /api/ecosystems`
- `GET /api/ecosystem-engines`
- `GET /api/ecosystem-modules`
- `GET /api/ecosystem-module-dependencies`
- `GET /api/ecosystem-registry/readiness`

## Status meanings

- `planned`: known product/system, not fully wired
- `active`: route, table, access rule, and result exist
- `setup_required`: depends on missing service/config/table
- `disabled`: intentionally unavailable
- `archived`: retired

## Definition of done

A module can be marked active only when:

1. It has a public label normal people understand.
2. It has at least one route or API.
3. It has source tables or a real external workflow.
4. It produces a real result.
5. It has access rules.
6. It does not expose secrets.
7. It has tests or a readiness check.

This registry should drive admin readiness, product navigation, paywall gating, and launch checklists.

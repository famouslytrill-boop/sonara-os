# SONARA Infrastructure Strengthening Research Plan

This plan converts the latest product requirements into a stronger engineering target.

## Plain-language product direction

SONARA should not sound like a database diagram to normal people. Use words the general public recognizes:

- Business
- Website
- Page
- App
- Staff
- Schedule
- Time clock
- Pay
- Customers
- Orders
- Payments
- Support
- Menu
- Services
- Inventory
- Music project
- Track
- Stems
- Export
- Preview
- Publish

Avoid forcing users to understand words like tenant, entity, schema, entitlement, object graph, orchestration layer, or provisioning pipeline in the customer UI. Keep that nonsense backstage where it belongs.

## Stronger architecture

SONARA should use one engine with company-specific templates:

- SONARA Industries: parent operations, admin, billing, support, legal, product catalog.
- Business Builder: business websites, customer records, appointments, orders, employees, inventory, payments.
- Creator Studio: creator sites, release pages, music projects, audio assets, DAW exports, AI music workflow tracking.
- Growth Studio: campaign pages, funnels, leads, experiments, analytics, follow-ups.

The database migrations now include:

- `012_sonara_full_ecosystem_schema.sql`
- `013_sonara_operational_strengthening.sql`

## Real-result rule

Every visible module must create, read, update, delete, publish, bill, email, analyze, export, or route real data.

If it cannot do that, it must be:

- Locked
- Disabled
- Setup Required
- Hidden

No fake modules.

## Owner/admin access model

Back-end business control belongs to the business owner/admin. Employees should only see what their role allows.

Owner/admin can:

- Manage business settings
- Manage pages and apps
- Manage employees
- View time entries
- Approve time
- View wages and pay statements
- Post staff updates
- Manage services/menu/inventory/assets
- Manage customer records and orders

Employee can:

- Log in
- View own shifts
- Clock in/out
- View own time entries
- View own pay statements
- Read company posts
- View assigned job/business information

Employee should not see owner billing keys, service-role access, all customer data, all employee wages, or admin audit logs.

## Business Builder coverage

Business Builder must work for ordinary businesses:

- Hair salon
- Restaurant
- Food truck
- Ice cream stand
- General service company
- Mobile business
- Trailer or vehicle-based business

Required systems:

- Business profile
- Location or mobile schedule
- Services/menu/products
- Appointments/bookings
- Customer records
- Orders
- Payments
- Inventory
- Vehicles/trailers/equipment
- Employee profiles
- Staff schedule
- Time clock
- Wage/pay record exports
- Staff posts
- Support messages

## Employee app

Routes to build:

```text
/employees/login
/employees
/employees/schedule
/employees/time-clock
/employees/pay
/employees/posts
/employees/profile
```

API routes to build:

```text
GET  /api/employees/me
GET  /api/employees/me/shifts
POST /api/employees/me/time-clock/clock-in
POST /api/employees/me/time-clock/clock-out
GET  /api/employees/me/time-entries
GET  /api/employees/me/pay-statements
GET  /api/employees/me/posts
```

Owner/admin routes:

```text
/business-builder/employees
/business-builder/employees/new
/business-builder/employees/schedule
/business-builder/employees/time
/business-builder/employees/payroll
/business-builder/employees/posts
```

## Payroll warning

SONARA can track time, wages, and pay statements, but should not claim to be a certified payroll processor unless payroll tax, compliance, filings, and jurisdiction-specific rules are actually implemented. Start with payroll-prep exports and clear disclaimers. Tiny legal landmine avoided. Miracles do happen.

## Creator Studio music system

Creator Studio should support real creator workflows:

- Music projects
- Tracks
- Stems
- DAW export notes
- AI music workflow tracking
- Audio analysis reports
- Sonic branding
- Animation/haptic settings

Routes to build:

```text
/creator-studio/music
/creator-studio/music/projects
/creator-studio/music/projects/:id
/creator-studio/music/projects/:id/tracks
/creator-studio/music/projects/:id/stems
/creator-studio/music/projects/:id/daw-export
/creator-studio/music/ai-tools
/creator-studio/music/analysis
/creator-studio/experience
```

API routes to build:

```text
GET  /api/music/projects
POST /api/music/projects
GET  /api/music/projects/:id
PATCH /api/music/projects/:id
POST /api/music/projects/:id/tracks
POST /api/music/tracks/:id/stems
POST /api/music/ai-jobs
POST /api/music/analysis
POST /api/app-experience-settings
```

## AI music integrations

Do not hardcode fake API integration. Store provider registry rows and workflow links first. Provider API access must only be marked `api_available` when the provider officially supports the desired API flow and the user has configured valid credentials.

Supported first registry:

- Suno
- Udio
- ElevenLabs
- Moises
- BandLab

Integration modes:

- manual_link
- api_available
- export_only
- disabled

## Audio, MIDI, vibration, and animation

Frontend should feel like an application, but not at the cost of accessibility or battery abuse.

System design:

- Web Audio API for audio preview, visualization, basic sound feedback, and future sequencer-style tools.
- Web MIDI API only behind explicit permission and clear security warnings.
- Vibration/haptics only when supported, optional, and disabled by default.
- Web Animations API for smooth UI motion.
- Respect reduced motion and let users turn sound/haptics off.

## UX language map

Backend word -> User-facing word:

- organization -> business
- platform -> business platform / creator platform / campaign platform
- sonara_platform_pages -> pages
- sonara_platform_apps -> apps
- sonara_platform_modules -> tools
- entitlements -> plan access
- publications -> published version
- service role -> server-only admin access
- RLS -> data protection rules

## Infrastructure quality gates

Before deployment:

```powershell
node --check .\server.js
pnpm run build
pnpm test
pnpm run scan:client-secrets
```

Before claiming a feature is live:

- Database table exists.
- RLS/service-role policy exists.
- API route exists.
- UI route exists.
- Form saves real row.
- Admin count reflects real row.
- Paywall is enforced.
- Empty state is honest.
- Setup-required state works.
- Test covers success and failure.

## Next engineering sequence

1. Apply migrations 012 and 013.
2. Add platform API routes.
3. Add employee API routes.
4. Add business vertical UI.
5. Add Creator Studio music project UI.
6. Add app experience settings UI.
7. Add admin observability counts.
8. Add tests.

Do not add shiny buttons first. Shiny broken buttons are just user-hostile confetti.

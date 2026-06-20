# SONARA Module Implementation Matrix

This matrix turns the chat history into buildable implementation targets.

## Status meanings

- `live`: route or API is already expected to exist.
- `wired`: route/data model exists but needs more complete workflow.
- `setup_required`: backend service or table must be configured.
- `planned`: belongs in roadmap, not safe to present as complete.
- `review_required`: external adapter or license/data/privacy review needed.

## Business Builder

| Module | Customer value | Data/API target | Status |
|---|---|---|---|
| Offer Builder | Build a real launch offer | `/api/business-builder/offers`, `module_outputs` | wired |
| Intake Queue | Capture customer requests | `/api/business-builder/intake`, `intake_requests` | wired |
| Checklist | Track launch tasks | `/api/business-builder/checklist`, `launch_checklist_items` | wired |
| Customers | Store customer records | `customer_records` | setup_required |
| Orders | Track paid or manual orders | `order_records` | setup_required |
| Billing | Stripe checkout and portal | `/api/checkout/session`, billing tables | wired |
| Employees | Invite staff safely | `business_employee_invites`, `business_memberships` | wired |
| Scheduling | Schedule shifts/jobs | `employee_shifts`, `business_appointments` | setup_required |
| Time Clock | Track time entries | `employee_time_entries` | setup_required |
| Payroll Prep | Wage projections and pay periods | `employee_wage_rates`, `employee_pay_periods`, `employee_pay_statements` | setup_required |
| Inventory | Track stock and reorder risk | `inventory_items` | setup_required |
| Vendors | Track vendor accounts and invoices | `vendor_accounts`, `vendor_invoices` | setup_required |
| Recipes | Calculate recipe cost | `recipe_cards`, `recipe_ingredients` | setup_required |
| Menu/POS | Menu items and sales summaries | `menu_items`, `pos_sales_summaries` | setup_required |
| Assets | Equipment, vehicles, trailers | `business_assets`, `vehicle_records` | setup_required |
| Routes | Delivery/service route tracking | `route_tracking_sessions`, `location_events` | setup_required |

## Creator Studio

| Module | Customer value | Data/API target | Status |
|---|---|---|---|
| Asset Catalog | Organize creator assets | `/api/creator-studio/assets`, `creator_assets` | wired |
| Creator Offers | Build creator packages | `/api/creator-studio/offers`, `module_outputs` | wired |
| Release Checklist | Prepare releases | `creator_releases`, `creator_release_packages` | setup_required |
| Artist Identity Engine | Store identity system | `creator_artist_systems` | setup_required |
| Song Development Studio | Plan songs and projects | `creator_song_blueprints`, `music_projects` | setup_required |
| Originality Guard | Review similarity and rights risk | `creator_quality_checks` | setup_required |
| Visual World Builder | Plan cover/video/world assets | `creator_assets`, `creator_release_packages` | setup_required |
| Music System | Projects, tracks, stems, DAW exports | `/creator-studio/music-system`, music tables | wired |
| Audio Analysis | Reports and job records | `audio_analysis_reports`, `music_ai_jobs` | setup_required |
| ASR Transcription | Speech-to-text workflow | `audio_transcription_segments` | review_required |
| OpenCut/OBS Workflow | Video/recording reference workflow | adapter docs and storage | review_required |

## Growth Studio

| Module | Customer value | Data/API target | Status |
|---|---|---|---|
| Campaign Workspace | Plan campaigns | `/api/growth-studio/campaigns`, `growth_campaigns` | wired |
| Leads | Track leads and source | `/api/growth-studio/leads`, `growth_leads` | wired |
| Consent Checklist | Keep outreach safe | `growth_leads`, `automation_rules` | setup_required |
| Experiments | Track tests and outcomes | `growth_experiments` | setup_required |
| Automations | Owner-approved automation rules | `automation_rules` | setup_required |
| Analytics | ROI and conversion formulas | formula tables and growth records | wired |

## Admin System

| Module | Purpose | Target | Status |
|---|---|---|---|
| Readiness | Show service readiness | `/api/readiness` | live |
| Health | Show deployment health | `/api/health` | live |
| Formula Visualizer | Formula definitions and results | `/admin/formulas` | wired |
| Ecosystem Visualizer | Source-of-truth system map | `/admin/ecosystem` | wired |
| Users/Roles | Founder/user management | `/admin/users`, `/admin/roles` | wired |
| Billing Updates | Webhook/event audit | `/admin/webhooks` | wired |
| Support Queue | Contact/support visibility | `/admin/support` | wired |
| Storage Visualizer | Bucket readiness | planned | planned |
| Realtime Visualizer | Channel/policy readiness | planned | planned |
| Worker Visualizer | Edge/job status | planned | planned |
| Route Visualizer | Route registration map | planned | planned |

# Workspace and workflow audit

Measured on 2026-08-05 against `main`. Every number here was taken from the
running application or from the migration files, not estimated. Where a method
could not give a reliable answer it says so rather than guessing.

## The short version

Business Builder is a real workspace. Creator Studio and Growth Studio are
mostly places to look at records that nothing can create.

| | Business Builder | Creator Studio | Growth Studio |
| --- | --- | --- | --- |
| Pages registered | 60 | 49 | 40 |
| Record types you can create | 19 | 2 | 2 |
| Record types you can only read | few | many | 12 |

## How the numbers were taken

Route counts come from walking the Express router on a booted app, not from
grep — `app._router.stack`, filtered by method. Grep undercounts because
several routers register paths in loops.

Create flows come from two maps read directly rather than inferred:

- `RESOURCES` in `lib/sonara-module-crud.cjs` — the shared CRUD registry.
- `RESOURCE_MAP` in `routes/sonara-last9-routes.cjs` — Business Builder's own.

I tried three times to derive create flows by pattern-matching the source and
got a different wrong answer each time, because table names are looked up at
runtime (`TABLES[resource]`) and static matching cannot resolve them. The maps
are the ground truth; the regex results are not in this document.

## Finding 1 — Growth Studio: 12 of 14 record types have no way in

`routes/growth-studio-control-routes.cjs` defines fourteen record types in its
`TABLES` map. Cross-referenced against the POST routes the app actually
registers:

| Record type | Table | Can a customer create one? |
| --- | --- | --- |
| campaigns | `growth_campaigns` | yes |
| leads | `growth_leads` | yes |
| experiments | `growth_experiments` | **no** |
| automations | `automation_rules` | **no** |
| connections | `growth_provider_connections` | **no** |
| segments | `growth_audience_segments` | **no** |
| consents | `growth_contact_consents` | **no** |
| touchpoints | `growth_touchpoints` | **no** |
| conversions | `growth_conversions` | **no** |
| content | `growth_content_queue` | **no** |
| jobs | `growth_provider_jobs` | **no** |
| metrics | `growth_metric_snapshots` | **no** |
| variants | `growth_experiment_variants` | **no** |
| events | `growth_control_events` | **no** |

Each of the twelve has a table, row-level security, tenant scoping, a
registered page, and a rendering description in
`lib/sonara-growth-record-pages.cjs`. Everything exists except the way to put a
record in. The page renders its empty state, correctly and permanently.

Some of the twelve should stay read-only — `growth_control_events` and
`growth_metric_snapshots` are things the system records about itself, and a
customer creating one by hand would be recording something that did not happen.
`growth_provider_jobs` is written by the provider integration. That still leaves
segments, experiments, variants, consents, touchpoints, conversions, content
queue and automations as record types a customer is shown and cannot make.

## Finding 2 — the catalog sells one of them at the Starter plan

`lib/catalog/growth-studio-products.cjs` advertises **Lead Capture & Lists** at
the Starter tier, availability `beta`, workspace `/growth-studio/segments`,
capabilities listed as "lead forms | lead records | segments | source tracking |
lead scoring | follow-up priority".

`beta` renders to a customer as "Early access — usable now, still being
refined" (`lib/sonara-plain-language.cjs`). Segments cannot be created.

Lead records can, so the entry is not wholly unfounded, and this is the only
catalog row I am confident enough about to name. A fuller catalog-to-workflow
audit needs the workspace path of every row checked by hand against what that
page can do; my attempt to compute it conflated dashboards with record
workspaces and is not included.

## Finding 3 — the database carries 206 tables the application never names

300 tables are created across `supabase/migrations/`. 94 are named anywhere in
the application source. 206 are not named anywhere.

The orphans are not random. Many are earlier-generation versions of tables that
are live under a different name:

| Orphaned table | The one the app actually uses |
| --- | --- |
| `campaigns` | `growth_campaigns` |
| `customers` | `customer_records` |
| `bookings` | `business_bookings` |
| `leads` | `growth_leads` |
| `employee_profiles` | `business_employee_profiles` |
| `creator_profiles`, `creator_releases` | `creator_assets` |
| `billing_customers` | `stripe_customers` |
| `audit_log`, `audit_logs`, `audit_events` | `admin_audit_logs` |

This is worth stating plainly because of how it looks from the owner's seat.
Open the database, look for the workspace you expect, and the table with the
obvious name is there and empty — and always will be, because the application
writes somewhere else. "The workspace is missing" is a reasonable conclusion to
draw from that, and it is what the schema is telling you.

Three or four generations of schema are layered here. Nothing is broken by
their presence, but they cost real things: every `select *` planner decision,
every migration replay, every backup, and every attempt to understand the
system by reading the schema.

**Removing them is a destructive change and needs owner approval before
anything is written.** They are listed, not touched.

## What is not in this document

- Whether each of the 149 product pages renders something useful to a
  signed-in customer. Checking that properly needs an authenticated session
  against the live Supabase project, which this environment cannot open.
- A complete catalog-row-to-workflow map, for the reason given in Finding 2.
- Any judgement about which of the twelve missing Growth Studio flows matter
  most commercially. That is an owner's decision, not an engineering one.

# Workspace and workflow audit

Measured on 2026-08-05 against `main`. Every number here was taken from the
running application or from the migration files, not estimated. Where a method
could not give a reliable answer it says so rather than guessing.

## The short version

Business Builder is a real workspace. Creator Studio is thin. Growth Studio had
the endpoints all along and no forms to reach them — see the correction below,
which replaces what this section originally claimed.

| | Business Builder | Creator Studio | Growth Studio |
| --- | --- | --- | --- |
| Pages registered | 60 | 49 | 40 |
| Record types with a create endpoint | 19 | 2 | 10 |
| Record types with a form to reach it | 19 | 2 | 3 |

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

## Correction, 2026-08-05

**Finding 1 as first published was wrong.** It said twelve of the fourteen
Growth Studio record types had no create endpoint. They have one. I checked
`/api/growth-studio/<type>` and the routes are registered at
`/api/growth/<type>`, so a whole family of endpoints was invisible to the check
and I reported their absence.

Ten of the fourteen have a POST handler that validates input, scopes to the
organization and writes an audit event: campaigns, leads, segments,
experiments, consents, automations, content, conversions, touchpoints and
provider jobs. Four do not: variants, metrics, control events and provider
connections.

The mistake was caught by acting on it. Wiring create handlers for the
"missing" types produced two POST registrations on the same paths, which is
what surfaced the existing ones. Had the audit stayed on paper it would still
read as true.

The real finding is below and is narrower, but it is not nothing.

## Finding 1 (corrected) — ten create endpoints, and no form for any of them

Before 2026-08-05 no page in the application rendered a form posting to
`/api/growth/*`. Not one of the ten. The only way a customer could create a
segment was to hand-craft an HTTP request.

The record page listed segments, correctly showed none, and offered no way to
add one. From the customer's seat the workflow was missing, and the server had
been ready for it the whole time. A create route reachable only by knowing its
URL is the same as not having one.

Three now have a form on their record page — segments, experiments and
consents, the three with a page in `lib/sonara-growth-record-pages.cjs`.
Content, automations, conversions and touchpoints have endpoints and no record
page, so giving them forms means giving them pages first.

## The original Finding 1, kept for the record

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
refined" (`lib/sonara-plain-language.cjs`). Segments had an endpoint and no way
to reach it, so the row was advertising something a customer could not do. It
has a form as of 2026-08-05, which is the narrow sense in which this finding is
now closed.

Lead records also work, so the entry was not wholly unfounded, and this is the only
catalog row I am confident enough about to name. A fuller catalog-to-workflow
audit needs the workspace path of every row checked by hand against what that
page can do; my attempt to compute it conflated dashboards with record
workspaces and is not included.

## Finding 3 — tables the application never queries

**This finding's headline number was wrong, and the way it was wrong is the
useful part.** It said 300 tables are created, 94 are named anywhere in the
application source, and 206 are not. That count cannot be reproduced, because
"named anywhere in the application source" is not a well-defined measure:

- Count `docs/` as source and the answer is **0** — this document lists every
  orphan by name, so the audit made its own finding disappear.
- Count `lib/sonara-database-contract.cjs` and
  `lib/sonara-tenant-scoped-tables.cjs` and the answer is **0** again. Those are
  generated inventories that name every table by construction, so a table
  appearing in them is not evidence anything uses it.
- Count a name that appears only in a code comment and three more tables look
  used that are not.

Measured as *no file that queries anything names it*, with generated
inventories and comments excluded, it was **90**. It is **87** now, because
three of them became workspaces in the same change that corrected this section.

`scripts/report-orphan-tables.mjs` is that measurement. It recomputes on every
run, so no number stored in a document can drift from the schema again, and
`pnpm run verify:orphan-tables` fails when a table is created that nothing
queries and nothing has classified.

### The observation underneath it still holds

Many orphans are earlier-generation versions of tables that are live under a
different name:

| Orphaned table | The one the app actually uses |
| --- | --- |
| `campaigns` | `growth_campaigns` |
| `customers` | `customer_records` |
| `bookings` | `business_bookings` |
| `leads` | `growth_leads` |
| `employee_profiles` | `business_employee_profiles` |
| `billing_customers`, `sonara_billing_customers` | `stripe_customers` |
| `audit_events`, `permission_audit_logs` | `admin_audit_logs` |
| `contact_records` | `customer_records` |

This is worth stating plainly because of how it looks from the owner's seat.
Open the database, look for the workspace you expect, and the table with the
obvious name is there and empty — and always will be, because the application
writes somewhere else. "The workspace is missing" is a reasonable conclusion to
draw from that, and it is what the schema is telling you.

### "Drop them" was also the wrong action for most of the list

`lib/sonara-orphan-tables.cjs` records a decision per table. They are not one
problem:

| Kind | Count | What it is | Action |
| --- | --- | --- | --- |
| superseded | 13 | An earlier generation of a live table | Retire, successor named per table |
| unbuilt subsystem | 51 | A subsystem designed in SQL and never written — 18 `github_repository_*`, 11 `entity_*`, 9 platform registries, 8 open-source review, 5 sub-app builder | Await direction |
| buildable | 19 | An ordinary feature with a real schema and no code | Build, or deferred with a stated reason |
| system | 4 | Written by infrastructure, not the application | Keep |

Only the 13 superseded tables are deletion candidates, and each names what
replaced it so the decision can be made one at a time rather than as a bulk
operation. **Whether any of them hold rows cannot be answered from this
repository.** That check belongs against the live project, before any drop.

Three tables moved off this list by being built rather than dropped:
`purchase_orders`, `inventory_count_sessions` and `location_transfers` are now
`/business-builder/owner/purchase-orders`, `/stock-counts` and `/transfers`.
Their `_lines` children deliberately have no pages of their own — a line
detached from its order or count is an orphaned row.

## What is not in this document

- Whether each of the 149 product pages renders something *useful* to a
  signed-in customer. tests/signed-in-workspace-crawl.test.js now checks that
  207 of 232 pages render rather than erroring for a signed-in account with no
  records, which is the floor. Whether what they render is worth reading is
  still not measured here.
- A complete catalog-row-to-workflow map, for the reason given in Finding 2.
- Any judgement about which of the twelve missing Growth Studio flows matter
  most commercially. That is an owner's decision, not an engineering one.

---
name: adding-a-record-page
description: Add a customer-facing record page backed by a new or existing Supabase table in SONARA One. Use when building any page that lists, creates, or details business records - products, waste, areas, invoices, bookings - or when a table exists with no way in. Covers the full multi-file sequence and the release checks that will refuse an incomplete one.
---

# Adding a record page

A record page in this repository is a **description**, not a handler. You declare
which records, which columns, and which fields go in the form; the rendering is
done once in `routes/sonara-last9-routes.cjs`. That is why this is a checklist
rather than a coding task — the work is spread across eight files, and the
release chain refuses six different kinds of incomplete.

Read `AGENTS.md` and `CLAUDE.md` first. This skill assumes them.

## The sequence

Do these in order. Steps 1–3 can be committed together and nothing before step 8
proves anything.

### 1. Check the table's names mean what they say

Before writing anything, open the migration. Three tables in this repository had
names pointing somewhere their columns did not:

- `song_fingerprints` holds descriptions of a work, not audio.
- `accounting_exports` promised a file nothing produced.
- `products` records which SONARA product an organization enabled — it is not a
  merchant catalogue.

If the table is new, also search every migration for a table that already does
the job. `merchant_products` is named that way because `products` was taken and
two tables called products is how the next person loses an afternoon.

### 2. The migration, if the table is new

```
supabase/migrations/YYYYMMDDHHMMSS_what_it_is.sql
```

Requirements the checks enforce:

- `organization_id uuid not null references public.organizations(id) on delete cascade`
  — this is the tenant boundary. The service key bypasses row level security, so
  the filter in the query is the only thing separating two businesses.
- `alter table public.X enable row level security;` plus a service-role policy.
  Copy the shape from `20260811234500_customer_invoice_lines.sql`.
- Money in **integer cents**. No floats near a total.
- A price belongs in one place. If a parent and a child could both carry one,
  put it on the child — two answers to "what does this cost" is drift waiting to
  happen.

Then:

```bash
node scripts/verify-applied-migrations.mjs --write
pnpm run gen:tenant-tables
```

**A migration cannot be edited once pinned.** If you need to change it before it
ships, remove its entry from `supabase/applied-migration-checksums.json` first —
that is honest while it is uncommitted, and impossible once it is not.

### 3. The page

`lib/sonara-owner-record-pages.cjs`. Copy the nearest existing page rather than
inventing a shape. The rules that hold throughout:

- Money renders as money. Never print `1250` at somebody reading their own prices.
- **Nothing is invented.** An empty column reads "Not set", never `0`. Use
  `finiteNumber` — `Number(null)` is `0` and that once made an unpriced service
  read as free across twenty-three columns.
- **Absent is not false, and `null` is not `[]` is not `0`.** A column that did
  not come back is not a column that is false.
- A field pointing at another record is `type: "reference"` with `from:` naming
  an entry in `REFERENCE_SOURCES`. Asking somebody to paste a UUID is not a form.
- Child tables go in `lines:` (one, or an array). A row that cannot exist without
  its parent gets no page of its own.
- `totalFrom` is optional. Leave it out when summing the column would produce a
  number nobody is ever charged — a small, a medium and a large added together.

### 4. The endpoint

`RESOURCE_MAP` in `routes/sonara-last9-routes.cjs`. Name the `person` column
correctly or the insert fails silently — seventeen of nineteen tables have no
`user_id`, and PostgREST rejects an insert naming a column that is not there.
`tests/owner-record-inserts.test.js` checks every entry against
`lib/sonara-migration-columns.cjs`.

Set defaults that are honest. A status of `queued` claims a worker; if nothing
processes the row, say so instead — `manual_required`, `review_required`, `draft`.

### 5. The route registry

`lib/sonara-route-registry.cjs`. Static paths only; a parameterised detail route
(`/products/:recordId`) is not listed.

### 6. Search

`lib/sonara-search.cjs`. `tests/search-keeps-up.test.js` refuses a new owner page
that is neither searchable nor listed in `NOT_SEARCHABLE` with a reason. Pick
columns somebody would actually type. Not a number.

### 7. OpenAPI and the database contract

- `openapi/sonara.yaml` — one entry per registered method, unique `operationId`.
- `scripts/verify-supabase-contract.mjs` — add the table to
  `BUSINESS_OPERATIONS_TABLES` and the migration filename to
  `businessOperationsMigrationNames`, or the runtime scan fails on an
  uncontracted reference.

### 8. Tests, and the part that decides whether any of this counted

Write the test, then **break the thing it tests and watch it fail.** A check that
has never failed is a check nobody has verified.

The defect this repository keeps producing is not broken code. It is *a signal
that reports success without being true*: a test passing against a stub, a gate
asserting a guarantee that stopped holding, a check satisfied by an empty list.
So:

- Assert the list is non-empty before asserting anything about its contents.
  `assert.ok(pages.length >= 5, "this check has gone blind")`.
- Cover the three states of a read: succeeded with rows, succeeded with none,
  and **failed**. A failed read must never render as "you have no records" —
  `tests/no-page-lies-when-the-database-is-down.test.js` will catch it, and the
  fix is usually the wording, not an exemption.
- Avoid "Nothing is…" / "Nothing here…" in page copy. The outage crawl reads it
  as a claim about the customer's records. Say what the feature does instead.

## Then run the chain

```bash
pnpm exec mocha            # the whole suite; .mocharc.json owns the globs
pnpm run lint              # --max-warnings=0, so an unused var fails
pnpm run verify:launch     # 24 commands; judge by EXIT CODE
```

`verify:launch` prints `ERROR` lines about `docs/stale-claim-probe.md` and
`SONARA_PROBE_VARIABLE_NOBODY_CLASSIFIED`. Those are the chain self-testing its
own guards. They are not failures. **Judge by the exit code.**

Real failures, in the order they usually appear:

| Symptom | Fix |
| --- | --- |
| `report-orphan-tables --check` non-zero | The new table has no read path. It cannot be committed alone. |
| `docs/HANDOFF_PROMPT.md is out of date` | `node scripts/generate-handoff-prompt.mjs` |
| `verify-doc-counts` names a stale figure | Update the document it names; the count is derived. |
| `OpenAPI is missing registered routes` | Step 7. |
| eslint `no-unused-vars` | `--max-warnings=0`. |

Finish by adding an entry to `docs/SPRINT_LOG.md` — newest first, saying what
changed, what was verified, and what the next person should not have to
rediscover. It is the only hand-written part of the handoff prompt.

## What not to do

- **Do not add a form to a dead end without checking what consumes the rows.**
  Four times running, the honest fix was the status or the copy, not a door.
  `grep` for the table across `server.js`, `routes/` and `lib/`. If nothing reads
  it, a form lets somebody queue work that will never run.
- **Do not weaken a check to make it pass.** `SECURITY_NOTES.md` exists for the
  case where it is genuinely right, and it requires the exact reason in writing.
- **Do not write a reason into an exemption you have not verified.** One read
  "no page displays `location_zones`" while a page displayed them. A wrong reason
  inside an exemption is worse than no exemption, because it is what the next
  person reads instead of checking.

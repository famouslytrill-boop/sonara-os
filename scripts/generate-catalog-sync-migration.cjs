"use strict";

// Keep the published catalog rows in step with the catalog in code.
//
// service_catalog_items was seeded once, by hand, in
// 20260725180000_recommended_product_catalog.sql. The catalog then also lives
// in lib/catalog/*.cjs, and /service-catalog merges the database rows over the
// code defaults -- so the database wins on anything it holds.
//
// Renaming the products in code without touching the table therefore did two
// things at once:
//
//   1. Production kept serving the old names, including "SONARA Nexus Shared
//      Operating Spine" -- a retired public name that AGENTS.md forbids in
//      active UI.
//   2. scripts/verify-production-product-catalog.mjs, which the production
//      deploy runs as a gate, started failing on the mismatch. Four merges
//      stopped reaching production and the site stayed on an older commit.
//
// Neither is the kind of thing a passing test suite tells you about, because
// the disagreement is between the repository and a live database.
//
// This generates the UPDATE statements from RECOMMENDED_PRODUCT_CATALOG, so
// the rows are derived from the same source the application renders from
// rather than transcribed a second time.

const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const {
  RECOMMENDED_PRODUCT_CATALOG,
  CATALOG_VERSION
} = require(path.join(root, "lib", "sonara-recommended-product-catalog.cjs"));

function quote(value) {
  if (value === null || value === undefined) return "null";
  return `'${String(value).replace(/'/g, "''")}'`;
}

// Migrations already applied in production. Writing to one of these is refused
// in main() rather than merely discouraged.
//
// supabase db push tracks migrations by filename, so rewriting an applied one
// changes this repository and nothing else. Every check here reads the file, so
// all of them would pass while production kept the old catalog rows. The same
// guard exists in scripts/generate-member-read-policies.cjs, where it caught a
// real attempt one change after it was added.
//
// Add a filename here once its migration reaches main, and point migrationName
// at a new one.
//
// 20260728130000 -- published catalog names, applied
// 20260803180000 -- paid access driven by real entitlement enforcement, applied
// 20260812120000 -- eleven products removed from the catalog, retired here too
const APPLIED_MIGRATIONS = Object.freeze([
  "20260728130000_sync_published_catalog_names.sql",
  "20260803180000_sync_catalog_paid_access.sql"
]);

const migrationName = "20260812120000_retire_removed_catalog_products.sql";
const outputPath = path.join(root, "supabase", "migrations", migrationName);

// The assertions live in their own migration, at the END of the sequence, and
// the reason is the sharpest bug this generator has produced.
//
// This file used to finish by asserting that every one of the 42 catalog
// products was already an active published row. That assertion was generated
// from **today's** catalog and written into a migration dated **12 August**.
// Nineteen of those products are first inserted by migrations dated 18 August:
// 20260818060000 (9), 20260818070000 (9) and 20260818080000 (1). So the file
// demanded, six days early, rows that did not exist yet.
//
// Production never saw it. A database that migrates forward in real time does
// not re-run an old migration, and by the time the catalog grew, 20260812120000
// had long since been applied. The only thing that sees it is a fresh replay --
// a new Supabase preview branch, a restored backup, a second environment -- and
// every one of those failed on it.
//
// The split is the fix and it is also the general rule: **an operation belongs
// at the point in history where it happened; an assertion about the end state
// belongs at the end.** The sync and the retirement stay above, because they
// describe what changed on 12 August. The two assertions move here, because
// they describe what must be true once the whole history has run -- and only
// here are they checking the catalog the application actually ships.
const assertionMigrationName = "20260827100000_published_catalog_is_complete.sql";
const assertionOutputPath = path.join(root, "supabase", "migrations", assertionMigrationName);

// Every migration that puts a row into service_catalog_items must be dated
// before the assertions, or the assertions run too early again.
//
// This is the check for the bug above, in the generator that produced it. It
// reads the directory rather than naming files, so a catalog migration added
// tomorrow is measured rather than missed.
function catalogInsertingMigrationsAfterAssertions() {
  const dir = path.join(root, "supabase", "migrations");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".sql") && name > assertionMigrationName)
    .filter((name) => /insert\s+into\s+(public\.)?service_catalog_items/i.test(fs.readFileSync(path.join(dir, name), "utf8")));
}

const rows = RECOMMENDED_PRODUCT_CATALOG.map((item) =>
  `  (${[
    quote(item.serviceKey),
    quote(item.productKey),
    quote(item.name),
    quote(item.summary),
    quote(item.priceNote),
    quote(item.planFloor),
    quote(item.lifecycleStatus),
    quote(item.route),
    String(item.sortOrder),
    // These two decide whether a paying customer can run anything at all.
    // verify-production-product-catalog.mjs compares both against the catalog
    // and gates the deploy on them, so leaving them out of the sync would fail
    // the release rather than quietly disagreeing -- which is the better of the
    // two outcomes, and still not one worth shipping.
    String(item.entitlementIntegrationVerified),
    String(item.executionEnabled)
  ].join(", ")})`
).join(",\n");

// The same service keys in the two shapes the retirement step needs: a bare
// `not in` list, and a values list to check the reverse direction against.
const keyList = RECOMMENDED_PRODUCT_CATALOG.map((item) => `    ${quote(item.serviceKey)}`).join(",\n");
const keyRows = RECOMMENDED_PRODUCT_CATALOG.map((item) => `    (${quote(item.serviceKey)})`).join(",\n");

const contents = `-- Bring the published catalog rows in line with the catalog in code.
--
-- GENERATED by scripts/generate-catalog-sync-migration.cjs -- regenerate rather
-- than edit by hand.
--
-- /service-catalog merges service_catalog_items over the defaults in
-- lib/catalog/*.cjs, so the table wins wherever it holds a value. When the
-- product names were rewritten for customers, the table was left holding the
-- old ones -- including "SONARA Nexus Shared Operating Spine", a retired
-- public name AGENTS.md does not allow in active UI.
--
-- It also broke the production deploy: verify-production-product-catalog.mjs
-- compares these rows against the code and gates the release on them matching.
--
-- Nothing is inserted or deleted. Every service_key below was seeded by
-- 20260725180000_recommended_product_catalog.sql, so the update matches on
-- what is already there.
--
-- What is new here is the retirement step at the end, and it exists because
-- removing a product from lib/catalog/*.cjs did not remove it from the
-- product's page. /service-catalog reads service_catalog_items where
-- status = 'active' and merges those rows over the code defaults, so a row
-- the code had stopped listing carried on being published from the database --
-- with its old name, its old summary, and a route the customer could still
-- click. Deleting the row would take its history with it, so the retirement
-- flips status instead, which is what the active filter already reads.

do $$
begin
  if to_regclass('public.service_catalog_items') is null then
    raise exception 'service_catalog_items is missing; the published catalog cannot be synchronised';
  end if;
end
$$;

with published (service_key, product_key, name, summary, price_note, plan_floor, lifecycle_status, route_path, sort_order, entitlement_integration_verified, execution_enabled) as (
  values
${rows}
)
update public.service_catalog_items as target
set
  product_key = published.product_key,
  name = published.name,
  summary = published.summary,
  price_note = published.price_note,
  plan_floor = published.plan_floor,
  lifecycle_status = published.lifecycle_status,
  route_path = published.route_path,
  sort_order = published.sort_order,
  entitlement_integration_verified = published.entitlement_integration_verified,
  execution_enabled = published.execution_enabled,
  product_type = 'software_product',
  status = 'active',
  metadata = coalesce(target.metadata, '{}'::jsonb) || jsonb_build_object('catalogVersion', ${quote(CATALOG_VERSION)})
from published
where target.service_key = published.service_key;

-- Retire the rows the catalog no longer lists.
--
-- /service-catalog filters on status = 'active', so this is the switch that
-- decides whether a product is published. The row and its history stay.
update public.service_catalog_items as target
set status = 'retired'
where target.status = 'active'
  and target.service_key is not null
  and target.service_key not in (
${keyList}
  );

`;

// The assertions, as their own migration at the end of the sequence.
//
// Both are about the state of the published catalog once every migration has
// run. Neither is safe at 20260812120000, because the catalog that file was
// generated from is not the catalog that exists at that point in history.
const assertionContents = `-- The published catalog is complete, and carries no retired name.
--
-- GENERATED by scripts/generate-catalog-sync-migration.cjs -- regenerate rather
-- than edit by hand.
--
-- These two checks used to live at the end of
-- 20260812120000_retire_removed_catalog_products.sql. They were generated from
-- the current catalog and written into a migration dated six days before
-- nineteen of those products were inserted, so a fresh replay of the migration
-- history always failed on the first of them. Production never noticed: it
-- migrated forward in real time and never re-ran the old file.
--
-- An operation belongs where it happened. An assertion about the end state
-- belongs at the end. That is the whole reason this file exists.

do $$
begin
  if to_regclass('public.service_catalog_items') is null then
    raise exception 'service_catalog_items is missing; the published catalog cannot be checked';
  end if;
end
$$;

-- Every product in the code catalog must be an active published row.
--
-- The retirement in 20260812120000 cannot fail this, because it only ever
-- touches keys the catalog does not list. What this catches is the other
-- direction: a product renamed in code without a matching service_key in the
-- table, where the sync update silently matches nothing and the product never
-- reaches the published catalog at all.
do $$
declare
  missing text;
begin
  select string_agg(published.service_key, ', ' order by published.service_key)
    into missing
  from (values
${keyRows}
  ) as published(service_key)
  where not exists (
    select 1 from public.service_catalog_items
    where service_key = published.service_key and status = 'active'
  );

  if missing is not null then
    raise exception 'these catalog products have no active published row: %', missing;
  end if;
end
$$;

-- The retired name must not survive anywhere in the published catalog. This is
-- the check, not a comment: if a row still carries it the migration fails
-- rather than letting production keep serving it.
--
-- Stronger here than it was at 20260812120000, and that is a second reason for
-- the move: there it only ever saw the rows that existed on 12 August, so a
-- retired name introduced by any later migration went unchecked.
do $$
declare
  offending integer;
begin
  select count(*) into offending
  from public.service_catalog_items
  where name ilike '%nexus%' or summary ilike '%nexus%';

  if offending > 0 then
    raise exception 'a retired public name survives in service_catalog_items on % row(s)', offending;
  end if;
end
$$;
`;

function main() {
  const wanted = [
    { name: migrationName, file: outputPath, body: contents },
    { name: assertionMigrationName, file: assertionOutputPath, body: assertionContents }
  ];

  // The guard for the bug this generator produced. Checked on --check as well
  // as on write, because the way it comes back is somebody adding a catalog
  // migration months from now, not somebody regenerating today.
  const tooLate = catalogInsertingMigrationsAfterAssertions();
  if (tooLate.length) {
    console.error(
      `[fail] these migrations insert catalog rows AFTER ${assertionMigrationName}, so its assertions run before those rows exist:\n` +
        tooLate.map((name) => `  ${name}`).join("\n") +
        "\n\nThat is the defect this split exists to prevent: an assertion generated from today's catalog,\n" +
        "sitting at a point in history where part of that catalog has not been inserted yet. Production will not\n" +
        "notice, because it never re-runs an old migration; a fresh replay fails every time.\n" +
        "Move the assertions into a new migration dated after the newest of the files above."
    );
    process.exit(1);
  }

  if (process.argv.includes("--check")) {
    for (const { name, file, body } of wanted) {
      const previous = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
      if (previous !== body) {
        console.error(`[fail] ${name} is stale. Run \`pnpm run gen:catalog-sync\` and commit the result.`);
        process.exit(1);
      }
    }
    console.log(
      `Published catalog sync verified: ${RECOMMENDED_PRODUCT_CATALOG.length} products at version ${CATALOG_VERSION}, ` +
      `across ${wanted.length} generated migrations, assertions last.`
    );
    return;
  }

  for (const { name, file, body } of wanted) {
    if (APPLIED_MIGRATIONS.includes(name)) {
      console.error(
        `Refusing to write ${name}: it has already been applied in production.\n` +
          "supabase db push tracks migrations by filename, so rewriting an applied one changes this repository and nothing else --\n" +
          "every check here would pass while production kept the old catalog rows.\n" +
          "Point the generator at a new file instead."
      );
      process.exit(1);
    }
    fs.writeFileSync(file, body);
    console.log(`Wrote ${name}.`);
  }
  console.log(`${RECOMMENDED_PRODUCT_CATALOG.length} products at version ${CATALOG_VERSION}.`);
}

if (require.main === module) main();

module.exports = { migrationName, assertionMigrationName, APPLIED_MIGRATIONS, catalogInsertingMigrationsAfterAssertions };

"use strict";

// Bring a table that already exists up to the shape later migrations expect.
//
// `20260811210000_repair_missing_platform_tables.sql` creates 42 tables that
// production is missing, because `010_sonara_platform_current_schema.sql` is a
// pre-CLI snapshot production's history marks applied and never ran. Every one
// of its statements is `create table if not exists`.
//
// That repairs a table that is **absent**. It does nothing at all for a table
// that is **present in an older shape**, and that is the case production is
// actually in. Deployment run #125 on 3 September 2026 proved it:
//
//     Applying migration 20260819030000_member_read_policies_research_sources.sql...
//     NOTICE: skipping shared_links: table not present
//     ERROR: column "organization_id" does not exist (SQLSTATE 42703)
//     At statement: 10
//       create policy "customers_select_member" on public.customers
//         for select to authenticated using (public.is_org_member(organization_id))
//
// `public.shared_links` is absent, so the guard skipped it. `public.customers`
// is **present without `organization_id`**, so the guard let it through and the
// statement failed. The generated policy migrations guard on the table
// existing; nothing guards on the column existing, and nothing was ever going
// to add it.
//
// So this emits the other half: for every table the repair migration declares,
// add any of its declared columns the live table is missing.
//
// ## What is deliberately dropped from each column definition
//
// The repair migration declares the shape a *new* table gets. Applying that
// verbatim to a table that already holds rows would fail, so the ALTER form
// keeps only the type and the default:
//
//   `not null`      a table with rows cannot gain a NOT NULL column unless
//                   every existing row already satisfies it. Adding the column
//                   nullable is what unblocks the deploy; tightening it is a
//                   separate decision that needs to know what is in there.
//   `primary key`   the live table already has one. A second is an error, and
//                   silently adding a different `id` to a populated table is
//                   worse than the problem being fixed.
//   `unique`        the live rows may already violate it.
//   `references`    kept out because the referenced table may itself be present
//                   in an older shape, and a failed constraint here fails the
//                   whole deploy for something that is not blocking it.
//
// **That means production ends up with the columns later migrations need, and
// not with full referential parity against a fresh replay.** That is a real,
// stated divergence rather than a hidden one, and closing it is a separate
// reconciliation that should be driven by a dump of what production actually
// holds. Saying so here is the point: the last time this was guessed at, the
// guess was that creating absent tables would be enough.
//
// The generated file is idempotent -- `add column if not exists` on every
// statement, each table guarded by `to_regclass`, so a table this does not find
// is skipped with a notice rather than failing the run. Replaying the
// migrations against an empty database makes every statement here a no-op,
// because the repair migration one version earlier created each table whole.

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const migrationsDir = path.join(root, "supabase", "migrations");
const SOURCE = "20260811210000_repair_missing_platform_tables.sql";

// Versioned between the repair (…811210000) and the first migration that fails
// on a missing column (…819030000). `supabase db push --include-all` is what
// applies a migration versioned earlier than one already recorded, which is the
// same mechanism that let the repair itself be slotted in.
const OUTPUT = "20260812000000_existing_tables_reach_the_shape_later_migrations_expect.sql";

// A column this must never add to a table that already exists. `id` is the
// primary key on every table the repair declares; a live table has its own.
const NEVER_ADD = new Set(["id"]);

function tableBodies(sql) {
  const tables = [];
  for (const match of sql.matchAll(/create table if not exists public\.([a-z_0-9]+) \(([\s\S]*?)\n\);/g)) {
    tables.push({ name: match[1], body: match[2] });
  }
  return tables;
}

/**
 * `organization_id uuid not null references public.organizations(id) on delete cascade`
 *   -> { name: "organization_id", definition: "uuid" }
 * `tags text[] not null default '{}'`
 *   -> { name: "tags", definition: "text[] default '{}'" }
 *
 * Returns null for a line that is a table-level constraint rather than a column.
 */
function column(line) {
  const trimmed = line.trim().replace(/,$/, "");
  if (!trimmed) return null;
  if (/^(primary key|unique|constraint|check|foreign key|exclude)\b/i.test(trimmed)) return null;
  const named = /^([a-z_][a-z_0-9]*)\s+(.+)$/i.exec(trimmed);
  if (!named) return null;
  const [, name, rest] = named;
  if (NEVER_ADD.has(name)) return null;

  // The type is everything up to the first clause that cannot survive being
  // applied to a populated table. `default` is kept; it is what makes the new
  // column useful rather than a column of nulls.
  const cut = rest.search(/\s+(not null|null|primary key|unique|references|check|generated|collate)\b/i);
  const type = (cut === -1 ? rest : rest.slice(0, cut)).trim();
  if (!type) return null;

  const defaultClause = /\bdefault\s+(.+?)(?=\s+(?:not null|null|primary key|unique|references|check|generated|collate)\b|$)/i.exec(rest);
  const definition = defaultClause ? `${type} default ${defaultClause[1].trim()}` : type;
  return { name, definition };
}

function build() {
  const sql = fs.readFileSync(path.join(migrationsDir, SOURCE), "utf8");
  const tables = tableBodies(sql);
  if (tables.length < 40) {
    throw new Error(`only ${tables.length} tables parsed out of ${SOURCE}; this generator has gone blind`);
  }

  const blocks = [];
  let columns = 0;
  for (const table of tables) {
    const declared = table.body.split("\n").map(column).filter(Boolean);
    if (!declared.length) continue;
    columns += declared.length;
    const alters = declared
      .map((col) => `    execute 'alter table public.${table.name} add column if not exists ${col.name} ${col.definition.replace(/'/g, "''")}';`)
      .join("\n");
    blocks.push(
      `do $$\nbegin\n` +
      `  if to_regclass('public.${table.name}') is null then\n` +
      `    raise notice 'skipping ${table.name}: table not present';\n` +
      `    return;\n` +
      `  end if;\n\n` +
      `${alters}\n` +
      `end\n$$;`
    );
  }

  if (columns < 400) throw new Error(`only ${columns} columns parsed; this generator has gone blind`);

  const header = [
    "-- Generated by scripts/generate-existing-table-shape-repair.cjs. Do not edit by hand.",
    "--",
    "-- The other half of 20260811210000_repair_missing_platform_tables.sql.",
    "--",
    "-- That migration is 42 `create table if not exists` statements, which repair a",
    "-- table that is ABSENT and do nothing for a table that is PRESENT in an older",
    "-- shape. Production is in the second state. Deployment run #125 on 3 September",
    "-- 2026 failed on exactly that:",
    "--",
    "--     Applying migration 20260819030000_member_read_policies_research_sources.sql...",
    "--     NOTICE: skipping shared_links: table not present",
    "--     ERROR: column \"organization_id\" does not exist (SQLSTATE 42703)",
    "--",
    "-- `shared_links` was absent, so its guard skipped it. `customers` was present",
    "-- without `organization_id`, so the guard let it through and the policy failed.",
    "--",
    "-- Every statement below is `add column if not exists`, under a `to_regclass`",
    "-- guard, so this is idempotent and a table it does not find is a notice rather",
    "-- than a failed deployment. Replayed against an empty database every statement",
    "-- is a no-op, because the migration one version earlier creates each table whole.",
    "--",
    "-- Columns are added NULLABLE and without their primary key, unique or foreign",
    "-- key clauses -- a table that already holds rows cannot take those. So this",
    "-- gives production the columns later migrations need and NOT full referential",
    "-- parity with a fresh replay. That divergence is real and is stated rather than",
    "-- hidden; closing it needs a dump of what production actually holds. The last",
    "-- time this was guessed at, the guess was that creating absent tables would be",
    "-- enough.",
    "--",
    `-- ${tables.length} tables, ${columns} column repairs.`,
    ""
  ].join("\n");

  return { text: `${header}\n${blocks.join("\n\n")}\n`, tables: tables.length, columns };
}

const built = build();
const outputPath = path.join(migrationsDir, OUTPUT);
const check = process.argv.includes("--check");

if (check) {
  const existing = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, "utf8") : "";
  if (existing !== built.text) {
    process.stderr.write(
      `ERROR: ${OUTPUT} is out of date. Run: node scripts/generate-existing-table-shape-repair.cjs\n`
    );
    process.exit(1);
  }
  process.stdout.write(
    `Existing-table shape repair verified: ${built.tables} tables, ${built.columns} column repairs, derived from ${SOURCE}.\n`
  );
} else {
  fs.writeFileSync(outputPath, built.text);
  process.stdout.write(
    `Wrote supabase/migrations/${OUTPUT}: ${built.tables} tables, ${built.columns} column repairs, derived from ${SOURCE}.\n`
  );
}

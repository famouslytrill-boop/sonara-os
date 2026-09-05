// Say what production's schema is missing, from the dump the deployment already takes.
//
// Controlled Production Deployment dumps production's schema before it applies
// anything -- `supabase db dump ... -f pre-migration-schema.sql`, uploaded as
// the rollback checkpoint. That file is the only honest description of what is
// actually in that database, and nothing has ever read it.
//
// The cost of not reading it, twice over:
//
//   run #124  ERROR: relation "public.quotes" does not exist
//   run #125  ERROR: column "organization_id" does not exist
//
// Each of those is **one** gap, discovered by hitting it. `supabase db push`
// stops at the first failure, so a database with fifty missing columns reports
// them at one per deployment. Both repairs in this repository were built by
// reading a single error message and inferring the rest, and the first inference
// -- that absent tables were the whole story -- was wrong.
//
// This reads the dump instead. It is a **report, not a gate**: it never fails
// the build, because a schema gap is not a reason to refuse to deploy the fix
// for it, and because a diagnostic that can block the thing it diagnoses gets
// removed the first time it is inconvenient. What it does is put the whole list
// in the job log and the step summary, so the next repair is derived from all of
// the gaps at once rather than the first one anybody tripped over.
//
// ## What it compares against
//
// The two repair migrations, because between them they declare the shape the
// later migrations assume:
//
//   20260811210000  42 `create table if not exists` -- the tables
//   20260812000000  the same 42 tables' columns, added if missing
//
// Both are generated or hand-written from the migrations that first defined
// those tables, so they are the repository's own statement of the expected
// shape. Reading the dump against them answers "what is still missing" in one
// pass.
//
// ## Reading a pg_dump, and the one thing that would make this lie
//
// `supabase db dump` emits `CREATE TABLE public.x (` followed by column lines
// until a line that is `);`. That is enough, and it is worth being explicit
// about the failure mode: if the parse finds nothing, this must say so loudly
// rather than report a clean bill. A dump this cannot read looks exactly like a
// database with no gaps, and "no gaps found" over an unparsed file is the
// defect this repository keeps finding. So: if fewer than a plausible number of
// tables come out of the dump, it says the parse failed and names the file.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = path.join(root, "supabase", "migrations");

const TABLE_REPAIR = "20260811210000_repair_missing_platform_tables.sql";
const SHAPE_REPAIR = "20260812000000_existing_tables_reach_the_shape_later_migrations_expect.sql";

// A dump of a real production database has hundreds of tables. Well under that
// and the parse has gone wrong rather than the database being small.
const MINIMUM_PARSED_TABLES = 20;

const dumpPath = process.argv[2];
if (!dumpPath) {
  process.stderr.write("usage: node scripts/report-production-schema-gaps.mjs <pre-migration-schema.sql>\n");
  process.exit(2);
}

// Piping this into `head` closes stdout early, and an unhandled EPIPE turns a
// diagnostic into a stack trace. The report is the point; losing the tail of it
// to a pager is not an error.
process.stdout.on("error", (error) => {
  if (error.code === "EPIPE") process.exit(0);
  throw error;
});

function say(line) {
  process.stdout.write(`${line}\n`);
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) fs.appendFileSync(summary, `${line}\n`);
}

/** What the repository says these tables should look like. */
function expected() {
  const sql = fs.readFileSync(path.join(migrationsDir, TABLE_REPAIR), "utf8");
  const tables = new Map();
  for (const match of sql.matchAll(/create table if not exists public\.([a-z_0-9]+) \(([\s\S]*?)\n\);/g)) {
    const columns = match[2]
      .split("\n")
      .map((line) => line.trim().replace(/,$/, ""))
      .filter((line) => line && !/^(primary key|unique|constraint|check|foreign key|exclude)\b/i.test(line))
      .map((line) => /^([a-z_][a-z_0-9]*)\s+/i.exec(line)?.[1])
      .filter(Boolean);
    tables.set(match[1], new Set(columns));
  }
  if (tables.size < 40) {
    throw new Error(`only ${tables.size} tables parsed out of ${TABLE_REPAIR}; this report has gone blind`);
  }
  return tables;
}

/** What the dump says is actually there. */
function actual(text) {
  const tables = new Map();
  const lines = text.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const opening = /^CREATE TABLE (?:IF NOT EXISTS )?(?:public|"public")\.("?)([a-z_0-9]+)\1 \(/i.exec(lines[index]);
    if (!opening) continue;
    const columns = new Set();
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const line = lines[cursor].trim();
      if (line.startsWith(")")) break;
      const named = /^("?)([a-z_][a-z_0-9]*)\1\s+\S/i.exec(line);
      if (named && !/^(primary key|unique|constraint|check|foreign key|exclude)\b/i.test(line)) {
        columns.add(named[2]);
      }
    }
    tables.set(opening[2], columns);
  }
  return tables;
}

const dump = fs.readFileSync(dumpPath, "utf8");
const live = actual(dump);

if (live.size < MINIMUM_PARSED_TABLES) {
  // Loudly, and non-zero, because this is the one outcome that must never be
  // mistaken for a clean bill. It is still not a deployment gate -- the workflow
  // step that calls this does not fail on it -- but the exit code is there so a
  // human running it by hand cannot miss it either.
  say(`### Production schema gap report FAILED TO PARSE`);
  say("");
  say(`Only ${live.size} tables were read out of \`${path.basename(dumpPath)}\` (${dump.length} bytes).`);
  say("A dump this cannot read looks exactly like a database with nothing missing, so this reports nothing rather");
  say("than reporting everything is fine.");
  process.exit(1);
}

const declared = expected();
const missingTables = [];
const missingColumns = [];

for (const [table, columns] of declared) {
  const found = live.get(table);
  if (!found) {
    missingTables.push(table);
    continue;
  }
  const absent = [...columns].filter((column) => !found.has(column));
  if (absent.length) missingColumns.push({ table, absent });
}

say("### Production schema gaps");
say("");
say(`Read \`${path.basename(dumpPath)}\`: **${live.size} tables** in production, compared against the **${declared.size} tables** the repair migrations declare.`);
say("");

if (!missingTables.length && !missingColumns.length) {
  say("**No gaps.** Every table the repair migrations declare exists in production with every declared column.");
  say("");
  say("That does not mean the deployment will succeed -- this compares against the two repair migrations only, and a");
  say("migration can fail on something neither of them describes. It means this particular class of gap is closed.");
} else {
  if (missingTables.length) {
    say(`**${missingTables.length} table(s) absent.** \`${TABLE_REPAIR}\` creates these:`);
    say("");
    for (const table of missingTables.sort()) say(`- \`${table}\``);
    say("");
  }
  if (missingColumns.length) {
    const total = missingColumns.reduce((sum, entry) => sum + entry.absent.length, 0);
    say(`**${total} column(s) missing across ${missingColumns.length} table(s) that already exist.** \`${SHAPE_REPAIR}\` adds these:`);
    say("");
    for (const entry of missingColumns.sort((a, b) => a.table.localeCompare(b.table))) {
      say(`- \`${entry.table}\`: ${entry.absent.sort().map((column) => `\`${column}\``).join(", ")}`);
    }
    say("");
  }
  say("Every one of these is covered by a repair migration in this repository. If the deployment below still fails on");
  say("a name that is **not** in this list, that is a gap neither repair describes and needs a new one.");
}

#!/usr/bin/env node
// Do the migrations actually run?
//
// `verify:db` has never executed a line of SQL. It reads the migration files
// and checks names, tables, constraints and policies as **text**. Every other
// database check here does the same. So the release chain could be green end to
// end on a migration history that no database would accept, and was.
//
// That is not hypothetical. `20260812120000_retire_removed_catalog_products.sql`
// asserted that 42 catalog products were already published at a point in the
// sequence where 19 of them had not been inserted yet -- their first inserting
// migration is dated six days later. Production never noticed, because a
// database that migrated forward in real time does not re-run an old migration.
// The only thing that sees it is a **fresh replay**, and the only fresh replay
// anybody was doing was Supabase creating a preview branch for a pull request.
//
// This is that replay, run locally, on every release.
//
// ## What it does
//
// Starts a throwaway PostgreSQL cluster, applies the Supabase primitives a
// hosted project provides, then applies every migration in filename order with
// `ON_ERROR_STOP=1`. The first error is the answer.
//
// ## The shim, and the rule that keeps it honest
//
// A bare PostgreSQL is not a Supabase project: there is no `auth` schema, no
// `anon` role, no `storage.objects`. Those have to be supplied or every
// migration that grants to `authenticated` fails for a reason that says nothing
// about our SQL.
//
// **The rule is that the shim may only supply what Supabase itself supplies.**
// Nothing in `public` is ever created here; no table, column, or row this
// repository is responsible for. The moment the shim starts creating something
// of ours to get a migration past, this check has stopped measuring the
// migrations and started measuring the shim -- and it would still print
// "passed". Every entry below names what provides it in a real project.
//
// The shim is printed on every run for the same reason: what was faked should
// be visible in the output, not discoverable by reading this file.
//
// ## Where it will not run
//
// Without PostgreSQL binaries this cannot replay anything. It says so loudly
// and exits 0, so a contributor without a local PostgreSQL is not blocked --
// **and `SONARA_MIGRATION_REPLAY_REQUIRED=1` turns that into a failure.** CI
// sets it, and tests/migrations-are-replayed-not-just-read.test.js asserts CI
// sets it, so the skip cannot quietly become the normal outcome. A check whose
// skip path is the one that always runs is not a check.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { replayBinaries, replayOwner } from "./postgres-replay-owner.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = path.join(root, "supabase", "migrations");

// Below this, something has gone wrong with finding the migrations rather than
// with the migrations. A replay of four files that reports success is the
// "passing by measuring nothing" failure this repository keeps finding.
const MINIMUM_MIGRATIONS = 90;

// Tables every replay must end up with. Not a contract -- verify:db is the
// contract -- but proof that the replay built a schema rather than silently
// doing nothing at all.
const MUST_EXIST = ["organizations", "customers", "service_catalog_items", "customer_invoices"];

// The migration that brings an already-existing table up to the declared shape.
// Named once here because the probe below deliberately re-applies it.
const SHAPE_REPAIR = "20260812000000_existing_tables_reach_the_shape_later_migrations_expect.sql";

// The migration Controlled Production Deployment #125 died on, at statement 10,
// creating a policy over a column public.customers did not have.
const BLOCKED_BY_SHAPE = "20260819030000_member_read_policies_research_sources.sql";

// What a hosted Supabase project provides and a bare PostgreSQL does not.
//
// Each entry says what supplies it in production. Nothing here is in `public`.
const SHIM = [
  ["pgcrypto", "create extension if not exists pgcrypto;", "Supabase enables it; gen_random_uuid() is used by nearly every table here"],
  ["roles", "do $$ begin\n  create role anon nologin noinherit;\nexception when duplicate_object then null; end $$;\n" +
            "do $$ begin\n  create role authenticated nologin noinherit;\nexception when duplicate_object then null; end $$;\n" +
            "do $$ begin\n  create role service_role nologin noinherit bypassrls;\nexception when duplicate_object then null; end $$;",
   "the three PostgREST roles Supabase creates; every grant in this repository names one"],
  ["auth schema", "create schema if not exists auth;", "Supabase Auth owns it"],
  ["auth.users", "create table if not exists auth.users (\n  id uuid primary key default gen_random_uuid(),\n  email text,\n  raw_user_meta_data jsonb default '{}'::jsonb,\n  created_at timestamptz default now()\n);",
   "Supabase Auth's own table; referenced by foreign keys throughout"],
  ["auth.uid()", "create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;",
   "Supabase Auth; read by row level security policies"],
  ["auth.role()", "create or replace function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon') $$;",
   "Supabase Auth"],
  ["auth.jwt()", "create or replace function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;",
   "Supabase Auth"],
  ["storage schema", "create schema if not exists storage;", "Supabase Storage owns it"],
  ["storage.buckets", "create table if not exists storage.buckets (\n  id text primary key,\n  name text not null,\n  owner uuid,\n  public boolean default false,\n  file_size_limit bigint,\n  allowed_mime_types text[],\n  avif_autodetection boolean default false,\n  created_at timestamptz default now(),\n  updated_at timestamptz default now()\n);",
   "Supabase Storage; the column list is the one its own schema declares"],
  ["storage.objects", "create table if not exists storage.objects (\n  id uuid primary key default gen_random_uuid(),\n  bucket_id text references storage.buckets(id),\n  name text,\n  owner uuid,\n  metadata jsonb,\n  created_at timestamptz default now(),\n  updated_at timestamptz default now()\n);",
   "Supabase Storage"],
  ["storage.foldername()", "create or replace function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;",
   "Supabase Storage; used by bucket policies to match a path prefix"]
];

const required = process.env.SONARA_MIGRATION_REPLAY_REQUIRED === "1";

function stop(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

// initdb, pg_ctl and psql, wherever this machine put them.
// Every path that reaches a shell command goes through here.
//
// CodeQL alert 234 on PR #258, "Shell command built from environment values":
// `os.tmpdir()` reads TMPDIR/TMP/TEMP, and the PostgreSQL binary directory comes
// from a directory listing, so both are environment-derived file names being
// interpolated into a string handed to `/bin/sh`. A TMPDIR containing a
// semicolon or a backtick would be executed.
//
// It is a developer tool run locally and in CI, so the exploit needs a hostile
// TMPDIR in an environment that already runs this repository's code -- which is
// why it is an alert rather than an incident. Quoting is a few lines and the
// argument for leaving it is only ever "nobody would", so it is quoted.
//
// POSIX single quotes: everything inside is literal, and the only character
// needing care is the single quote itself, closed and reopened around an escaped
// one. Double quotes would not do -- `$` and backticks are still expanded inside
// them, which is most of what this is defending against.
function sh(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function postgresBinaries() {
  const arguments_ = process.argv.slice(2);
  if (arguments_.length) {
    if (arguments_.length !== 2 || arguments_[0] !== "--postgres-bin") {
      stop("Usage: node scripts/verify-migration-replay.mjs [--postgres-bin ABSOLUTE_DIRECTORY]");
    }
    const selected = replayBinaries(arguments_[1]);
    if (!selected) stop("Requested PostgreSQL binary directory must be absolute and contain initdb, pg_ctl and psql. No alternate PostgreSQL version was selected.");
    return selected;
  }
  const candidates = [];
  const versioned = "/usr/lib/postgresql";
  if (fs.existsSync(versioned)) {
    for (const entry of fs.readdirSync(versioned).sort().reverse()) {
      candidates.push(path.join(versioned, entry, "bin"));
    }
  }
  candidates.push("/usr/local/pgsql/bin", "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin");

  for (const dir of candidates) {
    if (["initdb", "pg_ctl", "psql"].every((name) => fs.existsSync(path.join(dir, name)))) return dir;
  }
  // Last resort: whatever is on PATH.
  const found = spawnSync("sh", ["-c", "command -v initdb"], { encoding: "utf8" });
  if (found.status === 0 && found.stdout.trim()) return path.dirname(found.stdout.trim());
  return null;
}

// initdb refuses to run as root, which is how this container runs. When we are
// root, everything postgres-related is run as an unprivileged user instead.
function unprivilegedUser() {
  if (typeof process.getuid !== "function" || process.getuid() !== 0) return null;
  for (const name of ["postgres", "nobody"]) {
    const found = spawnSync("id", ["-u", name], { encoding: "utf8" });
    if (found.status === 0) return name;
  }
  return null;
}

function main() {
  const files = fs.existsSync(migrationsDir)
    ? fs.readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort()
    : [];

  if (files.length < MINIMUM_MIGRATIONS) {
    stop(`only ${files.length} migration(s) found in supabase/migrations. This check has gone blind; it is not reporting on the migration history.`);
  }

  const bin = postgresBinaries();
  if (!bin) {
    const notice = [
      "",
      "  MIGRATIONS WERE NOT REPLAYED IN THIS RUN.",
      "",
      "  No PostgreSQL binaries were found, so nothing was executed. Every other",
      "  database check in this chain reads the migration files as text; this is",
      "  the only one that runs them, and it did not run.",
      "",
      "  Install PostgreSQL (any version 14 or later) and run this again, or set",
      "  SONARA_MIGRATION_REPLAY_REQUIRED=1 to make this a failure rather than a",
      "  notice. CI sets it.",
      ""
    ].join("\n");
    if (required) stop(`SONARA_MIGRATION_REPLAY_REQUIRED=1 and no PostgreSQL binaries were found.${notice}`);
    console.log(notice);
    console.log(`Migration replay SKIPPED: ${files.length} migration files were read and none were executed.`);
    return;
  }

  const runAs = unprivilegedUser();
  const owner = replayOwner(runAs);
  if (typeof process.getuid === "function" && process.getuid() === 0 && !runAs) {
    stop("running as root and no unprivileged user is available to run initdb, which refuses to run as root.");
  }

  // Under /var/tmp rather than the repository: initdb needs a directory the
  // postgres user can read, and a data directory inside a checkout is a
  // directory somebody eventually commits.
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "sonara-replay-"));
  const socketDir = fs.mkdtempSync(path.join(os.tmpdir(), "sonara-sock-"));
  // A port on the loopback is never opened -- listen_addresses is empty and the
  // cluster is reachable only through the socket directory above.
  const port = 5000 + Math.floor(Math.random() * 20000);

  const shell = (command) => {
    const wrapped = runAs
      ? ["su", runAs, "-s", "/bin/sh", "-c", `PATH=${sh(bin)}:$PATH ${command}`]
      : ["/bin/sh", "-c", `PATH=${sh(bin)}:$PATH ${command}`];
    return spawnSync(wrapped[0], wrapped.slice(1), { encoding: "utf8" });
  };

  // Every statement goes through a file, never through `psql -c`.
  //
  // The command string is handed to a shell, and `$$` -- which opens every
  // dollar-quoted block in these migrations and in the shim -- is the shell's
  // own process id. Passing SQL inline silently rewrote `do $$` as `do 1721`
  // and the first shim entry failed with a syntax error about a number nobody
  // had written. A file keeps the shell out of the SQL entirely.
  let scratch = 0;
  const psql = (sql, { file = null, db = "replay" } = {}) => {
    let target = file;
    if (!target) {
      scratch += 1;
      target = path.join(socketDir, `stmt-${scratch}.sql`);
      fs.writeFileSync(target, sql);
      if (owner) execFileSync("chown", [owner, target]);
    }
    return shell(`psql -h ${sh(socketDir)} -p ${port} -U postgres -d ${sh(db)} -v ON_ERROR_STOP=1 -q -f ${sh(target)}`);
  };

  let started = false;
  const cleanUp = () => {
    if (started) shell(`pg_ctl -D ${sh(dataDir)} stop -m immediate`);
    for (const dir of [dataDir, socketDir]) fs.rmSync(dir, { recursive: true, force: true });
  };
  process.on("exit", cleanUp);

  try {
    if (runAs) {
      // On Debian/Ubuntu, nobody belongs to nogroup, not a group named nobody.
      // Resolve numeric IDs instead of assuming the user and group share a name.
      try {
        execFileSync("chown", ["-R", owner, dataDir, socketDir]);
      } catch (error) {
        stop(`Migration replay BLOCKED: cannot assign temporary cluster ownership to ${owner}. PostgreSQL has not started; no migration SQL was executed. Run required replay in a host or CI runner that supports an unprivileged PostgreSQL user.\n${error.message}`);
      }
      execFileSync("chmod", ["700", dataDir]);
    }

    const init = shell(`initdb -D ${sh(dataDir)} -U postgres --auth=trust`);
    if (init.status !== 0) stop(`initdb failed:\n${init.stderr || init.stdout}`);

    const start = shell(`pg_ctl -D ${sh(dataDir)} -o ${sh(`-k ${socketDir} -p ${port} -c listen_addresses=''`)} -l ${sh(`${dataDir}/startup.log`)} -w start`);
    if (start.status !== 0) {
      const log = fs.existsSync(`${dataDir}/startup.log`) ? fs.readFileSync(`${dataDir}/startup.log`, "utf8") : "";
      stop(`the throwaway cluster would not start:\n${start.stderr || start.stdout}\n${log}`);
    }
    started = true;

    const create = psql("create database replay;", { db: "postgres" });
    if (create.status !== 0) stop(`could not create the replay database:\n${create.stderr}`);

    for (const [name, sql] of SHIM) {
      const applied = psql(sql);
      if (applied.status !== 0) {
        // A shim that will not apply is this check's own bug, and saying so is
        // the difference between fixing the shim and blaming a migration.
        stop(`the Supabase shim "${name}" would not apply, so nothing was replayed:\n${applied.stderr}`);
      }
    }

    let statements = 0;
    for (const name of files) {
      const applied = psql(null, { file: path.join(migrationsDir, name) });
      if (applied.status !== 0) {
        const detail = (applied.stderr || applied.stdout || "").trim().split("\n").slice(0, 12).join("\n");
        console.error(`ERROR: ${name} does not apply to an empty database.\n`);
        console.error(detail);
        console.error(
          "\nThis is what a fresh replay sees -- a new Supabase preview branch, a restored\n" +
          "backup, or a second environment. A database that migrated forward in real time\n" +
          "never re-runs an old migration, so production can be healthy while this is broken."
        );
        process.exit(1);
      }
      statements += 1;
    }

    // Run SQL against the replayed database and require every expected marker
    // in its output. Each marker carries the value it is asserting -- so a
    // failure says `stale_kept_canceled` rather than "expected true, got
    // false", and names which of the three cases went wrong.
    function behaves(run, what, sql, expected) {
      const result = run(sql);
      if (result.status !== 0) {
        // The P1 probe emits expected policy names and differing attributes
        // on stdout, then raises on stderr. Logging stderr alone hid which
        // policy check failed. Other probes may include private test payloads:
        // do not print their stdout.
        const p1 = what === "P1 RLS initplan and policy-overlap guarded rollback proof";
        const differences = p1
          ? String(result.stdout || "").split(/\r?\n/)
            .filter((line) => line.includes("|") && line.length <= 320)
            .slice(0, 30).join("\n")
          : "";
        stop(`the behaviour probe "${what}" would not run against the replayed database:\n`
          + (differences ? `Policy attribute differences (staging only):\n${differences}\n` : "")
          + String(result.stderr || "SQL replay command failed without stderr."));
      }
      const output = String(result.stdout || "");
      const absent = expected.filter((marker) => !output.includes(marker));
      if (absent.length) {
        stop(
          `the schema applied but does not behave: ${what}. Expected ${absent.join(", ")} and did not get it.\n` +
          `What the database actually said:\n${output.trim()}`
        );
      }
    }

    // Security-critical: run real allow/deny SQL on this disposable cluster.
    // Tests use synthetic auth users, two tenants and rolled-back temporary
    // grants; they never execute in a customer Supabase project.
    behaves(psql, "P0 synthetic two-tenant and role-based RLS write/deny matrix",
      fs.readFileSync(path.join(root, "tests/sql/p0-auth-rls-role-matrix.sql"), "utf8"),
      ["p0_auth_rls_matrix_staging_passed"]);

    // P1 dry-run only: rewrite the remaining 25 scalar auth policies and
    // remove one rigorously identical subscriptions policy in a single
    // rolled-back transaction. No production DDL is performed by replay.
    behaves(psql, "P1 RLS initplan and policy-overlap guarded rollback proof",
      fs.readFileSync(path.join(root, "tests/sql/p1-rls-initplan-policy-dedup-rollback.sql"), "utf8"),
      ["p1_rls_hygiene_staging_passed"]);

    behaves(psql, "included generation reserves, settles and isolates tenants",
      fs.readFileSync(path.join(root, "tests/sql/included-generation.sql"), "utf8"),
      ["generation_reserves_settles_and_isolates"]);

    behaves(psql, "merchant fulfillment snapshots, retries and rolls back atomically",
      fs.readFileSync(path.join(root, "tests/sql/merchant-order-fulfillment.sql"), "utf8"),
      ["merchant_fulfillment_snapshots_consumes_retries_and_rolls_back"]);

    behaves(psql, "merchant fulfillment concurrency fixture",
      fs.readFileSync(path.join(root, "tests/sql/merchant-fulfillment-concurrency.sql"), "utf8"),
      ["merchant_fulfillment_concurrency_ready"]);
    // Each race uses two independent PostgreSQL connections, not two calls on
    // one client. First retry the same order; then compete for insufficient stock.
    for (const [race, orders] of [["duplicate", [30, 30]], ["scarce", [31, 32]]]) {
      const commands = orders.map((order, index) => {
        const file = path.join(socketDir, `fulfillment-${race}-${index}.sql`);
        fs.writeFileSync(file, `begin; set local role service_role;
          do $$ begin
            begin
              perform public.transition_merchant_order('21000000-0000-4000-8000-000000000002',
                '21000000-0000-4000-8000-0000000000${order}', '21000000-0000-4000-8000-000000000001', 'fulfilled', '', false);
            exception when raise_exception then
              if '${race}' <> 'scarce' or sqlerrm <> 'stock_insufficient' then raise; end if;
            end;
            perform pg_sleep(0.2);
          end $$; commit;`);
        if (owner) execFileSync("chown", [owner, file]);
        return `psql -h ${sh(socketDir)} -p ${port} -U postgres -d replay -v ON_ERROR_STOP=1 -q -f ${sh(file)}`;
      });
      const raced = shell(`${commands[0]} & first=$!; ${commands[1]} & second=$!; wait "$first"; left=$?; wait "$second"; right=$?; test "$left" -eq 0 && test "$right" -eq 0`);
      if (raced.status !== 0) stop(`Merchant fulfillment ${race} race failed: ${raced.stderr || raced.stdout}`);
    }
    behaves(psql, "concurrent merchant fulfillment consumes exactly once and cannot oversell", `
      select 'fulfillment_concurrent_receipts_' || count(*) from public.merchant_order_fulfillments
        where organization_id = '21000000-0000-4000-8000-000000000002';
      select 'fulfillment_concurrent_stock_' || count(*) from public.inventory_items
        where organization_id = '21000000-0000-4000-8000-000000000002' and quantity = 1;
      select 'fulfillment_concurrent_pending_' || count(*) from public.merchant_orders
        where organization_id = '21000000-0000-4000-8000-000000000002' and status = 'confirmed';
      `, ["fulfillment_concurrent_receipts_2", "fulfillment_concurrent_stock_2", "fulfillment_concurrent_pending_1"]);

    // Two independent PostgreSQL sessions must not reserve the same pool.
    const concurrentOrg = "10000000-0000-4000-8000-000000000006";
    behaves(psql, "concurrent generation fixture", `
      insert into public.organizations(id, name) values ('${concurrentOrg}', 'Concurrency probe');
      insert into public.billing_subscriptions(organization_id, provider, provider_subscription_ref, plan_slug, status, current_period_end, metadata)
      values ('${concurrentOrg}', 'stripe', 'sub_generation_concurrency', 'all_three_monthly', 'active', now() + interval '10 days',
        jsonb_build_object('source', 'stripe_webhook', 'current_period_start', now() - interval '20 days'));
      select 'generation_concurrency_ready';`, ["generation_concurrency_ready"]);
    const concurrencyCommands = ["7", "8"].map((digit) => {
      const file = path.join(socketDir, `generation-session-${digit}.sql`);
      fs.writeFileSync(file, `begin; select public.generation_usage('${concurrentOrg}', 'reserve', '10000000-0000-4000-8000-00000000000${digit}', 300); select pg_sleep(0.2); commit;`);
      if (owner) execFileSync("chown", [owner, file]);
      return `psql -h ${sh(socketDir)} -p ${port} -U postgres -d replay -v ON_ERROR_STOP=1 -q -f ${sh(file)}`;
    });
    const concurrent = shell(`${concurrencyCommands[0]} & ${concurrencyCommands[1]} & wait`);
    if (concurrent.status !== 0 || !(concurrent.stdout || "").includes("included_generation_exhausted")) {
      stop(`Concurrent generation reservations failed: ${concurrent.stderr || concurrent.stdout}`);
    }
    behaves(psql, "concurrent generation cannot overspend", `
      select 'generation_concurrent_holds_' || count(*) from public.generation_usage_reservations where organization_id = '${concurrentOrg}';
      delete from public.organizations where id = '${concurrentOrg}';`, ["generation_concurrent_holds_1"]);

    // Stock held by orders and moved by jobs (20261006040000), together with
    // fulfilment's own consumption (20261006035501): holds, shortages, retries,
    // a fulfilled order consuming its hold once, a cancelled one releasing it,
    // job use and return, tenancy.
    behaves(psql, "stock holds, ships, releases and isolates tenants",
      fs.readFileSync(path.join(root, "tests/sql/inventory-stock.sql"), "utf8"),
      ["stock_holds_ships_releases_and_isolates"]);

    // The case the stock functions exist for: two buyers, one mug left, two real
    // sessions at the same moment. Exactly one may hold it.
    const stockOrg = "20000000-0000-4000-8000-000000000009";
    behaves(psql, "last-item race fixture", `
      insert into public.organizations(id, name) values ('${stockOrg}', 'Last mug');
      insert into public.inventory_items(id, organization_id, name, quantity, status) values ('20000000-0000-4000-8000-000000000091', '${stockOrg}', 'Mug', 1, 'active');
      insert into public.merchant_products(id, organization_id, name, status) values ('20000000-0000-4000-8000-000000000092', '${stockOrg}', 'Mug', 'active');
      insert into public.merchant_product_variants(id, organization_id, product_id, variant_name, price_cents, currency, inventory_item_id, status)
        values ('20000000-0000-4000-8000-000000000093', '${stockOrg}', '20000000-0000-4000-8000-000000000092', 'One', 1200, 'usd', '20000000-0000-4000-8000-000000000091', 'active');
      insert into public.merchant_orders(id, organization_id, buyer_name, buyer_email, subtotal_cents, currency) values
        ('20000000-0000-4000-8000-000000000094', '${stockOrg}', 'First', 'first@example.com', 1200, 'usd'),
        ('20000000-0000-4000-8000-000000000095', '${stockOrg}', 'Second', 'second@example.com', 1200, 'usd');
      insert into public.merchant_order_lines(organization_id, order_id, variant_id, description, quantity, unit_price_cents, line_total_cents, currency) values
        ('${stockOrg}', '20000000-0000-4000-8000-000000000094', '20000000-0000-4000-8000-000000000093', 'Mug', 1, 1200, 1200, 'usd'),
        ('${stockOrg}', '20000000-0000-4000-8000-000000000095', '20000000-0000-4000-8000-000000000093', 'Mug', 1, 1200, 1200, 'usd');
      select 'stock_race_ready';`, ["stock_race_ready"]);
    const stockCommands = ["4", "5"].map((digit) => {
      const file = path.join(socketDir, `stock-session-${digit}.sql`);
      fs.writeFileSync(file, `begin; select public.inventory_order_hold('${stockOrg}', '20000000-0000-4000-8000-00000000009${digit}'); select pg_sleep(0.2); commit;`);
      if (owner) execFileSync("chown", [owner, file]);
      return `psql -h ${sh(socketDir)} -p ${port} -U postgres -d replay -v ON_ERROR_STOP=1 -q -f ${sh(file)}`;
    });
    const raced = shell(`${stockCommands[0]} & ${stockCommands[1]} & wait`);
    if (raced.status !== 0 || !(raced.stdout || "").includes("insufficient_stock") || !(raced.stdout || "").includes("\"reserved\"")) {
      stop(`Two buyers racing for the last item did not resolve to exactly one hold and one refusal: ${raced.stderr || raced.stdout}`);
    }
    behaves(psql, "the last item is held once", `
      select 'stock_race_holds_' || count(*) from public.inventory_reservations where organization_id = '${stockOrg}' and state = 'held';
      delete from public.organizations where id = '${stockOrg}';`, ["stock_race_holds_1"]);

    // Proof the replay built something, rather than passing on a cluster where
    // every statement quietly did nothing.
    const missing = [];
    for (const table of MUST_EXIST) {
      const found = psql(`select 1 from information_schema.tables where table_schema = 'public' and table_name = '${table}' limit 1;`);
      if (found.status !== 0 || !/1/.test(found.stdout || "")) missing.push(table);
    }
    if (missing.length) {
      stop(`the replay reported no errors and did not create ${missing.join(", ")}. It is not replaying what it claims to.`);
    }

    // A schema that applies is not a schema that behaves.
    //
    // 20260903120000 adds a trigger whose whole job is to DISCARD a write --
    // a Stripe event carrying an older stamp than the row already holds. That
    // is invisible to everything else here: the column exists, the trigger
    // exists, the migration applies, and the guard could still be inverted or
    // never fire. Every other check in this repository would stay green while a
    // late `customer.subscription.updated` silently reinstated a cancelled
    // subscription.
    //
    // The database is already running at this point, so proving it costs one
    // statement. This is the only place in the release chain that can.
    behaves(psql, "a stale provider event is discarded and a newer one is not", `
      insert into public.billing_subscriptions (provider, provider_subscription_ref, status, provider_event_at)
        values ('stripe', 'sub_replay_probe', 'active', '2026-01-02T00:00:00Z');

      -- older stamp: must be discarded, status stays active
      update public.billing_subscriptions
        set status = 'canceled', provider_event_at = '2026-01-01T00:00:00Z'
        where provider_subscription_ref = 'sub_replay_probe';
      select 'stale_kept_' || status from public.billing_subscriptions where provider_subscription_ref = 'sub_replay_probe';

      -- newer stamp: must apply
      update public.billing_subscriptions
        set status = 'canceled', provider_event_at = '2026-01-03T00:00:00Z'
        where provider_subscription_ref = 'sub_replay_probe';
      select 'fresh_gave_' || status from public.billing_subscriptions where provider_subscription_ref = 'sub_replay_probe';

      -- no stamp on the incoming write: must apply, never silently do nothing
      update public.billing_subscriptions
        set status = 'past_due', provider_event_at = null
        where provider_subscription_ref = 'sub_replay_probe';
      select 'unstamped_gave_' || status from public.billing_subscriptions where provider_subscription_ref = 'sub_replay_probe';
    `, ["stale_kept_active", "fresh_gave_canceled", "unstamped_gave_past_due"]);

    // The shape repair, proved against the case it exists for.
    //
    // Replaying against an empty database makes every statement in
    // 20260812000000 a no-op, because the migration one version earlier creates
    // each table whole. So a clean replay says that file parses and nothing
    // more -- and "it parses" was exactly what was true of the table repair
    // that did not fix production.
    //
    // Production's shape is: the table is there, the column is not. That is
    // reproduced here by dropping the column deployment #125 actually died on,
    // re-running the migration, and asking whether it came back. Re-running it
    // against a database it has already been applied to also proves it is
    // idempotent, which is what makes it safe to slot in with --include-all.
    // `cascade` because the member-read policy is defined on this column, and
    // dropping both is what makes this production's shape rather than an
    // artificial one: production has neither the column nor that policy.
    const degraded = psql("alter table public.customers drop column organization_id cascade;");
    if (degraded.status !== 0) {
      stop(
        "could not drop public.customers.organization_id to reproduce production's shape, so the shape-repair probe " +
        `below would prove nothing:\n${degraded.stderr || degraded.stdout}`
      );
    }
    behaves(psql, "the degraded database really is missing the column", `
      select 'degraded_column_count_' || count(*)::text
        from information_schema.columns
        where table_schema = 'public' and table_name = 'customers' and column_name = 'organization_id';
    `, ["degraded_column_count_0"]);

    // What a skip costs, measured. This is the argument for the shape repair.
    //
    // `scripts/generate-member-read-policies.cjs` gained a column-existence
    // guard on 5 September 2026: a table whose tenant column is missing is
    // skipped with a notice instead of failing the migration. That is the right
    // call -- a migration that stops halfway through applying a security
    // posture is worse than one that declines to start.
    //
    // But "the deployment no longer fails" and "the tables are readable" are
    // different claims, and only the first is obvious. Measured here rather
    // than reasoned about, in the degraded state the probe has already set up
    // (`customers` present, `organization_id` gone -- production's shape):
    //
    //     rls=true  total_policies=1  member_policy=0
    //     policy_names=service role can manage customers
    //
    // Row level security was **already enabled** on this table by an earlier
    // migration, and the only policy on it is the service-role one. So a
    // skipped table is not left untouched: it is left with RLS on and nothing
    // an organization member can read through. The guard prevents a failed
    // deployment. It does not prevent members being locked out, because they
    // already are.
    //
    // That is what the shape repair one version earlier is for, and it is why
    // the two changes compose rather than compete: the repair puts the column
    // back so this migration finds it and writes the policy, and the guard
    // catches anything the repair did not anticipate without taking production
    // down for it.
    //
    // **This probe asserts the lock-out.** A future change that makes a skip
    // look harmless -- or a repair that quietly stops running -- turns this red,
    // and the message says a green deployment would ship a table members
    // cannot read.
    const skipped = psql(null, { file: path.join(migrationsDir, BLOCKED_BY_SHAPE) });
    if (skipped.status !== 0) {
      stop(
        `${BLOCKED_BY_SHAPE} failed against a table missing its tenant column. The column-existence guard in ` +
        "scripts/generate-member-read-policies.cjs exists so this skips rather than stops, so either the guard is " +
        `not firing or it fires too late:\n${skipped.stderr || skipped.stdout}`
      );
    }

    // Named per-value rather than collapsed into one verdict word. The first
    // version of this asked whether the table had *any* policy and got
    // "access_unchanged" every time, because the service-role policy is always
    // there -- a check too weak to catch the case it was written for, which is
    // shape 6 in `.claude/skills/checks-that-cannot-lie`. Reporting the three
    // numbers means a wrong answer is visible instead of averaged away.
    behaves(psql, "a skipped table is left with RLS on and no member policy", `
      select 'skipped_rls_' || c.relrowsecurity::text
        from pg_class c where c.oid = 'public.customers'::regclass;

      select 'skipped_member_policy_' || count(*)::text
        from pg_policies
        where schemaname = 'public' and tablename = 'customers'
          and policyname = 'customers_select_member';

      select 'skipped_service_policy_' || count(*)::text
        from pg_policies
        where schemaname = 'public' and tablename = 'customers'
          and policyname = 'service role can manage customers';
    `, ["skipped_rls_true", "skipped_member_policy_0", "skipped_service_policy_1"]);

    const reapplied = psql(null, { file: path.join(migrationsDir, SHAPE_REPAIR) });
    if (reapplied.status !== 0) {
      stop(`${SHAPE_REPAIR} would not re-apply to a database it has already run against:\n${reapplied.stderr}`);
    }
    behaves(psql, "a column missing from a table that already exists is added back", `
      select 'customers_organization_id_' || count(*)::text
        from information_schema.columns
        where table_schema = 'public' and table_name = 'customers' and column_name = 'organization_id';
    `, ["customers_organization_id_1"]);

    // And then the thing that actually matters: the migration that killed
    // deployment #125 has to run. Asserting the column exists says the repair
    // did something; running the statement that failed says it did the right
    // thing. Without this the probe above could pass while the deploy still
    // died one line later.
    const unblocked = psql(null, { file: path.join(migrationsDir, BLOCKED_BY_SHAPE) });
    if (unblocked.status !== 0) {
      stop(
        `${BLOCKED_BY_SHAPE} still does not apply after the shape repair. This is the migration production died on, ` +
        `so the repair has not unblocked the deployment:\n${unblocked.stderr || unblocked.stdout}`
      );
    }
    // Every table the generator declares, not just the one that broke.
    //
    // The probe below checks `customers`, because that is the table deployment
    // #125 died on. That is one of **54** organization-scoped tables, and a
    // repair that fixed the one in the error message while leaving the other 53
    // skipped would pass it -- which is the same shape as the table repair that
    // created the absent tables and did nothing for the present ones.
    //
    // The list is read from `scripts/generate-member-read-policies.cjs` at run
    // time rather than copied, so a table added there is covered here without
    // anybody remembering to.
    //
    // Two failure modes, told apart on purpose:
    //   absent      the table does not exist at all, so `to_regclass` skipped it
    //   no policy   the table is there and the member policy is not
    // The second is the silent one -- RLS is already on from an earlier
    // migration, so a table in that state is readable by nobody but the service
    // role while the deployment reports success.
    //
    // Measured on 5 September 2026: all 54 present, all 54 policied, none
    // absent. That includes `shared_links`, whose own migration runs *after*
    // this one -- so the ordering resolves rather than leaving it unpolicied,
    // which is worth having pinned because it is not obvious from reading the
    // migrations in order.
    //
    // One more measured fact, because it changes how this migration should be
    // read: **51 of the 54 are also policied by an earlier migration.** Six
    // files create `*_select_member` policies, and only three tables --
    // `shared_links`, `service_comments`, `research_sources` -- depend on this
    // one alone. So a falsification that removes a table from the generator
    // proves nothing unless it picks one of those three: drop `bookings` and
    // the end state stays correct, because 20260729233000 already created it.
    // That was tried first and correctly did not fail.
    const declared = (() => {
      const source = fs.readFileSync(path.join(root, "scripts", "generate-member-read-policies.cjs"), "utf8");
      const list = /const ORGANIZATION_READ_TABLES = \[([\s\S]*?)\];/.exec(source);
      if (!list) stop("could not read ORGANIZATION_READ_TABLES out of the member-policy generator");
      const tables = list[1].split("\n").map((line) => (/"([a-z_0-9]+)"/.exec(line) || [])[1]).filter(Boolean);
      if (tables.length < 40) {
        stop(`only ${tables.length} organization-scoped tables parsed out of the generator; this probe has gone blind`);
      }
      return tables;
    })();

    const asArray = `array[${declared.map((table) => `'${table}'`).join(",")}]`;
    behaves(psql, "every organization-scoped table the generator declares ends with its member policy", `
      select 'declared_${declared.length}';

      select 'policied_' || count(*)::text from (
        select t from unnest(${asArray}) t
        where exists (
          select 1 from pg_policies p
          where p.schemaname = 'public' and p.tablename = t and p.policyname = t || '_select_member')) q;

      select 'absent_' || coalesce(string_agg(t, ',' order by t), 'none') from (
        select t from unnest(${asArray}) t where to_regclass('public.' || t) is null) q;

      select 'unpolicied_' || coalesce(string_agg(t, ',' order by t), 'none') from (
        select t from unnest(${asArray}) t
        where to_regclass('public.' || t) is not null
          and not exists (
            select 1 from pg_policies p
            where p.schemaname = 'public' and p.tablename = t and p.policyname = t || '_select_member')) q;
    `, [`declared_${declared.length}`, `policied_${declared.length}`, "absent_none", "unpolicied_none"]);

    // Which tables end up readable by nobody but the service role.
    //
    // Row level security with **no policy at all** closes a table to every
    // authenticated user. For this application that is often correct rather
    // than broken: the server reads Supabase with the service-role key, which
    // bypasses RLS, so a server-only table wants exactly this posture -- it is
    // what stops a leaked anon key reading `user_recovery_codes`.
    //
    // What is not correct is not knowing which tables are in that set.
    // `docs/SHIP_READINESS.md` said **thirteen** and claimed "the deep
    // verification reports it every run". Measured here on 5 September 2026:
    // **twenty-five**, out of 307 tables with RLS enabled. The set had reached
    // twenty-seven before the durable event migration added four deliberately
    // server-only operational tables, bringing the replay to **thirty-one out
    // of 311**. **Thirty-two** since 1 October 2026:
    // `business_management_credentials` holds the business owner's management
    // passcode and is server-only for the same reason `user_recovery_codes` is:
    // the stored hash is useless without a pepper only the server holds, and
    // there is no read of that table a customer's own token should ever make.
    // And the deep
    // server-only operational tables, bringing the replay to thirty-one out of
    // 311 -- and **thirty-two** once business_recurring_tasks took the same
    // server-only posture recurring_invoices has. And the deep
    // verification is `scripts/verify-production-supabase.mjs`, which needs the
    // service-role key and runs only inside Controlled Production Deployment --
    // a workflow that has not succeeded since 5 August. So it had reported
    // nothing for a month, and the number nobody derived had nearly doubled.
    //
    // Pinned as an exact set rather than a count, and two-sided on purpose. A
    // table joining this list is a table that just became unreadable by every
    // customer; a table leaving it is one that just became readable. Both are
    // decisions somebody should make deliberately, and both turn this red with
    // the name in the message.
    //
    // This is the intended end state of the migrations, not production's. The
    // replay runs against an empty database.
    behaves(psql, "the set of tables closed to everyone but the service role is the set we decided on", `
      select 'closed_count_' || count(*)::text from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
          and not exists (
            select 1 from pg_policies p
            where p.schemaname = 'public' and p.tablename = c.relname);

      select 'closed_set_' || coalesce(string_agg(c.relname, ',' order by c.relname), 'none')
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
          and not exists (
            select 1 from pg_policies p
            where p.schemaname = 'public' and p.tablename = c.relname);
    `, ["closed_count_58", "closed_set_agent_evaluation_runs,agent_tool_permissions,audit_log,business_management_credentials,business_payment_accounts,business_recurring_tasks,call_sessions,call_signals,consent_records,creator_asset_approvals,creator_asset_versions,creator_briefs,creator_licence_grants,creator_listings,creator_marketplace_entries,creator_marketplace_orders,creator_marketplace_payment_events,creator_version_files,db_health_snapshots,event_delivery_attempts,event_outbox,generation_usage_reservations,growth_campaign_sends,growth_campaign_spend,growth_channel_directory,growth_channel_posts,growth_channels,growth_email_delivery_events,growth_event_rsvps,growth_events,growth_post_reports,growth_venues,inventory_reservations,lead_capture_pages,lead_conversations,lead_icp_profiles,lead_routing_rules,leads,legal_acceptances,llm_observations,merchant_order_lines,merchant_order_payment_events,merchant_orders,merchant_storefronts,notification_preferences,pending_auth_challenges,platform_jobs,public_booking_pages,push_subscriptions,record_change_log,recurring_invoice_lines,recurring_invoices,scroll_sites,sonara_auth_rate_limits,sonara_control_plane_checks,usage_credit_ledger,user_auth_factors,user_recovery_codes"]);

    behaves(psql, "the policy that could not be created now exists", `
      select 'customers_policy_' || count(*)::text
        from pg_policies
        where schemaname = 'public' and tablename = 'customers' and policyname = 'customers_select_member';
    `, ["customers_policy_1"]);

    console.log(`Shim applied (Supabase primitives only, nothing in public): ${SHIM.map(([name]) => name).join(", ")}.`);
    // What this sentence must not be read as, and the reason is not hypothetical.
    //
    // The failure message above says production can be healthy while this is
    // broken. **The converse is also true and was live for a month.** From
    // 5 August to 3 September 2026 every Controlled Production Deployment
    // failed -- fourteen consecutive runs, #111 to #124 -- on
    //
    //     Applying migration 20260811220000_customer_invoices_accounts_receivable.sql...
    //     ERROR: relation "public.quotes" does not exist (SQLSTATE 42P01)
    //
    // while this check was green on every one of them. It is green because
    // `public.quotes` is created by 010_sonara_platform_current_schema.sql,
    // which a replay onto an empty database runs. Production's migration
    // history says that file is already applied; the table is not there. A
    // replay cannot see that, because it never reads production's history --
    // that is the whole point of replaying onto an empty cluster, and it is
    // also the shape of what it cannot tell you.
    //
    // So: this proves the migration set is self-consistent. It proves nothing
    // about whether production's schema matches it.
    console.log(
      `Migration replay verified: ${statements} migrations applied in order to an empty PostgreSQL, ` +
      `${MUST_EXIST.length} expected tables present. This is the only check here that executes the SQL -- ` +
      `against an empty database, so it says the migrations agree with each other and nothing about ` +
      `whether production's schema agrees with them.`
    );
  } finally {
    cleanUp();
    process.removeAllListeners("exit");
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

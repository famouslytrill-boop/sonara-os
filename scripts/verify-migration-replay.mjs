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
function postgresBinaries() {
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
      ? ["su", runAs, "-s", "/bin/sh", "-c", `PATH=${bin}:$PATH ${command}`]
      : ["/bin/sh", "-c", `PATH=${bin}:$PATH ${command}`];
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
      if (runAs) execFileSync("chown", [`${runAs}:${runAs}`, target]);
    }
    return shell(`psql -h ${socketDir} -p ${port} -U postgres -d ${db} -v ON_ERROR_STOP=1 -q -f ${JSON.stringify(target)}`);
  };

  let started = false;
  const cleanUp = () => {
    if (started) shell(`pg_ctl -D ${dataDir} stop -m immediate`);
    for (const dir of [dataDir, socketDir]) fs.rmSync(dir, { recursive: true, force: true });
  };
  process.on("exit", cleanUp);

  try {
    if (runAs) {
      execFileSync("chown", ["-R", `${runAs}:${runAs}`, dataDir, socketDir]);
      execFileSync("chmod", ["700", dataDir]);
    }

    const init = shell(`initdb -D ${dataDir} -U postgres --auth=trust`);
    if (init.status !== 0) stop(`initdb failed:\n${init.stderr || init.stdout}`);

    const start = shell(`pg_ctl -D ${dataDir} -o "-k ${socketDir} -p ${port} -c listen_addresses=''" -l ${dataDir}/startup.log -w start`);
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
        stop(`the behaviour probe "${what}" would not run against the replayed database:\n${result.stderr || result.stdout}`);
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

main();

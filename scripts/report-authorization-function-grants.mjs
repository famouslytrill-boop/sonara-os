#!/usr/bin/env node
// Does revoking EXECUTE from `authenticated` break the policies that call it?
//
// `docs/SHIP_READINESS.md` records twelve SECURITY DEFINER authorization
// functions reachable by the `authenticated` role over `/rest/v1/rpc/`, and
// says the advisor's remediation -- revoking EXECUTE -- was deliberately not
// applied because it "could silently break every RLS policy that calls them",
// and that "verifying that needs a database somebody can break -- a preview
// branch -- not a guess."
//
// That was true when it was written. `scripts/verify-migration-replay.mjs`
// arrived since and builds exactly such a database on every release: a
// throwaway PostgreSQL cluster with the Supabase primitives shimmed and all
// the migrations applied. This runs the experiment on one.
//
// ## Not part of the release chain, deliberately
//
// It answers a question rather than guarding an invariant, it takes about forty
// seconds, and the answer does not change when the code does. Run it on demand:
// `pnpm run report:authorization-grants`. It is checked in so the finding in
// `docs/architecture/2026-09-15-REVOKING-AN-AUTHORIZATION-FUNCTION.md` can be
// re-run rather than believed.
//
// ## What it measures, and what it cannot
//
// The migration history replayed to an empty database. **Not production.** This
// repository already knows the two differ: four of the twelve functions exist
// in the live database and in no migration -- they are recorded as commented-out
// text in 20260819050000 -- and `product_modules` is a live table no migration
// creates. So a policy or a grant that exists only in production is invisible
// here, and "no policy calls this" means no policy in this repository.
//
// The shim is reused from the verifier by evaluating its own declaration rather
// than re-parsing it. A second copy of the shim would be a different database
// from the one the release chain replays, which is the whole failure mode this
// experiment exists to avoid.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const root = "/home/user/sonara-os";
const migrationsDir = path.join(root, "supabase", "migrations");
const replay = fs.readFileSync(path.join(root, "scripts", "verify-migration-replay.mjs"), "utf8");

// The shim, taken from the verifier rather than rewritten: a second copy would
// be a different database from the one the release chain replays.
const shimBlock = replay.match(/const SHIM = (\[[\s\S]*?\n\]);/);
if (!shimBlock) { console.error("could not read SHIM from the verifier"); process.exit(1); }
// Evaluated rather than re-parsed. The entries use string concatenation and a
// third element for the justification, and a regex that got either wrong would
// silently build a DIFFERENT database from the one the release chain replays --
// which is the failure this whole experiment is about.
const SHIM = eval(shimBlock[1]).map((entry) => [entry[0], entry[1]]);
if (SHIM.length < 5) { console.error(`only ${SHIM.length} shim entries parsed; refusing to run a different database`); process.exit(1); }
console.log(`shim entries reused from the verifier: ${SHIM.length}`);

const bin = fs.readdirSync("/usr/lib/postgresql").sort().reverse().map((v) => `/usr/lib/postgresql/${v}/bin`)
  .find((d) => ["initdb", "pg_ctl", "psql"].every((n) => fs.existsSync(path.join(d, n))));
const runAs = process.getuid() === 0 ? "postgres" : null;

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "grant-exp-"));
const socketDir = fs.mkdtempSync(path.join(os.tmpdir(), "grant-sock-"));
const port = 5000 + Math.floor(Math.random() * 20000);

const shell = (command) => {
  const wrapped = runAs ? ["su", runAs, "-s", "/bin/sh", "-c", `PATH=${bin}:$PATH ${command}`]
                        : ["/bin/sh", "-c", `PATH=${bin}:$PATH ${command}`];
  return spawnSync(wrapped[0], wrapped.slice(1), { encoding: "utf8" });
};

let scratch = 0;
// Through a file, never `psql -c`: the shell reads `$$` as its own pid.
const psql = (sql, { file = null, db = "replay" } = {}) => {
  let target = file;
  if (!target) {
    scratch += 1;
    target = path.join(socketDir, `stmt-${scratch}.sql`);
    fs.writeFileSync(target, sql);
    if (runAs) execFileSync("chown", [`${runAs}:${runAs}`, target]);
  }
  return shell(`psql -h ${socketDir} -p ${port} -U postgres -d ${db} -v ON_ERROR_STOP=1 -f ${JSON.stringify(target)}`);
};

let started = false;
process.on("exit", () => {
  if (started) shell(`pg_ctl -D ${dataDir} stop -m immediate`);
  for (const d of [dataDir, socketDir]) fs.rmSync(d, { recursive: true, force: true });
});

if (runAs) {
  execFileSync("chown", ["-R", `${runAs}:${runAs}`, dataDir, socketDir]);
  execFileSync("chmod", ["700", dataDir]);
}
let r = shell(`initdb -D ${dataDir} -U postgres --auth=trust`);
if (r.status !== 0) { console.error(r.stderr || r.stdout); process.exit(1); }
r = shell(`pg_ctl -D ${dataDir} -o "-k ${socketDir} -p ${port} -c listen_addresses=''" -l ${dataDir}/startup.log -w start`);
if (r.status !== 0) { console.error(r.stderr, fs.readFileSync(`${dataDir}/startup.log`, "utf8")); process.exit(1); }
started = true;

r = psql("create database replay;", { db: "postgres" });
if (r.status !== 0) { console.error(r.stderr); process.exit(1); }
for (const [name, sql] of SHIM) {
  r = psql(sql);
  if (r.status !== 0) { console.error(`shim ${name} failed:\n${r.stderr}`); process.exit(1); }
}
const files = fs.readdirSync(migrationsDir).filter((n) => n.endsWith(".sql")).sort();
for (const name of files) {
  r = psql(null, { file: path.join(migrationsDir, name) });
  if (r.status !== 0) { console.error(`migration ${name} failed:\n${r.stderr}`); process.exit(1); }
}
console.log(`migrations applied: ${files.length}`);

// --- the experiment -------------------------------------------------------
//
// The table has to be one `authenticated` can actually reach. The hardening
// migration 20260718064853 revoked the Data API defaults and re-granted
// seventeen tables by name; a read of any other table refuses at the table
// grant, before RLS is consulted at all. The first run of this experiment used
// public.organizations, got "permission denied for table organizations" on the
// baseline, and was measuring the grant rather than the policy.
const probe = (table, label) => {
  const out = psql(`set role authenticated;\nselect count(*) from public.${table};`);
  const ok = out.status === 0;
  const why = (out.stderr || "").split("\n").find((l) => l.includes("ERROR")) || "";
  console.log(`  ${label.padEnd(56)} ${ok ? "READS  " : "REFUSED"}  ${why.replace(/^.*ERROR:\s*/, "").trim().slice(0, 74)}`);
  return ok;
};

const results = {};
for (const [table, fn, signature] of [
  ["activity_events", "is_org_member", "uuid"],
  ["intake_requests", "is_org_member", "uuid"]
]) {
  console.log(`\npublic.${table} -- granted to authenticated, policy calls ${fn}()`);
  const before = probe(table, "baseline");
  psql(`revoke execute on function public.${fn}(${signature}) from authenticated;`);
  const during = probe(table, `after revoking ${fn} from authenticated`);
  psql(`grant execute on function public.${fn}(${signature}) to authenticated;`);
  const after = probe(table, "after granting it back");
  results[table] = { before, during, after };
}

console.log("\npublic.intake_requests -- revoking a function NO policy calls");
const uncalledBefore = probe("intake_requests", "baseline");
psql("revoke execute on function public.sonara_has_org_role(uuid, text[]) from authenticated;");
const uncalledDuring = probe("intake_requests", "after revoking sonara_has_org_role");
psql("grant execute on function public.sonara_has_org_role(uuid, text[]) to authenticated;");

console.log("\nRESULT");
for (const [table, r] of Object.entries(results)) {
  console.log(`  ${table}: baseline ${r.before ? "reads" : "refused"}, revoked ${r.during ? "reads" : "REFUSED"}, restored ${r.after ? "reads" : "refused"}`);
}
console.log(`  revoking an uncalled function: baseline ${uncalledBefore ? "reads" : "refused"}, after ${uncalledDuring ? "reads" : "REFUSED"}`);

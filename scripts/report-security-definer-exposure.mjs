#!/usr/bin/env node

// What would break if the twelve exposed authorization functions were locked
// down.
//
// Supabase's advisor reports twelve SECURITY DEFINER functions executable by
// the `authenticated` role over /rest/v1/rpc/. They are the authorization
// primitives themselves -- is_admin, has_org_role, is_org_member and the rest.
// SHIP_READINESS.md section 3 records the finding and records that nothing was
// changed, for a good reason: a SECURITY DEFINER function referenced inside an
// RLS policy is evaluated as the calling role, so revoking EXECUTE from
// `authenticated` can turn a working policy into a denial, and a denial here
// means customers locked out of their own records.
//
// "Verifying that needs a database somebody can break" was the conclusion, and
// it is right about the last mile. It is not right that nothing can be learned
// first. The migrations say which policies call which functions, and that is
// the blast radius. This computes it.
//
// Three things come out, and the third is the one nobody was looking for:
//
//   1. Functions referenced by at least one RLS policy. Revoking EXECUTE on
//      these is the dangerous case and needs a preview branch.
//
//   2. SECURITY DEFINER functions referenced by no policy at all. Nothing in
//      the schema depends on the caller being able to run them, so revoking is
//      safe on the evidence in this repository.
//
//   3. Functions the advisor named that no migration defines. Those exist in
//      the live database, and until 19 August 2026 nobody could review them
//      by reading this repository -- which is a worse problem than the grant.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDirectory = path.join(root, "supabase", "migrations");
const checkOnly = process.argv.includes("--check");

// The twelve from the advisor, as reported. Written down here so this script
// can say which of them the repository cannot account for.
// Where the four undeclared definitions are written down. Recorded verbatim,
// deliberately not created -- see the header of that file for why.
const RECORDED_DEFINITIONS_FILE = "supabase/migrations/20260819050000_record_undeclared_authorization_functions.sql";

// The advisor names functions bare; the recorded file writes them with their
// argument lists. One shape for comparing them.
function functionName(value) {
  return String(value).split("(")[0].replace(/^public\./, "").trim();
}

// Which function definitions that file actually carries.
//
// It looks for `CREATE OR REPLACE FUNCTION public.<name>` inside the recorded
// block, which is commented out on purpose -- so this deliberately reads the
// raw file rather than the comment-stripped SQL every other check here uses.
// Reading the stripped version would find nothing and report all four as
// unreadable, which is the failure this whole report exists to avoid.
function readRecordedDefinitions() {
  const found = new Set();
  let text;
  try {
    text = fs.readFileSync(path.join(root, RECORDED_DEFINITIONS_FILE), "utf8");
  } catch {
    // The file is gone. Say nothing here and let the caller report every
    // function as unreadable, which is then true.
    return found;
  }
  for (const match of text.matchAll(/CREATE OR REPLACE FUNCTION\s+public\.([a-z0-9_]+)/gi)) {
    found.add(match[1].toLowerCase());
  }
  return found;
}

const ADVISOR_REPORTED = [
  "is_admin",
  "is_current_user_admin",
  "has_org_role",
  "is_org_member",
  "has_scope",
  "is_org_owner_or_admin",
  "has_company_access",
  "is_entity_member",
  "has_entity_role",
  "can_manage_entity",
  "sonara_has_org_role",
  "sonara_is_org_member"
];

// SQL comments are stripped first. A function named inside a comment is not a
// call, and the orphan-table report in this repository shipped once with
// exactly that bug -- comments counted as usage, so a table nobody queried
// looked used.
function withoutComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");
}

if (!fs.existsSync(migrationsDirectory)) {
  console.error("ERROR: supabase/migrations does not exist; this report would be empty and would look clean");
  process.exit(1);
}

const files = fs.readdirSync(migrationsDirectory).filter((name) => name.endsWith(".sql")).sort();
if (files.length === 0) {
  console.error("ERROR: no migrations found; this report would be empty and would look clean");
  process.exit(1);
}

const functions = new Map(); // name -> { name, securityDefiner, file }
const policies = []; // { name, table, file, body }
const policyExpressions = []; // every using(...) / with check(...) body, parsed independently

for (const file of files) {
  const sql = withoutComments(fs.readFileSync(path.join(migrationsDirectory, file), "utf8"));

  // Function bodies run to the closing $$ of their dollar-quoted body, which is
  // how SECURITY DEFINER is attributed to the right function rather than to
  // whichever one happened to be nearby.
  const functionPattern = /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z0-9_]+)\s*\(([\s\S]*?)\)\s*returns[\s\S]*?(?:\$\$[\s\S]*?\$\$|\$function\$[\s\S]*?\$function\$)([^;]*);/gi;
  for (const match of sql.matchAll(functionPattern)) {
    const name = match[1].toLowerCase();
    const tail = match[3] || "";
    const head = match[0];
    const securityDefiner = /security\s+definer/i.test(head) || /security\s+definer/i.test(tail);
    // Last definition wins: a later migration replacing a function is the one
    // in force.
    functions.set(name, { name, securityDefiner, file });
  }

  // The policy name may be a quoted string containing spaces. The first
  // version of this pattern was `"?([^"\s]+)"?`, which stops at the first
  // space inside a quoted name and then fails to find the `on` that follows.
  // Most policies in this schema have quoted multi-word names, so it matched
  // almost none of them -- and the report that came out said six authorization
  // functions were called by no policy and were safe to lock down. Two of them
  // are called by dozens. A confidently wrong security recommendation is worse
  // than no report, which is why the cross-check below exists.
  const policyPattern = /create\s+policy\s+(?:"([^"]+)"|([a-z0-9_]+))\s+on\s+(?:public\.)?([a-z0-9_]+)([\s\S]*?);/gi;
  for (const match of sql.matchAll(policyPattern)) {
    // Several migrations create policies through `execute format(... on
    // public.%I ...)` over a list of tables. The table name is a placeholder at
    // this point, and `public` is what falls out of the capture -- so it is
    // labelled rather than reported as a table called public, which does not
    // exist. The policy still counts; only the table name is unknowable here.
    const captured = (match[3] || "").toLowerCase();
    policies.push({
      name: match[1] || match[2],
      table: captured === "public" ? "(built by a template over several tables)" : captured,
      file,
      body: match[4] || ""
    });
  }

  // Second, independent method: every `using (...)` and `with check (...)`
  // expression in the file, found by balancing parentheses rather than by
  // matching policy syntax. It does not know what a policy is, so it cannot
  // fail in the same way the pattern above did.
  for (const match of sql.matchAll(/\b(?:using|with\s+check)\s*\(/gi)) {
    let depth = 0;
    let index = match.index + match[0].length - 1;
    const start = index;
    while (index < sql.length) {
      if (sql[index] === "(") depth += 1;
      else if (sql[index] === ")") {
        depth -= 1;
        if (depth === 0) break;
      }
      index += 1;
    }
    policyExpressions.push(sql.slice(start, index + 1));
  }
}

// A word-boundary match followed by an open paren, so a column named is_admin
// is not mistaken for a call to a function of that name.
function calls(text, name) {
  return new RegExp(`\\b${name}\\s*\\(`, "i").test(text);
}

function callers(name) {
  return policies.filter((policy) => calls(policy.body, name));
}

function appearsInAnyPolicyExpression(name) {
  return policyExpressions.some((expression) => calls(expression, name));
}

const definerFunctions = [...functions.values()].filter((entry) => entry.securityDefiner).sort((a, b) => a.name.localeCompare(b.name));
const referenced = [];
const unreferenced = [];

const disagreements = [];

for (const entry of definerFunctions) {
  const used = callers(entry.name);
  const seenByExpressionScan = appearsInAnyPolicyExpression(entry.name);

  // The two methods have to agree. They failed to once, and the failure was
  // silent and pointed the wrong way -- towards "safe to revoke" on functions
  // dozens of policies depend on. Either method finding a reference is enough
  // to keep a function out of the safe list; a disagreement is reported as a
  // defect in this script rather than smoothed over.
  if (Boolean(used.length) !== seenByExpressionScan) {
    disagreements.push(`${entry.name}: policy parse says ${used.length} callers, expression scan says ${seenByExpressionScan ? "referenced" : "not referenced"}`);
  }

  if (used.length || seenByExpressionScan) referenced.push({ ...entry, policies: used, seenByExpressionScan });
  else unreferenced.push({ ...entry, policies: [] });
}

const undefinedInRepo = ADVISOR_REPORTED.filter((name) => !functions.has(name));
const advisorDefiner = ADVISOR_REPORTED.filter((name) => functions.get(name)?.securityDefiner);

const lines = [];
lines.push(`Migrations read: ${files.length}`);
lines.push(`Functions defined: ${functions.size}, of which SECURITY DEFINER: ${definerFunctions.length}`);
lines.push(`RLS policies parsed: ${policies.length}`);
lines.push("");

lines.push(`Referenced by at least one policy -- revoking EXECUTE is the dangerous case (${referenced.length}):`);
for (const entry of referenced) {
  const tables = [...new Set(entry.policies.map((policy) => policy.table))].sort();
  lines.push(`  ${entry.name}  <- ${entry.policies.length} ${entry.policies.length === 1 ? "policy" : "policies"} on ${tables.length} ${tables.length === 1 ? "table" : "tables"}: ${tables.slice(0, 8).join(", ")}${tables.length > 8 ? ", ..." : ""}`);
}
lines.push("");

lines.push(`SECURITY DEFINER and referenced by no policy -- nothing in the schema depends on the caller running these (${unreferenced.length}):`);
for (const entry of unreferenced) lines.push(`  ${entry.name}  (${entry.file})`);
lines.push("");
lines.push("  Two limits on that sentence, both worth stating before anyone acts on it.");
lines.push("  This reads migrations, so a policy created outside version control is");
lines.push("  invisible here -- and four of the advisor's twelve functions were created");
lines.push("  that way, which is direct evidence that it happens. And the four functions");
lines.push("  this application calls over /rest/v1/rpc/ -- sonara_consume_rate_limit,");
lines.push("  sonara_bootstrap_customer_workspace, sonara_database_contract_snapshot and");
lines.push("  the prompt-library and database-management ones -- all call with the");
lines.push("  service-role key, not as `authenticated`, so revoking the authenticated");
lines.push("  grant would not affect the server. That part was checked rather than assumed.");
lines.push("");

lines.push(`Named by the Supabase advisor but defined by no migration (${undefinedInRepo.length}):`);
for (const name of undefinedInRepo) lines.push(`  ${name}`);
if (undefinedInRepo.length) {
  lines.push("");
  // What this said until 19 August 2026 -- "they cannot be reviewed by reading
  // this repository" -- stopped being true the moment the owner supplied the
  // definitions and 20260819050000_record_undeclared_authorization_functions.sql
  // recorded them. The count above is still right, because it counts what this
  // repository *defines*, and that migration deliberately defines nothing: two
  // of the four read tables that exist nowhere here, and a LANGUAGE sql body is
  // validated at creation, so creating them would fail on deploy.
  //
  // Recorded and defined are different states and this report now says which.
  // Collapsing them would have made the sentence wrong in the other direction.
  const recorded = readRecordedDefinitions();
  const stillUnreadable = undefinedInRepo.filter((name) => !recorded.has(functionName(name)));
  if (stillUnreadable.length === 0) {
    lines.push("  None of these is defined by a migration, so none is created or replaced on deploy.");
    lines.push("  All four are nonetheless readable here: their definitions are recorded verbatim in");
    lines.push(`  ${RECORDED_DEFINITIONS_FILE},`);
    lines.push("  supplied by the owner on 19 August 2026. Recorded is not defined -- two of them read");
    lines.push("  tables that exist in no migration, and creating those would fail on deploy.");
  } else {
    lines.push("  These exist in the live database and their definitions are recorded nowhere in it,");
    lines.push("  so they cannot be reviewed by reading this repository. That is a bigger problem");
    lines.push("  than the grant: an authorization primitive nobody can read is one nobody can check.");
    lines.push("");
    for (const name of stillUnreadable) lines.push(`    unreadable: ${name}`);
  }
}
lines.push("");

lines.push(`Advisor-named functions this repository defines as SECURITY DEFINER: ${advisorDefiner.length} of ${ADVISOR_REPORTED.length}`);

const report = lines.join("\n");
console.log(report);

if (checkOnly) {
  // The report is informational. What is checked is that it can still see
  // anything at all -- a parser that silently stops matching would print a
  // clean-looking report full of zeros, which is the failure this whole file
  // exists to avoid elsewhere.
  const blind = [];
  for (const disagreement of disagreements) blind.push(`the two reference checks disagree -- ${disagreement}`);
  if (functions.size === 0) blind.push("no functions parsed out of the migrations");
  if (policies.length === 0) blind.push("no RLS policies parsed out of the migrations");
  if (policyExpressions.length === 0) blind.push("no using/with-check expressions parsed, so the cross-check is not running");
  if (definerFunctions.length === 0) blind.push("no SECURITY DEFINER functions found, though the advisor reports twelve");
  if (referenced.length === 0) blind.push("no SECURITY DEFINER function is referenced by any policy, which would mean the policies stopped calling them");
  if (blind.length) {
    for (const problem of blind) console.error(`ERROR: ${problem}`);
    console.error("This report has gone blind rather than found nothing.");
    process.exit(1);
  }
  console.log("");
  console.log("Security-definer exposure report verified as still able to see the schema.");
}

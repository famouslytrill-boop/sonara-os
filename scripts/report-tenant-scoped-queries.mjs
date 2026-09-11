#!/usr/bin/env node
"use strict";

// Every query against a tenant-scoped table must name the organization.
//
// The service-role key bypasses row-level security. That is not an oversight --
// it is how this application reaches Postgres -- and it means the
// `organization_id=eq.` filter in a query string IS the tenant boundary. There
// is no second thing behind it. A query that forgets it does not fail; it
// returns every organization's rows, and the page renders them.
//
// So this reads every `rest()` call in the runtime and classifies it. It fails
// when a tenant-scoped table is queried without naming the organization.
//
// WHAT IT CANNOT SEE, WHICH IS THE POINT OF THE RATCHET
//
// `rest()` is a thin fetch wrapper defined per route file, and the table is
// often a parameter: `rest(config, table, ...)` inside a helper the caller hands
// a table name to. A static reader cannot resolve that, and pretending otherwise
// would produce a check that reports a clean run over a third of the calls.
//
// So the unresolved count is recorded and ratcheted. If it rises, this says so
// and asks for the reason -- because a fall nobody records looks exactly like a
// matcher that has stopped matching, and a rise nobody records is the blind spot
// growing quietly. The same reasoning, and the same shape, as
// scripts/report-unused-selected-columns.mjs.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { TENANT_SCOPED_TABLES, GLOBAL_TABLES } = require("../lib/sonara-tenant-scoped-tables.cjs");

const root = process.cwd();
const SOURCE_DIRS = ["lib", "routes", "api"];
const SOURCE_FILES = ["server.js"];

// Recorded on 9 September 2026 from a clean run. Lower it when a call becomes
// resolvable; raise it only with a reason written here.
//
// 28 of 108: fifteen are `rest(config, table, ...)` inside a helper whose caller
// supplies the table, and six are a `path` built at the call site. Those two
// shapes are most of it.
//
// 28 -> 27 on 10 September 2026, and the fall is worth more than the one line
// suggests: the campaign send route ADDED two calls, so five became resolvable.
// `tableNamesInScope` now follows a table map reached through a destructured
// require, one level deep, and through the exported alias it is bound under --
// `const { GROWTH_TABLES: TABLES } = require("./lib/sonara-growth-tables.cjs")`
// resolves, so every `TABLES.leads` and `TABLES.consents` in the Growth Studio
// routes is read rather than shrugged at.
//
// That module exists so fourteen table names have one definition, and its own
// comment says a literal name at the call site "hides the table from the
// member-policy scan". Until this change the two checks pulled in opposite
// directions: doing the right thing for one made a call invisible to the other.
//
// Tenant-scoped-and-filtered rose 22 -> 25 in the same run, which is the number
// that matters -- three calls that were unverifiable are now verified.
const RECORDED_UNRESOLVED = 27;

// Calls whose table is KNOWN to be tenant-scoped and whose query this reader
// cannot resolve. Zero, and it must stay zero.
//
// This bucket used to be a silent count. It was incremented, printed, and never
// gated -- so the single call in it could have been reading every organization's
// rows and a clean run would have said so. It was worse than the
// unresolved-TABLE bucket next to it, because there the table is unknown and the
// tenancy is genuinely unknowable, while here the table is known to be
// tenant-scoped and only the filter is out of view.
//
// The one call was `recordWithdrawal` against `growth_contact_consents` -- the
// only unauthenticated write in the product, and so the worst place in the
// codebase for a tenant filter to be invisible to the check that exists to see
// it. It was correct. Nothing had confirmed that.
//
// It is now resolved rather than recorded, which is why this is 0 rather than 1.
// A rise means a new query shape this reader cannot follow, on a table it knows
// carries an organization: either write the filter at the call site or teach
// queryStringsInScope the shape. Raising this number is not the fix.
const RECORDED_UNRESOLVED_QUERY = 0;

// How many of those unresolved calls carry a literal query with no
// organization_id in it.
//
// Deliberately not restating the unresolved total here. This comment said "of
// those 42" for an hour after RECORDED_UNRESOLVED became 28, which is the same
// defect this script exists to catch wearing a comment: a second copy of a fact
// that does not move when the fact does. The count above is the one place it is
// written.
//
// This is the number that moves if somebody deletes a filter inside a helper
// whose table is a parameter, which is the case the table ratchet alone cannot
// see. Recorded 9 September 2026 from a clean run.
const RECORDED_UNRESOLVED_NO_FILTER = 0;

// A floor, so an empty or broken walk cannot pass as a clean audit.
const MINIMUM_CALLS = 90;

function walk(directory, found = []) {
  if (!fs.existsSync(directory)) return found;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full, found);
    else if (/\.(c?js|mjs)$/.test(entry.name)) found.push(full);
  }
  return found;
}

// Arguments of a call, respecting nesting and strings. A regex cannot do this:
// a template literal in a query string contains commas, parentheses and
// backticks, and splitting on the first comma gets the wrong argument.
function callArguments(source, openParen) {
  let depth = 0;
  let current = "";
  const args = [];
  let quote = null;
  let escaped = false;
  for (let i = openParen; i < source.length; i += 1) {
    const character = source[i];
    if (quote) {
      current += character;
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'" || character === "`") { quote = character; current += character; continue; }
    if (character === "(") { depth += 1; if (depth === 1) continue; }
    if (character === ")") { depth -= 1; if (depth === 0) { args.push(current); return args; } }
    if (character === "," && depth === 1) { args.push(current); current = ""; continue; }
    current += character;
  }
  return null;
}

// Whether this call selects rows by filter, which decides whether an empty query
// is a hole or a normal insert.
//
// A POST carries the organization in its body, so `rest(config, table, "", {
// method: "POST", body })` is correct and flagging it is noise -- the first run
// of this check flagged five of them. A GET, PATCH or DELETE is the opposite:
// the query string is the only thing choosing which rows are read, changed or
// removed, and an unfiltered PATCH or DELETE on a tenant table would rewrite
// every organization's rows rather than merely read them.
function filtersRows(args) {
  const options = (args[3] || "").trim();
  const method = options.match(/method\s*:\s*["'`]([A-Z]+)["'`]/);
  if (!method) return true;
  return method[1] !== "POST";
}

// The object literals in one file, keyed by the name they are bound to.
//
// Split out of tableNamesInScope so it can be run against an IMPORTED module as
// well as the file being read. lib/sonara-growth-tables.cjs exists precisely so
// that fourteen table names have one definition, and reading `TABLES.consents`
// as unresolvable punished the file for doing the right thing -- the comment in
// that module says a literal name at the call site "hides the table from the
// member-policy scan", so the two checks were pulling in opposite directions.
function objectLiteralsIn(source) {
  const maps = new Map();
  for (const match of source.matchAll(/(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:Object\.freeze\()?\{([\s\S]*?)\}/g)) {
    const entries = new Map();
    for (const entry of match[2].matchAll(/([A-Za-z_$][\w$]*|"[^"]+"|'[^']+')\s*:\s*["'`]([a-z0-9_]+)["'`]/g)) {
      entries.set(entry[1].replace(/^["']|["']$/g, ""), entry[2]);
    }
    if (entries.size) maps.set(match[1], entries);
  }
  return maps;
}

// A table map reached through `const { EXPORTED: LOCAL } = require("./module")`.
//
// Followed one level only, and deliberately: a resolver that chased requires
// recursively would be a module loader, and this has to stay something a reader
// can check by eye. One level covers the shape actually used here -- a frozen
// map of literal table names in lib/, destructured at the top of a route file.
function importedTableMaps(source, file) {
  const found = new Map();
  const pattern = /(?:const|let)\s*\{([^}]*)\}\s*=\s*require\(\s*["'`](\.[^"'`]+)["'`]\s*\)/g;

  for (const match of source.matchAll(pattern)) {
    const target = path.resolve(path.dirname(file), match[2]);
    const resolved = [target, `${target}.cjs`, `${target}.js`, `${target}.mjs`].find(
      (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()
    );
    if (!resolved) continue;

    const moduleSource = fs.readFileSync(resolved, "utf8");
    const literals = objectLiteralsIn(moduleSource);
    if (!literals.size) continue;

    // The exported NAME is usually not the local variable name. This module's
    // whole reason for existing is one shared definition, so it reads
    // `const TABLES = Object.freeze({...})` and then
    // `module.exports = { GROWTH_TABLES: TABLES }` -- and looking up
    // GROWTH_TABLES among the literals finds nothing. The first version of this
    // function did exactly that and resolved zero maps while appearing to work,
    // which is the shape this whole script is a ratchet against.
    const exportedAs = new Map();
    for (const block of moduleSource.matchAll(/module\.exports\s*=\s*\{([^}]*)\}/g)) {
      for (const binding of block[1].split(",")) {
        const [name, local] = binding.split(":").map((part) => part.trim());
        if (name) exportedAs.set(name, local || name);
      }
    }
    for (const single of moduleSource.matchAll(/(?:module\.)?exports\.([A-Za-z_$][\w$]*)\s*=\s*([A-Za-z_$][\w$]*)\s*;/g)) {
      exportedAs.set(single[1], single[2]);
    }

    for (const binding of match[1].split(",")) {
      const [name, alias] = binding.split(":").map((part) => part.trim());
      if (!name) continue;
      const entries = literals.get(exportedAs.get(name) || name);
      if (entries) found.set(alias || name, entries);
    }
  }
  return found;
}

function tableNamesInScope(source, file) {
  const direct = new Map();
  for (const match of source.matchAll(/(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*["'`]([a-z0-9_]+)["'`]/g)) {
    direct.set(match[1], match[2]);
  }
  const maps = objectLiteralsIn(source);
  // Imported maps do not overwrite a local literal of the same name: the file
  // being read is the authority on its own bindings.
  for (const [name, entries] of importedTableMaps(source, file)) {
    if (!maps.has(name)) maps.set(name, entries);
  }
  for (const match of source.matchAll(/(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)/g)) {
    const resolved = maps.get(match[2])?.get(match[3]);
    if (resolved) direct.set(match[1], resolved);
  }
  return { direct, maps, queries: queryStringsInScope(source) };
}

// A query passed as a variable rather than written at the call site.
//
// This existed as a silent bucket. A call whose TABLE is known to be
// tenant-scoped but whose QUERY is a variable was counted as "query is not a
// literal" and then skipped -- not classified, and, unlike the unresolved-table
// bucket, **not ratcheted**. So the one call in it could have been reading every
// organization's rows and this script would have printed the count and passed.
//
// The one call was `recordWithdrawal` in routes/growth-studio-control-routes.cjs
// against `growth_contact_consents`, and it is correct -- its `scope` opens with
// `organization_id=eq.`. But it is **the only unauthenticated write in the
// product**, which makes it the worst possible place for the filter to be
// invisible to the check that exists to see it.
//
// So it is resolved rather than recorded. The text of the declaration is what
// gets tested for `organization_id=`, which is exactly the question being asked
// -- this is not trying to evaluate the expression, only to read whether the
// filter is written in it.
//
// **Resolution is by nearest preceding declaration, not by name across the
// file.** The first version of this matched declarations file-wide and refused
// any name declared twice -- and `scope` in
// routes/growth-studio-control-routes.cjs is declared twice, so it stayed
// unresolved. That refusal was right: of those two declarations, one is
// `audience === "organization" ? "" : ...` and carries no organization filter at
// all, so picking either one at random would report a filter belonging to a
// different query -- in one direction a false alarm, in the other a false clean.
//
// Taking the last declaration at or before the call's own offset is how the
// binding actually resolves for this code shape, and it removes the ambiguity
// instead of surrendering to it. Same correction as
// report-unused-selected-columns.mjs, which was rewritten per-function after its
// file-wide version hid the bug it was written for.
function queryStringsInScope(source) {
  const declarations = [];
  const pattern = /(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*((?:`[^`]*`|"[^"]*"|'[^']*'|[^;])*);/g;
  for (const match of source.matchAll(pattern)) {
    declarations.push({ name: match[1], offset: match.index, text: match[2] });
  }
  return {
    resolve(name, offset) {
      let best;
      for (const declaration of declarations) {
        if (declaration.name !== name) continue;
        if (declaration.offset > offset) break;
        best = declaration;
      }
      return best?.text;
    }
  };
}

const files = [...SOURCE_FILES.map((name) => path.join(root, name)), ...SOURCE_DIRS.flatMap((dir) => walk(path.join(root, dir)))]
  .filter((file) => fs.existsSync(file));

const counts = { total: 0, tenantFiltered: 0, tenantUnfiltered: 0, notTenantScoped: 0, unresolvedTable: 0, unresolvedTableNoFilter: 0, unresolvedQuery: 0, resolvedQueryVariable: 0 };
const unfiltered = [];
const unresolvedNoFilter = [];
const unresolvedQueries = [];
const unresolvedShapes = new Map();

for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  const { direct, maps, queries } = tableNamesInScope(source, file);

  for (const match of source.matchAll(/\brest\(/g)) {
    // `rest` is declared per route file, and `async function rest(config, table,
    // query = "", options = {})` matches this pattern as readily as a call does.
    // Counting a declaration as a call is the population error: the first run of
    // this check reported five calls "naming no organization" that were the five
    // definitions of the helper itself.
    const before = source.slice(Math.max(0, match.index - 30), match.index);
    if (/\bfunction\s+$/.test(before)) continue;

    const args = callArguments(source, match.index + "rest".length);
    if (!args || args.length < 2) continue;
    counts.total += 1;

    const expression = args[1].trim();
    let table = /^["'`]/.test(expression) ? expression.slice(1, -1) : direct.get(expression);
    if (!table) {
      const dotted = expression.match(/^([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)$/);
      if (dotted) table = maps.get(dotted[1])?.get(dotted[2]);
    }

    if (!table) {
      counts.unresolvedTable += 1;
      const shape = expression.slice(0, 40);
      unresolvedShapes.set(shape, (unresolvedShapes.get(shape) || 0) + 1);

      // The table is unknown, so whether it is tenant-scoped is unknown. But the
      // query usually is a literal, and whether THAT names an organization is
      // knowable -- so it is counted rather than waved past.
      //
      // This exists because the first version of this script did not have it,
      // and the falsification found out: deleting `organization_id=eq.` from a
      // real query in market-intelligence-routes.cjs left the run green, because
      // that call's table is a parameter and landed here. A check blind to the
      // one edit it exists to catch is worse than no check, so the blind bucket
      // is now measured on the half of the call it can actually read.
      const blindQuery = (args[2] || "").trim();
      if (/^["'`]/.test(blindQuery) && !/organization_id=/.test(blindQuery) && filtersRows(args)) {
        counts.unresolvedTableNoFilter += 1;
        unresolvedNoFilter.push({ file: path.relative(root, file), expression: shape, query: blindQuery.slice(0, 120).replace(/\s+/g, " ") });
      }
      continue;
    }

    if (!TENANT_SCOPED_TABLES.has(table)) {
      // Global tables carry no organization, so there is nothing to filter on.
      // An unknown name lands here too and is not a tenant claim either way.
      counts.notTenantScoped += 1;
      continue;
    }

    let query = (args[2] || "").trim();
    if (!/^["'`]/.test(query)) {
      // A query handed in as a variable. Resolve it from its declaration rather
      // than skipping the call -- see queryStringsInScope for why this bucket
      // was the most dangerous one in this script.
      const declared = queries.resolve(query, match.index);
      // A filter inside a conditional is not a filter that is always sent.
      //
      // The resolution here is textual -- it reads whether `organization_id=` is
      // WRITTEN in the declaration, which is the right question for a
      // concatenation and the wrong one for a ternary: `flag ? \`organization_id=eq.
      // ...\` : ""` contains the filter and emits it only sometimes. Reading that
      // as filtered would be a check reporting a guarantee that holds on one
      // branch.
      //
      // There is no such declaration today, so this costs nothing now and fails
      // closed later. Writing the filter outside the conditional resolves it.
      if (declared !== undefined && /\?/.test(declared) && /organization_id=/.test(declared)) {
        counts.unresolvedQuery += 1;
        unresolvedQueries.push({
          file: path.relative(root, file),
          table,
          expression: `${query} -- the filter is inside a conditional, so it is not always sent`
        });
        continue;
      }
      if (declared === undefined) {
        counts.unresolvedQuery += 1;
        unresolvedQueries.push({ file: path.relative(root, file), table, expression: query.slice(0, 40) });
        continue;
      }
      counts.resolvedQueryVariable += 1;
      query = declared;
    }

    if (/organization_id=/.test(query)) counts.tenantFiltered += 1;
    else if (!filtersRows(args)) counts.notTenantScoped += 1;
    else {
      counts.tenantUnfiltered += 1;
      unfiltered.push({ file: path.relative(root, file), table, query: query.slice(0, 140).replace(/\s+/g, " ") });
    }
  }
}

const failures = [];

if (counts.total < MINIMUM_CALLS) {
  failures.push(
    `only ${counts.total} rest() calls found across ${files.length} runtime files, against a floor of ${MINIMUM_CALLS}. ` +
    "This check has gone blind -- the walk or the matcher is broken, and a clean result here would mean nothing."
  );
}

if (counts.tenantFiltered === 0) {
  failures.push(
    "no tenant-scoped query was resolved at all, so the organization filter was never actually checked on anything. " +
    "A pass in this state is the check measuring nothing."
  );
}

for (const entry of unfiltered) {
  failures.push(
    `${entry.file} queries the tenant-scoped table ${entry.table} without organization_id=. ` +
    `The service-role key bypasses row-level security, so this returns every organization's rows: ${entry.query}`
  );
}

if (counts.unresolvedTableNoFilter > RECORDED_UNRESOLVED_NO_FILTER) {
  for (const entry of unresolvedNoFilter) {
    failures.push(
      `${entry.file} calls rest() on an unresolvable table (${entry.expression}) with a query naming no organization: ${entry.query}. ` +
      "Whether that table is tenant-scoped cannot be read from here, which is exactly why it has to be answered by hand: " +
      "either add organization_id= to the query, or name the table at the call site so this check can classify it."
    );
  }
}

if (counts.unresolvedQuery > RECORDED_UNRESOLVED_QUERY) {
  for (const entry of unresolvedQueries) {
    failures.push(
      `${entry.file} queries the tenant-scoped table ${entry.table} with a query this reader cannot resolve (${entry.expression}). ` +
      "The table is known to carry an organization and the filter is out of view, which is the one combination this script must never " +
      "wave past. Write the filter at the call site, or teach queryStringsInScope the shape."
    );
  }
  if (unresolvedQueries.length === 0) {
    failures.push(
      `${counts.unresolvedQuery} unresolvable queries were counted and none were recorded, so this cannot say which. ` +
      "That is a bug in this script rather than in the runtime."
    );
  }
}

if (counts.unresolvedTable > RECORDED_UNRESOLVED) {
  failures.push(
    `${counts.unresolvedTable} rest() calls have a table this reader cannot resolve, up from the recorded ${RECORDED_UNRESOLVED}. ` +
    "The blind spot grew. Either resolve the new ones by naming the table at the call site, or raise RECORDED_UNRESOLVED " +
    "in this script with the reason written beside it."
  );
}

const shapes = [...unresolvedShapes.entries()].sort((a, b) => b[1] - a[1]).map(([shape, n]) => `${n}x ${shape}`).join(", ");

console.log(
  `Tenant-scoped query audit: ${counts.total} rest() calls across ${files.length} runtime files -- ` +
  `${counts.tenantFiltered} tenant-scoped and filtered by organization_id, ${counts.tenantUnfiltered} tenant-scoped and NOT filtered, ` +
  `${counts.notTenantScoped} on tables that carry no organization, ${counts.unresolvedTable} whose table cannot be resolved statically ` +
  `(${shapes || "none"}), of which ${counts.unresolvedTableNoFilter} carry a literal query naming no organization, ` +
  `${counts.unresolvedQuery} whose query is not a literal. Query variables resolved from their nearest preceding declaration: ${counts.resolvedQueryVariable}.`
);

if (counts.unresolvedTable < RECORDED_UNRESOLVED) {
  console.log(
    `The unresolved count fell to ${counts.unresolvedTable} from the recorded ${RECORDED_UNRESOLVED}. ` +
    "Lower RECORDED_UNRESOLVED in this script to hold the ground: a fall nobody records looks exactly like a matcher that stopped matching."
  );
}

if (failures.length) {
  console.error("\nTenant-scoped query audit failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

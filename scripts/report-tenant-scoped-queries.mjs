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
// The list that actually runs. READ_WITHOUT_ORGANIZATION below is this script's
// record of which unscoped reads are deliberate; EXEMPT_PATTERNS is the runtime
// guard's, and only the second one decides whether the request leaves the
// process. See "the two registers" further down.
const { EXEMPT_PATTERNS } = require("../lib/sonara-tenant-guard.cjs");

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
// 27 -> 40 on 30 September 2026, and the rise is the point rather than a
// regression.
//
// This script read `args[1]` as the table for every rest() call. That is one of
// four signatures in use, so for ten of the fifteen declaring files argument 1 is
// a path or a query string -- never a name in TENANT_SCOPED_TABLES, so every call
// in those files fell into "carries no organization" and its organization filter
// was never read. The bucket that looked like 59 harmless calls was mostly
// misclassification.
//
// Reading each file's own signature, resolving a table held in a module constant,
// and expanding `${scope}` moved 30 calls into the verified bucket (26 -> 56) and
// moved the genuinely unreadable ones out of "harmless" and into here. So 40 is a
// smaller blind spot than 27 was, measured honestly: what changed is that the
// unreadable calls are now counted as unreadable.
//
// The 40 are helper-internal indirections -- 15x a `table` parameter, 6x a `path`
// parameter, 3x `definition.table`, and the rest interpolations of a value chosen
// at a call site (`${shareable.table}`, `TABLES[page.tableKey]`). Resolving those
// means following a value across a function boundary, which is a bigger change
// than this one.
const RECORDED_UNRESOLVED = 40;

// Review-only social tables are not in the migration-derived registry yet.
// Do not misclassify them as GLOBAL_TABLES or increase the unresolved ratchet.
// The two account-block reads have exact session-derived filters; moderator
// history retains an organization filter. Once the migration is generated,
// update the registry and remove these explicitly checked transitional rules.
const PENDING_TENANT_TABLES = new Set(["growth_channel_moderation_events"]);
const ACCOUNT_BLOCK_READS = new Set(["viewer.id", "req.sonaraUser.id"]);
const accountBlockReadsSeen = new Set();


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

// Tenant-scoped tables read without an organization, on purpose.
//
// Reading `creator_artist_profiles` without an organization is what a public
// creator page IS: the visitor is a stranger and has no organization to be
// filtered to. Refusing every such call would make this check unpassable for the
// public half of the product; passing every call whose route looks public would
// make it worthless.
//
// So each entry names the substitute scope -- the filter that does the job an
// organization filter would do -- and the exemption applies ONLY while that
// filter is still in the query. Delete `status=eq.active` from the public profile
// lookup and this stops exempting it, because the thing that made it safe is
// gone. An exemption that survives the removal of its own justification is the
// shape .claude/skills/checks-that-cannot-lie calls "an exemption whose reason has
// expired", and this repository has shipped one.
//
// Two-sided: an entry matching no call in the run fails as well, so a route that
// moves or gets scoped properly cannot leave a stale reason behind.
const READ_WITHOUT_ORGANIZATION = [
  {
    file: "routes/sonara-growth-channel-routes.cjs",
    table: "growth_channels",
    requires: ["state=eq.public", "handle=eq."],
    reason:
      "GET /channels/:handle and POST /channels/:handle/report, registered with no guard -- a public channel. " +
      "growth_channels_handle_key makes the handle name one channel and state=eq.public keeps drafts and hidden " +
      "channels unreachable. Every later read and the report write carry organization_id from this row."
  },
  {
    file: "routes/sonara-growth-channel-routes.cjs",
    table: "growth_channels",
    requires: ["select=organization_id&handle=eq."],
    reason:
      "The address check inside POST /api/growth/channels, behind growth_studio workspace access. It looks " +
      "across organizations to answer 'taken' before the unique index does; organization_id is the only column " +
      "selected and any row means taken."
  },
  {
    file: "routes/sonara-creator-profile-routes.cjs",
    table: "creator_artist_profiles",
    requires: ["status=eq.active"],
    reason:
      "GET /creator/:handle is registered with no guard -- a public creator page. " +
      "The row is found by public_handle or id with status=eq.active and only " +
      "PUBLIC_PROFILE_COLUMNS are selected; NEVER_PUBLISHED_COLUMNS is the other " +
      "half of that contract. A stranger has no organization to be filtered to."
  },
  {
    file: "routes/sonara-creator-profile-routes.cjs",
    table: "creator_artist_profiles",
    requires: ["id=in.(", "public_handle=not.is.null", "status=eq.active"],
    reason:
      "GET /account/following, which does require a customer. The ids come from " +
      "that viewer's own rows in creator_follows, so the id list IS the scope, and " +
      "public_handle=not.is.null with status=eq.active means only a profile anybody " +
      "could open comes back -- POST /api/creator-profiles/:id/unpublish nulls the " +
      "handle, so an unpublished profile leaves a follower's list without its draft " +
      "name ever being read. The runtime guard's exemption requires the same two " +
      "filters."
  },
  {
    file: "routes/sonara-lead-capture-routes.cjs",
    table: "lead_capture_pages",
    requires: ["select=organization_id"],
    reason:
      "The slug-uniqueness check inside POST /api/lead-capture-page, which does " +
      "require a customer. It has to look across organizations to answer 'taken by " +
      "somebody else' rather than handing the owner a constraint violation -- the " +
      "comment above it says so. organization_id is the only column selected, and " +
      "it is compared against the caller's own."
  },
  {
    file: "routes/sonara-growth-event-routes.cjs",
    table: "growth_events",
    requires: ["status=neq.draft"],
    reason:
      "GET and POST /events/:slug, registered with no guard -- a published event's " +
      "public page. The slug IS the scope: growth_events_slug_key makes it unique " +
      "across the table, so one slug names one event, and status=neq.draft means an " +
      "unpublished one cannot be reached by guessing addresses. A stranger has no " +
      "organization to be filtered to. The same shape as /book/:slug. Two reads " +
      "that could have been scoped and were not -- the venue by id and the RSVP " +
      "count -- were tightened rather than exempted when this check named them; " +
      "they carry organization_id=eq. from the event now."
  },
  {
    file: "routes/sonara-growth-event-routes.cjs",
    table: "growth_events",
    requires: ["select=id&slug=eq."],
    reason:
      "The slug-uniqueness check inside POST /api/growth/events/publish, which does " +
      "require growth_studio workspace access. It has to look across organizations " +
      "to answer 'taken by somebody else' rather than handing the owner a " +
      "constraint violation with no explanation. `id` is the only column selected " +
      "and it is compared against the caller's own event id, so nothing from " +
      "another organization reaches the page. Same reasoning as the " +
      "lead_capture_pages entry above."
  },
  {
    file: "routes/sonara-merchant-store-routes.cjs",
    table: "merchant_storefronts",
    requires: ["enabled=eq.true"],
    reason:
      "GET and POST /store/:slug, registered with no guard -- a published shop's " +
      "public page. The slug IS the scope: merchant_storefronts_slug_key makes it " +
      "unique across the table, and enabled=eq.true means an unpublished shop " +
      "cannot be reached by guessing addresses. A stranger has no organization to " +
      "be filtered to. Everything the page then reads IS scoped: the catalogue is " +
      "fetched with organization_id taken off the shop row this query returned, " +
      "which is what makes one unfiltered read enough."
  },
  {
    file: "routes/sonara-merchant-store-routes.cjs",
    table: "merchant_storefronts",
    requires: ["select=organization_id&slug=eq."],
    reason:
      "The slug-uniqueness check inside POST /api/business/storefront/publish, " +
      "which does require a business manager. It has to look across organizations " +
      "to answer 'taken by somebody else' rather than handing the owner a " +
      "constraint violation with no explanation. organization_id is the only " +
      "column selected and it is compared against the caller's own, so nothing " +
      "from another organization reaches the page."
  }
];

// The same, for calls whose table this reader cannot resolve but whose literal
// query is readable and names no organization.
const BLIND_QUERY_WITHOUT_ORGANIZATION = [
  {
    file: "routes/sonara-scroll-routes.cjs",
    requires: ["published_at=not.is.null"],
    reason:
      "The public published-scroll page. The comment at the call says it: 'The " +
      "public request never chooses an organization -- it is told one.' Only a row " +
      "with published_at set is returned, and only title, document and slug."
  },
  {
    file: "routes/sonara-shared-result-routes.cjs",
    requires: ["token=eq.", "revoked_at=is.null"],
    reason:
      "GET /shared/:token, unauthenticated by design. The token IS the capability, " +
      "and revoked_at=is.null is how revoking one takes it away. A share link that " +
      "required knowing the organization would not be a share link."
  }
];

// A file can have more than one substitute scope, so every candidate is tried
// and the exemption holds if any one of them is fully present.
//
// When more than one is present, the MOST specific wins -- the entry requiring
// the most filters. This returned the first match, which was harmless only while
// no two entries' filters overlapped. On 2 October 2026 the follower list gained
// status=eq.active (lib/sonara-tenant-guard.cjs requires it), and the public-page
// entry, which requires only status=eq.active, started claiming the follower
// query -- so the follower entry matched nothing and this report called it stale
// while the call it describes was right there. Most-specific is also what keeps
// the two-sided check honest in the other direction: the follower query cannot
// keep the public-page entry alive after the public lookup is deleted, because it
// is credited to its own entry instead.
function exemptedBy(list, file, table, query) {
  const candidates = list.filter((entry) =>
    entry.file === file &&
    (entry.table === undefined || entry.table === table) &&
    entry.requires.every((needle) => query.includes(needle)));
  return candidates.sort((left, right) => right.requires.length - left.requires.length)[0];
}


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
// Whether a literal carries any query text at all.
//
// `\`${table}${query}\`` is the body of a write() wrapper in
// routes/sonara-scroll-routes.cjs: both halves are that function's own
// parameters, so the string contains no query and the real filter is at the
// wrapper's call sites. Concluding "this query names no organization" from it is
// concluding something about a string with nothing in it -- the same error as
// counting a `rest` declaration as a call, which this script already guards
// against a few lines down.
function hasReadableQuery(literal) {
  const withoutInterpolations = literal.replace(/\$\{[^}]*\}/g, "").replace(/^[`"']|[`"']$/g, "");
  return /[=?]/.test(withoutInterpolations);
}

function filtersRows(args, signature) {
  const options = (args[signature.optionsIndex] || "").trim();
  const method = options.match(/method\s*:\s*["'`]([A-Z]+)["'`]/);
  if (!method) return true;
  return method[1] !== "POST";
}

// Which argument of `rest()` holds what, read from the declaration in the file
// being scanned.
//
// This script assumed `rest(config, table, query, options)` for every call, and
// that is one of four signatures in use. Fifteen declarations across routes/ and
// lib/:
//
//   rest(config, table, query = "", options = {})   5 files -- the assumed shape
//   rest(config, path, init)                        3 files
//   rest(config, path)                              3 files
//   rest(config, query, options = {})               2 files
//   rest(table, query = "", options = {})           1 file -- table at index 0
//
// So for ten of those files `args[1]` is not the table. It is a path or a query
// string, which is never a name in TENANT_SCOPED_TABLES, so every call in them
// fell into the "carries no organization" bucket and its organization filter was
// never looked at.
//
// That is not theoretical. routes/sonara-business-control-plane-routes.cjs line
// 237 declares `rest(table, query = "", options = {})`, and `business_workspaces`
// is in TENANT_SCOPED_TABLES. Deleting `organization_id=eq.${ctx.organizationId}`
// from its business list query left this script exiting 0 with byte-identical
// output -- not one of the counts moved. A tenant-isolation check blind to a
// whole route file is the shape docs/SPRINT_LOG.md keeps recording.
//
// Read by parameter name rather than by position, because the name is what says
// which argument is which, and a file that renames one is telling the truth about
// its own helper.
function restSignature(source) {
  const declaration = /(?:async\s+)?function\s+rest\s*\(([^)]*)\)/.exec(source);
  if (!declaration) return null;
  const parameters = declaration[1]
    .split(",")
    .map((parameter) => parameter.trim().split(/[\s=]/)[0])
    .filter(Boolean);
  const tableIndex = parameters.indexOf("table");
  const pathIndex = parameters.indexOf("path");
  const queryIndex = parameters.indexOf("query");
  // A `path` argument carries the table and the query in one string, so it is
  // both. `init` is the options object under another name.
  const optionsIndex = parameters.findIndex((parameter) => parameter === "options" || parameter === "init");
  return {
    parameters,
    tableIndex,
    pathIndex,
    queryIndex: queryIndex >= 0 ? queryIndex : pathIndex,
    optionsIndex: optionsIndex >= 0 ? optionsIndex : parameters.length
  };
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

// `${scope}` inside a query, expanded from the declaration it resolves to.
//
// queryStringsInScope resolves a query handed in as a bare variable. It does not
// help when the filter arrives interpolated into a larger literal --
// `` `${TABLE}?${scope}&select=id,name` `` -- and three files write their queries
// that way. Those calls read as "no organization named" when `scope` is
// `organization_id=eq.${enc(organizationId)}`, which is the filter being looked
// for.
//
// One level, nearest preceding declaration, same resolution rule as the bare
// case. `expanded` is separate from the original so the conditional check below
// still reads the declaration text rather than a flattened string.
function expandInterpolations(literal, queries, offset) {
  let expanded = literal;
  let substituted = false;
  for (const match of literal.matchAll(/\$\{([A-Za-z_$][\w$]*)\}/g)) {
    const declared = queries.resolve(match[1], offset);
    if (declared === undefined) continue;
    expanded = expanded.split(match[0]).join(declared);
    substituted = true;
  }
  return { expanded, substituted };
}

const files = [...SOURCE_FILES.map((name) => path.join(root, name)), ...SOURCE_DIRS.flatMap((dir) => walk(path.join(root, dir)))]
  .filter((file) => fs.existsSync(file));

const counts = { total: 0, tenantFiltered: 0, tenantUnfiltered: 0, notTenantScoped: 0, unresolvedTable: 0, unresolvedTableNoFilter: 0, unresolvedQuery: 0, resolvedQueryVariable: 0, readWithoutOrganization: 0 };
const exemptionsUsed = new Set();
const unfiltered = [];
const unresolvedNoFilter = [];
const unresolvedQueries = [];
const unresolvedShapes = new Map();

for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  const { direct, maps, queries } = tableNamesInScope(source, file);
  // A file with no rest() declaration still has calls worth reading -- it may
  // call a helper it imported -- so fall back to the shape five of the six
  // declaring files use rather than skipping the file.
  const signature = restSignature(source) || { parameters: [], tableIndex: 1, pathIndex: -1, queryIndex: 2, optionsIndex: 3 };

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

    // The table argument for THIS file's helper, not argument 1 for every file.
    const tableArgumentIndex = signature.tableIndex >= 0 ? signature.tableIndex : signature.pathIndex >= 0 ? signature.pathIndex : 1;
    const expression = (args[tableArgumentIndex] || "").trim();
    if (!expression) {
      counts.unresolvedTable += 1;
      unresolvedShapes.set("(missing argument)", (unresolvedShapes.get("(missing argument)") || 0) + 1);
      continue;
    }
    let table = /^["'`]/.test(expression) ? expression.slice(1, -1) : direct.get(expression);
    if (!table) {
      const dotted = expression.match(/^([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)$/);
      if (dotted) table = maps.get(dotted[1])?.get(dotted[2]);
    }
    // A `path` argument is `table?query`, so the name is everything before the
    // first `?` and the rest is the query. Reading it whole is what put these
    // calls in the "carries no organization" bucket.
    let embeddedQuery = "";
    if (table && signature.tableIndex < 0 && signature.pathIndex >= 0 && table.includes("?")) {
      const cut = table.indexOf("?");
      embeddedQuery = table.slice(cut + 1);
      table = table.slice(0, cut);
    }
    // A table held in a module constant: `${EMPLOYEES_TABLE}?organization_id=...`.
    //
    // Interpolating the name is the shape most path-style callers use, and it is
    // the shape tableNamesInScope already resolves for the `rest(config, table)`
    // form -- `direct` maps the identifier to the literal it is declared as. So
    // the name is resolved here rather than recorded as unreadable, which is what
    // moves these calls from the blind bucket into a verified one.
    const interpolated = table && /^\$\{([A-Za-z_$][\w$]*)\}$/.exec(table);
    if (interpolated) table = direct.get(interpolated[1]);

    // Anything still carrying an interpolation is not a name. Treating
    // `${shareable.table}` or `${table}${query}` as one is how a query string
    // became a table in the first place.
    if (table && /[${}`]/.test(table)) table = undefined;

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
      const blindQuery = (embeddedQuery ? `\`${embeddedQuery}\`` : args[signature.queryIndex] || "").trim();
      const blindExpanded = expandInterpolations(blindQuery, queries, match.index).expanded;
      if (/^["'`]/.test(blindQuery) && !/organization_id=/.test(blindExpanded) && hasReadableQuery(blindQuery) && filtersRows(args, signature)) {
        const relativeBlind = path.relative(root, file);
        const exemption = exemptedBy(BLIND_QUERY_WITHOUT_ORGANIZATION, relativeBlind, undefined, blindExpanded);
        if (exemption) {
          counts.readWithoutOrganization += 1;
          exemptionsUsed.add(exemption);
        } else {
          counts.unresolvedTableNoFilter += 1;
          unresolvedNoFilter.push({ file: relativeBlind, expression: shape, query: blindQuery.slice(0, 120).replace(/\s+/g, " ") });
        }
      }
      continue;
    }

    if (table === "growth_channel_blocks") {
      // A personal block table crosses organization boundaries by design.
      // Explicitly authenticate the actor in the route and require one of the
      // two known signed-in session expressions, a single safe field and the
      // bounded account-specific filter. Anything else fails this audit.
      const relative = path.relative(root, file);
      const raw = (embeddedQuery || args[signature.queryIndex] || "").trim();
      const normalized = raw.replace(/^`|`$/g, "");
      const pattern = /^select=channel_id&viewer_user_id=eq\.\$\{enc\((viewer\.id|req\.sonaraUser\.id)\)\}&limit=\$\{safety\.MAX_BLOCKED \+ 1\}$/;
      const matching = relative === "routes/sonara-growth-channel-routes.cjs" && pattern.exec(normalized);
      if (matching && ACCOUNT_BLOCK_READS.has(matching[1])) {
        counts.readWithoutOrganization += 1;
        accountBlockReadsSeen.add(matching[1]);
      } else {
        counts.tenantUnfiltered += 1;
        unfiltered.push({ file: relative, table, query: raw.slice(0, 140).replace(/\s+/g, " ") });
      }
      continue;
    }

    if (!TENANT_SCOPED_TABLES.has(table) && !PENDING_TENANT_TABLES.has(table)) {
      // Only a name recorded in GLOBAL_TABLES carries no organization.
      //
      // This branch used to take every name that was not tenant-scoped, and its
      // comment said so: "An unknown name lands here too and is not a tenant
      // claim either way." That is the sentence that let the bucket grow to 59
      // while 26 calls were actually verified. GLOBAL_TABLES has 98 entries and
      // was destructured at the top of this file and never read -- a value
      // fetched into a decision and never used, which is the third shape in
      // .claude/skills/checks-that-cannot-lie, found by turning no-unused-vars on
      // over scripts/**/*.mjs for the first time.
      //
      // A name in neither list is now unresolved, not global, which routes it into
      // the blind-query check below. That check already fails on a literal query
      // naming no organization, so the cost of not knowing the table is a question
      // rather than a pass.
      if (GLOBAL_TABLES.has(table)) {
        counts.notTenantScoped += 1;
        continue;
      }
      counts.unresolvedTable += 1;
      const unknownShape = `${table.slice(0, 40)} (in neither table list)`;
      unresolvedShapes.set(unknownShape, (unresolvedShapes.get(unknownShape) || 0) + 1);
      const unknownQuery = (embeddedQuery ? `\`${embeddedQuery}\`` : args[signature.queryIndex] || "").trim();
      const unknownExpanded = expandInterpolations(unknownQuery, queries, match.index).expanded;
      if (/^["'`]/.test(unknownQuery) && !/organization_id=/.test(unknownExpanded) && hasReadableQuery(unknownQuery) && filtersRows(args, signature)) {
        const relativeBlind = path.relative(root, file);
        const exemption = exemptedBy(BLIND_QUERY_WITHOUT_ORGANIZATION, relativeBlind, undefined, unknownExpanded);
        if (exemption) {
          counts.readWithoutOrganization += 1;
          exemptionsUsed.add(exemption);
        } else {
          counts.unresolvedTableNoFilter += 1;
          unresolvedNoFilter.push({ file: relativeBlind, expression: unknownShape, query: unknownQuery.slice(0, 120).replace(/\s+/g, " ") });
        }
      }
      continue;
    }

    let query = (embeddedQuery ? `\`${embeddedQuery}\`` : args[signature.queryIndex] || "").trim();
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

    // Expanded, for the same reason the two blind branches above expand: three
    // files write the filter as `${scope}` interpolated into the query, and the
    // raw literal does not contain `organization_id=` while the query it builds
    // does.
    const resolvedQuery = expandInterpolations(query, queries, match.index).expanded;
    if (/organization_id=/.test(resolvedQuery)) counts.tenantFiltered += 1;
    else if (!filtersRows(args, signature)) counts.notTenantScoped += 1;
    else {
      const relative = path.relative(root, file);
      // The exemption holds only while the filter it rests on is still written.
      const exemption = exemptedBy(READ_WITHOUT_ORGANIZATION, relative, table, resolvedQuery);
      if (exemption) {
        counts.readWithoutOrganization += 1;
        exemptionsUsed.add(exemption);
        continue;
      }
      counts.tenantUnfiltered += 1;
      unfiltered.push({ file: relative, table, query: query.slice(0, 140).replace(/\s+/g, " ") });
    }
  }
}

const failures = [];
for (const actor of ACCOUNT_BLOCK_READS) {
  if (!accountBlockReadsSeen.has(actor)) {
    failures.push("Actor-scoped growth_channel_blocks query for " + actor +
      " is missing or no longer carries its exact signed-in identity, selected column and 501-row safety bound.");
  }
}


// Track the matched entry itself: two reasons for the same file/table must
// independently match. A surviving public lookup cannot hide a stale follower
// lookup exemption.
// Two-sided, like every other recorded list in this repository. An entry that
// exempted no call in this run is describing something that is no longer there --
// and a wrong reason inside an exemption is worse than no exemption, because it is
// what the next person reads instead of checking.
for (const entry of READ_WITHOUT_ORGANIZATION) {
  if (!exemptionsUsed.has(entry)) {
    failures.push(
      `READ_WITHOUT_ORGANIZATION records ${entry.table} in ${entry.file} as read without an organization on purpose, ` +
      `and no call in this run matched it while carrying ${entry.requires.join(" and ")}. Either the call moved, or it is ` +
      "now scoped and the entry should go. Its recorded reason: " + entry.reason
    );
  }
}
for (const entry of BLIND_QUERY_WITHOUT_ORGANIZATION) {
  if (!exemptionsUsed.has(entry)) {
    failures.push(
      `BLIND_QUERY_WITHOUT_ORGANIZATION records ${entry.file} as reading a public row without an organization, and no call ` +
      `in this run matched it while carrying ${entry.requires.join(" and ")}. Its recorded reason: ` + entry.reason
    );
  }
}

// The two registers.
//
// An entry in READ_WITHOUT_ORGANIZATION says an unscoped read is deliberate. It
// does not make the read possible: lib/sonara-tenant-guard.cjs wraps fetch and
// refuses any query on a tenant-scoped table that names no organization, unless
// one of its EXEMPT_PATTERNS admits that exact request. Until 2 October 2026 all
// seven entries here had no exemption there, so this report called those reads
// deliberate and safe while the guard refused every one of them and the public
// pages behind them answered 503. Both lists were right about safety; only one
// of them runs.
//
// So every table recorded here must have at least one runtime exemption. That is
// the table, not the exact query -- the guard pins each lookup's keys, values and
// columns, and the query here still carries its interpolations. Whether the
// exact request gets through is what
// tests/no-route-asks-for-what-the-guard-refuses.test.js answers, by sending it.
const runtimeExemptTables = new Set(EXEMPT_PATTERNS.map((exemption) => exemption.table));
if (!runtimeExemptTables.size) {
  failures.push(
    "lib/sonara-tenant-guard.cjs exports no EXEMPT_PATTERNS, so the cross-check between the two registers compared " +
    "against nothing. Either the export moved or the import broke; a pass in this state is the check measuring nothing."
  );
}
for (const entry of READ_WITHOUT_ORGANIZATION) {
  if (!runtimeExemptTables.has(entry.table)) {
    failures.push(
      `READ_WITHOUT_ORGANIZATION records ${entry.table} in ${entry.file} as read without an organization on purpose, ` +
      `and lib/sonara-tenant-guard.cjs has no exemption for ${entry.table} at all -- so the guard refuses that read in ` +
      "production and the route reports a failed read. Add a pinned EXEMPT_PATTERNS entry for the exact request, or " +
      "scope the query."
    );
  }
}

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
  `${counts.notTenantScoped} on tables that carry no organization, ${counts.readWithoutOrganization} read without one on purpose and recorded with the filter that stands in for it, ` +
  `${counts.unresolvedTable} whose table cannot be resolved statically ` +
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

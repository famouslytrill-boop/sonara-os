// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Review-only Creator SQL is a distinct lifecycle stage from an applied migration.
// These tables are expressly NOT counted as production-ready extension tables.
const PENDING_CREATOR_SCHEMA = Object.freeze([
  Object.freeze({ proposalTable: "creator_world_bibles",
    proposal: "docs/sql-proposals/creator-world-bibles-2026-10-09.sql",
    flag: "SONARA_CREATOR_WORLD_BIBLE_PERSISTENCE_ENABLED",
    adapter: "lib/sonara-world-bible-store.cjs" }),
  Object.freeze({ proposalTable: "creator_story_drafts",
    proposal: "docs/sql-proposals/creator-story-draft-revisions-2026-10-09.sql",
    flag: "SONARA_STORY_REVISION_PERSISTENCE_ENABLED",
    adapter: "lib/sonara-interactive-story-store.cjs" }),
  Object.freeze({ proposalTable: "creator_story_draft_revisions",
    proposal: "docs/sql-proposals/creator-story-draft-revisions-2026-10-09.sql",
    flag: "SONARA_STORY_REVISION_PERSISTENCE_ENABLED",
    adapter: "lib/sonara-interactive-story-store.cjs" })
]);

const CREATE = (table) => new RegExp(
  "\\bcreate\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?public\\." + table + "\\s*\\(", "i");
const RLS = (table) => new RegExp(
  "\\balter\\s+table\\s+public\\." + table + "\\s+enable\\s+row\\s+level\\s+security\\s*;", "i");
const REVOKE = (table) => new RegExp(
  "\\brevoke\\s+all\\s+on\\s+(?:table\\s+)?public\\." + table +
  "\\s+from\\s+public\\s*,\\s*anon\\s*,\\s*authenticated\\s*,\\s*service_role\\s*;", "i");

function inspectPendingCreatorSchema({ envExample, routeSource, migrationsSql,
  readProposal, readAdapter }) {
  if (typeof envExample !== "string" || typeof routeSource !== "string"
    || typeof migrationsSql !== "string" || typeof readProposal !== "function"
    || typeof readAdapter !== "function") throw new TypeError("Creator contract needs text and file readers");
  const errors = [];
  const names = new Set();
  // Real line delimiters, including CRLF. Never split on the literal sequence \\n.
  const envLines = envExample.split(/\r?\n/u);
  for (const item of PENDING_CREATOR_SCHEMA) {
    const { proposalTable: table, proposal, flag, adapter } = item;
    if (names.has(table)) { errors.push("duplicate proposal table " + table); continue; }
    names.add(table);
    const lines = envLines.filter((line) => line.startsWith(flag + "="));
    if (lines.length !== 1 || lines[0] !== flag + "=false")
      errors.push("Creator proposal " + table + " requires exactly one default-off flag " + flag);
    if (!routeSource.includes("process.env." + flag))
      errors.push("Creator proposal " + table + " has no runtime feature gate " + flag);
    let sql, adapterSource;
    try { sql = readProposal(proposal); } catch { sql = null; }
    try { adapterSource = readAdapter(adapter); } catch { adapterSource = null; }
    if (typeof sql !== "string" || !CREATE(table).test(sql)
      || !RLS(table).test(sql) || !REVOKE(table).test(sql))
      errors.push("Creator proposal " + table + " lacks its reviewed CREATE/RLS/revocation");
    if (CREATE(table).test(migrationsSql))
      errors.push("Creator proposal " + table + " has a real migration and requires reviewed-contract promotion");
    if (typeof adapterSource !== "string" || !adapterSource.includes('"' + table + '"'))
      errors.push("Creator proposal " + table + " lacks a server-side table reference");
  }
  if (names.size !== 3) errors.push("pending Creator schema inventory must contain exactly three tables");
  return errors;
}
module.exports = { PENDING_CREATOR_SCHEMA, inspectPendingCreatorSchema };

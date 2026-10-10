// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// The capability inventory traces handlers, but cannot follow dynamic Creator
// store objects through feature-gated route registration. These *source-backed*
// contracts name PROPOSED SQL dependencies, not live, approved migration tables.
// They must never count toward "active tables" or "ready for customers".
const PREFIX = "/api/creator-studio/projects/:id/world-bible";
const PAGE = "/creator-studio/projects/:id/world-bible";
const WORLD = "creator_world_bibles";
const DRAFT = "creator_story_drafts";
const HISTORY = "creator_story_draft_revisions";
const WORLD_FLAG = "SONARA_CREATOR_WORLD_BIBLE_PERSISTENCE_ENABLED";
const STORY_FLAG = "SONARA_STORY_REVISION_PERSISTENCE_ENABLED";
const records = [];
function planned(route, operation, { reads = [], writes = [], adapter, flag }) {
  records.push(Object.freeze({
    route, kind: "pending_database", operation,
    reads: Object.freeze([...reads]), writes: Object.freeze([...writes]),
    adapter, flag, reason: "The guarded Creator store accesses proposed, not migrated, private tables."
  }));
}
function local(route, kind, detail) {
  records.push(Object.freeze({
    route, kind, operation: kind, reads: Object.freeze([]), writes: Object.freeze([]),
    adapter: null, flag: null, reason: detail
  }));
}
const world = { reads: [WORLD], adapter: "lib/sonara-world-bible-store.cjs", flag: WORLD_FLAG };
planned(`GET ${PREFIX}`, "read", world);
planned(`GET ${PREFIX}/export/:format`, "read", world);
planned(`GET ${PREFIX}/export/markdown`, "read", world);
planned(`POST ${PREFIX}`, "write", { ...world, writes: [WORLD] });
planned(`POST ${PAGE}`, "write", { ...world, writes: [WORLD] });
planned(`POST ${PREFIX}/interactive/preview`, "read", world);
planned(`GET ${PREFIX}/interactive/draft`, "read", {
  reads: [WORLD, DRAFT], adapter: "lib/sonara-interactive-story-store.cjs", flag: STORY_FLAG
});
planned(`GET ${PREFIX}/interactive/revisions`, "read", {
  reads: [WORLD, HISTORY], adapter: "lib/sonara-interactive-story-store.cjs", flag: STORY_FLAG
});
planned(`GET ${PREFIX}/interactive/revisions/:revision`, "read", {
  reads: [WORLD, HISTORY], adapter: "lib/sonara-interactive-story-store.cjs", flag: STORY_FLAG
});
planned(`POST ${PREFIX}/interactive/draft`, "write", {
  reads: [WORLD, DRAFT], writes: [DRAFT, HISTORY],
  adapter: "lib/sonara-interactive-story-store.cjs", flag: STORY_FLAG
});
local("GET /creator-studio/worldbuilding", "rendered_form",
  "Renders the author-operated planner form; POST /creator-studio/worldbuilding computes a preview, not a persisted record.");
local("POST /creator-studio/worldbuilding", "deterministic_preview",
  "Parses author form fields, runs planWorldbuilding() and returns an unsaved HTML preview; no provider or database action.");
local("POST /api/creator/worldbuilding/plan", "deterministic_preview",
  "Runs planWorldbuilding() over author JSON and returns an unsaved response; no provider or database action.");

const CREATOR_ROUTE_DATA_CONTRACTS = Object.freeze(records);
const CONTRACT_BY_ROUTE = new Map(records.map(record => [record.route, record]));
const EXPECTED_TABLES = Object.freeze([WORLD, DRAFT, HISTORY]);

function inspectCreatorRouteDataContracts({ registeredRouteIds, pendingTables,
  creatorProjectRoutesSource, creatorPlannerRoutesSource, worldAdapter, storyAdapter }) {
  const problems = [];
  if (!Array.isArray(registeredRouteIds) || !Array.isArray(pendingTables))
    throw new TypeError("registered routes and pending SQL tables are required");
  const registered = new Set(registeredRouteIds);
  const allowed = new Set(pendingTables);
  if (CONTRACT_BY_ROUTE.size !== 13 || CREATOR_ROUTE_DATA_CONTRACTS.length !== 13)
    problems.push("Creator route data contracts must contain 13 unique routes");
  for (const table of EXPECTED_TABLES) if (!allowed.has(table))
    problems.push("Creator route table has no verified proposal-only schema: " + table);
  const sources = [creatorProjectRoutesSource, creatorPlannerRoutesSource, worldAdapter, storyAdapter];
  if (sources.some(source => typeof source !== "string")) throw new TypeError("exact source files are required");
  for (const item of records) {
    if (!registered.has(item.route)) problems.push("Creator route contract is unregistered: " + item.route);
    if (item.kind === "pending_database") {
      if (!item.reads.length) problems.push("pending route must name a read dependency: " + item.route);
      if (item.operation === "write" && !item.writes.length)
        problems.push("write route must identify proposed write tables: " + item.route);
      if (![WORLD_FLAG, STORY_FLAG].includes(item.flag)
        || !creatorProjectRoutesSource.includes("process.env." + item.flag))
        problems.push("pending route lacks disabled runtime flag: " + item.route);
      for (const table of [...item.reads, ...item.writes]) if (!allowed.has(table))
        problems.push("pending route names unreviewed schema: " + item.route + " " + table);
      const adapterSource = item.adapter.includes("world-bible-store") ? worldAdapter : storyAdapter;
      if (![...item.reads, ...item.writes].some(table => adapterSource.includes('"' + table + '"')))
        problems.push("pending route's chosen adapter is unrelated to its tables: " + item.route);
      if ((item.reads.includes(DRAFT) || item.reads.includes(HISTORY) || item.writes.includes(DRAFT))
        && (!storyAdapter.includes('"' + DRAFT + '"') || !storyAdapter.includes('"' + HISTORY + '"')))
        problems.push("story adapter lacks both current and history references: " + item.route);
    }
  }
  if (!creatorPlannerRoutesSource.includes('app.get("/creator-studio/worldbuilding"')
    || !creatorPlannerRoutesSource.includes('app.post("/creator-studio/worldbuilding"')
    || !creatorPlannerRoutesSource.includes('app.post("/api/creator/worldbuilding/plan"')
    || !creatorPlannerRoutesSource.includes("planWorldbuilding(req.body)"))
    problems.push("unsaved planner route source proof is missing");
  return problems;
}
module.exports = { CREATOR_ROUTE_DATA_CONTRACTS, CONTRACT_BY_ROUTE,
  EXPECTED_TABLES, inspectCreatorRouteDataContracts };

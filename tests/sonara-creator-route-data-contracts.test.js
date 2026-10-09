// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { CREATOR_ROUTE_DATA_CONTRACTS, CONTRACT_BY_ROUTE, EXPECTED_TABLES,
  inspectCreatorRouteDataContracts } = require("../lib/sonara-creator-route-data-contracts.cjs");
const { PENDING_CREATOR_SCHEMA } = require("../lib/sonara-pending-creator-schema-contract.cjs");
const ROOT = path.join(__dirname, "..");
function source(name) { return fs.readFileSync(path.join(ROOT, name), "utf8"); }
function valid() {
  return {
    registeredRouteIds: CREATOR_ROUTE_DATA_CONTRACTS.map(x=>x.route),
    pendingTables: PENDING_CREATOR_SCHEMA.map(x=>x.table),
    creatorProjectRoutesSource: source("routes/sonara-creator-project-routes.cjs"),
    creatorPlannerRoutesSource: source("routes/creator-music-system-readonly.cjs"),
    worldAdapter: source("lib/sonara-world-bible-store.cjs"),
    storyAdapter: source("lib/sonara-interactive-story-store.cjs")
  };
}
describe("Creator worldbuilding source-backed route data contracts", () => {
  it("accounts for all 13 routes, ten proposed-storage paths and three unsaved planner paths", () => {
    assert.equal(CONTRACT_BY_ROUTE.size, 13);
    assert.equal(CREATOR_ROUTE_DATA_CONTRACTS.filter(x=>x.kind === "pending_database").length, 10);
    assert.equal(CREATOR_ROUTE_DATA_CONTRACTS.filter(x=>x.kind !== "pending_database").length, 3);
    assert.deepEqual(EXPECTED_TABLES, ["creator_world_bibles", "creator_story_drafts",
      "creator_story_draft_revisions"]);
    assert.deepEqual(inspectCreatorRouteDataContracts(valid()), []);
  });
  it("does not mistake a metadata export for a generated production asset", () => {
    const markdown = CONTRACT_BY_ROUTE.get(
      "GET /api/creator-studio/projects/:id/world-bible/export/markdown");
    assert.equal(markdown.kind, "pending_database");
    assert.deepEqual(markdown.reads, ["creator_world_bibles"]);
    assert.deepEqual(markdown.writes, []);
    const planner = CONTRACT_BY_ROUTE.get("POST /api/creator/worldbuilding/plan");
    assert.equal(planner.kind, "deterministic_preview");
    assert.deepEqual(planner.reads, []);
    assert.deepEqual(planner.writes, []);
    const save = CONTRACT_BY_ROUTE.get(
      "POST /api/creator-studio/projects/:id/world-bible/interactive/draft");
    assert.deepEqual(save.writes, ["creator_story_drafts", "creator_story_draft_revisions"]);
    assert.ok(save.reads.includes("creator_world_bibles"));
    assert.ok(save.flag.includes("REVISION_PERSISTENCE"));
  });
  it("fails on a missing route registration or absent SQL proposal", () => {
    const cfg = valid();
    const bad = inspectCreatorRouteDataContracts({ ...cfg,
      registeredRouteIds: cfg.registeredRouteIds.slice(1) });
    assert.equal(bad.length, 1);
    assert.match(bad[0], /unregistered/);
    assert.ok(inspectCreatorRouteDataContracts({ ...cfg,
      pendingTables: cfg.pendingTables.filter(x=>x!=="creator_story_draft_revisions") })
      .some(x=>x.includes("no verified proposal-only schema")));
  });
  it("fails if the server loses the feature guard or a required storage adapter", () => {
    const cfg = valid();
    assert.ok(inspectCreatorRouteDataContracts({ ...cfg,
      creatorProjectRoutesSource: cfg.creatorProjectRoutesSource.replace(
        "process.env.SONARA_STORY_REVISION_PERSISTENCE_ENABLED", "process.env.OFF") })
      .some(x=>x.includes("lacks disabled runtime flag")));
    assert.ok(inspectCreatorRouteDataContracts({ ...cfg,
      storyAdapter: cfg.storyAdapter.replace('"creator_story_draft_revisions"', '"missing_history"') })
      .some(x=>x.includes("story adapter lacks both")));
  });
  it("holds unsaved-planner labels to the actual route and pure compute source", () => {
    const cfg = valid();
    assert.ok(inspectCreatorRouteDataContracts({ ...cfg,
      creatorPlannerRoutesSource: cfg.creatorPlannerRoutesSource.replace(
        'app.post("/api/creator/worldbuilding/plan"', 'app.post("/api/creator/worldbuilding/retired"') })
      .includes("unsaved planner route source proof is missing"));
    assert.ok(inspectCreatorRouteDataContracts({ ...cfg,
      creatorPlannerRoutesSource: cfg.creatorPlannerRoutesSource.replace(
        "planWorldbuilding(req.body)", "legacyRun(req.body)") })
      .includes("unsaved planner route source proof is missing"));
  });
});

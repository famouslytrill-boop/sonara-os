"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const migrationPath = path.join(
  __dirname,
  "../supabase/migrations/20260726170000_requested_repository_catalog.sql"
);

const EXPECTED_TOOL_KEYS = [
  "openhands",
  "caveman",
  "agency_agents",
  "meetily",
  "officecli",
  "openwiki",
  "omniroute_unverified",
  "strix",
  "asi_agent_skills",
  "awesome_design_md_unverified"
];

describe("requested repository Supabase catalog migration", () => {
  const migration = fs.readFileSync(migrationPath, "utf8");

  it("seeds all requested repository records", () => {
    for (const key of EXPECTED_TOOL_KEYS) {
      assert.match(migration, new RegExp(`\\('${key}'`), `${key} must be cataloged`);
    }
  });

  it("keeps every external runtime disabled", () => {
    assert.doesNotMatch(migration, /"production_enabled"\s*:\s*true/);
    assert.doesNotMatch(migration, /"execution_enabled"\s*:\s*true/);
    assert.match(migration, /omniroute_unverified[\s\S]*?'disabled'[\s\S]*?'disabled'/);
    assert.match(migration, /awesome_design_md_unverified[\s\S]*?'disabled'[\s\S]*?'disabled'/);
  });

  it("stores no credential values or executable install commands", () => {
    assert.doesNotMatch(migration, /Bearer\s+[A-Za-z0-9._-]+/);
    assert.doesNotMatch(migration, /(API_KEY|SECRET|TOKEN)\s*=/i);
    assert.doesNotMatch(migration, /curl\s+[^\n|]+\|\s*(bash|sh)/i);
  });

  it("records source correction and authorization boundaries", () => {
    assert.match(migration, /msitarzewski\/agency-agents/);
    assert.match(migration, /iOfficeAI\/OfficeCLI/);
    assert.match(migration, /langchain-ai\/openwiki/);
    assert.match(migration, /usestrix\/strix/);
    assert.match(migration, /authorized_targets_only/);
    assert.match(migration, /bulk_install_allowed"\s*:\s*false/);
  });
});

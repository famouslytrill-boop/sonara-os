// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { PENDING_CREATOR_SCHEMA, inspectPendingCreatorSchema } =
  require("../lib/sonara-pending-creator-schema-contract.cjs");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
function fixture() {
  return {
    envExample: read(".env.example"),
    routeSource: read("routes/sonara-creator-project-routes.cjs"),
    // Migration status is tested independently by the full DB verifier. Our
    // unit fixture begins with no migration, then mutates the input.
    migrationsSql: "",
    readProposal: read, readAdapter: read
  };
}
describe("Creator proposal-only database contract (unapplied and default-off)", () => {
  it("checks the three named proposals against real source, flags, RLS, and grants", () => {
    assert.deepEqual(PENDING_CREATOR_SCHEMA.map(x=>x.proposalTable),
      ["creator_world_bibles", "creator_story_drafts", "creator_story_draft_revisions"]);
    assert.deepEqual(inspectPendingCreatorSchema(fixture()), []);
  });
  it("never mislabels unexecuted proposal metadata as a live table declaration", () => {
    const moduleSource = read("lib/sonara-pending-creator-schema-contract.cjs");
    // Must agree with the conservative declaration detector in
    // tests/every-declared-table-exists.test.js. That test still rejects every
    // *runtime* table absent from migrations; we do not add an exemption.
    const declarations = [...moduleSource.matchAll(/\\btable:\\s*["']([a-z][a-z0-9_]{2,})["']/g)];
    assert.deepEqual(declarations, []);
    assert.equal(PENDING_CREATOR_SCHEMA.every((item) =>
      typeof item.proposalTable === "string" && !Object.hasOwn(item, "table")), true);
  });
  it("accepts Windows and Unix line endings but never literal escaped line breaks", () => {
    const base = fixture();
    assert.deepEqual(inspectPendingCreatorSchema({
      ...base, envExample: base.envExample.replace(/\n/g, "\r\n") }), []);
    assert.deepEqual(inspectPendingCreatorSchema({
      ...base, envExample: base.envExample.replace(/\n/g, "\\n") }).length > 0, true);
  });
  it("fails for enabled or duplicated flags, and for a removed route gate", () => {
    const base = fixture();
    const flag = "SONARA_STORY_REVISION_PERSISTENCE_ENABLED";
    assert.ok(inspectPendingCreatorSchema({ ...base,
      envExample: base.envExample.replace(flag + "=false", flag + "=true") }).length > 0);
    assert.ok(inspectPendingCreatorSchema({ ...base,
      envExample: base.envExample + "\n" + flag + "=false\n" }).length > 0);
    assert.ok(inspectPendingCreatorSchema({ ...base,
      routeSource: base.routeSource.replace("process.env." + flag,
        "process.env.STORY_PROPOSAL_UNAVAILABLE") }).length > 0);
  });
  it("fails for missing files, lost RLS, grant revocation, or adapter references", () => {
    const base = fixture();
    assert.ok(inspectPendingCreatorSchema({ ...base,
      readProposal: (file) => file.includes("world-bibles") ? null : base.readProposal(file)
    }).length > 0);
    assert.ok(inspectPendingCreatorSchema({ ...base,
      readProposal: (file) => base.readProposal(file)
        .replace("alter table public.creator_world_bibles enable row level security;", "")
    }).length > 0);
    assert.ok(inspectPendingCreatorSchema({ ...base,
      readProposal: (file) => base.readProposal(file)
        .replace("revoke all on public.creator_story_drafts from public, anon, authenticated, service_role;", "")
    }).length > 0);
    assert.ok(inspectPendingCreatorSchema({ ...base,
      readAdapter: (file) => file.includes("interactive-story-store") ? "" : base.readAdapter(file)
    }).length > 0);
  });
  it("refuses to recognize a proposal as pending after its CREATE enters migration authority", () => {
    const base = fixture();
    const failure = inspectPendingCreatorSchema({ ...base,
      migrationsSql: "CREATE TABLE public.creator_story_drafts(id uuid);" });
    assert.ok(failure.some(x=>x.includes("requires reviewed-contract promotion")));
  });
});

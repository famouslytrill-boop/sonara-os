// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const assert = require("node:assert/strict");
const { createWorldBibleStore, normalizedDraft } = require("../lib/sonara-world-bible-store.cjs");
const { renderWorldBibleMarkdown } = require("../lib/sonara-world-bible-export.cjs");
const PID = "00000000-0000-4000-8000-000000000010";
const ORG = "00000000-0000-4000-8000-000000000001";
const OTHER = "00000000-0000-4000-8000-000000000002";
const draft = () => ({
  title: "A new world", medium: "game",
  entities: [{ id: "hero", kind: "character", name: "Original hero" }],
  scenes: [{ id: "one", title: "Start", entityIds: ["hero"], durationSeconds: 42 }],
  resources: { gameTickHz: 60 }
});
function harness() {
  const rows = [];
  const calls = [];
  let offline = false;
  let corrupted = false;
  function response(status, data) { return { ok: status >= 200 && status < 300, status, json: async () => data }; }
  const projectStore = { async get(req, id) {
    if (id !== PID || req.organizationId !== ORG) return { ok: false, status: 404, code: "project_not_found" };
    return { ok: true, project: { id, archived_at: req.archived ? new Date().toISOString() : null },
      ctx: { organizationId: ORG, user: { id: req.userId }, config: { url: "https://database.invalid", secret: "KEEP_PRIVATE" } } };
  } };
  async function fetch(url, options) {
    const parsed = new URL(url);
    assert.equal(parsed.pathname, "/rest/v1/creator_world_bibles");
    assert.equal(parsed.searchParams.get("organization_id"), "eq." + ORG);
    if (options.method !== "POST") assert.equal(parsed.searchParams.get("project_id"), "eq." + PID);
    calls.push({ method: options.method || "GET", url });
    if (offline) return null;
    const row = rows.find((x) => x.organization_id === ORG && x.project_id === PID);
    if (!options.method || options.method === "GET") return response(200, row ? [corrupted ? { ...row, fingerprint: "broken" } : row] : []);
    const body = JSON.parse(options.body);
    if (options.method === "POST") {
      if (row) return response(409, {});
      assert.equal(body.organization_id, ORG);
      assert.equal(body.project_id, PID);
      rows.push(body);
      return response(201, [body]);
    }
    if (options.method === "PATCH") {
      assert.equal(parsed.searchParams.get("revision"), "eq." + String(row?.revision));
      if (!row) return response(200, []);
      Object.assign(row, body);
      return response(200, [row]);
    }
    throw Error("unexpected method");
  }
  return { rows, calls,
    req: { organizationId: ORG, userId: "00000000-0000-4000-8000-000000000099" },
    store: createWorldBibleStore({ projectStore, supabaseHeaders: () => ({ apikey: "SERVER_ONLY" }), fetch }),
    offline: () => { offline = true; }, corrupted: () => { corrupted = true; } };
}

describe("Creator World Bible storage phase 2", () => {
  it("exports an author-editable outline, not HTML or rendered media", () => {
    const unsafe = draft();
    unsafe.title = "<script>alert(1)</script>";
    unsafe.entities[0].name = "<img src=x>";
    const output = renderWorldBibleMarkdown({ draft: unsafe });
    assert.equal(output.extension, "md");
    assert.match(output.data, /## Ordered story beats/);
    assert.match(output.data, /Preview fingerprint:/);
    assert.doesNotMatch(output.data, /<script>/);
    assert.doesNotMatch(output.data, /<img src=/);
    assert.match(output.data, /Publishing: not authorized/);
  });

  it("strips untrusted/secret keys and stores only declared world data", () => {
    const input = draft();
    input.serviceRoleKey = "SECRET";
    input.scenes[0].externalProviderToken = "SECRET";
    input.entities[0].owner_id = OTHER;
    input.resources.secret = "SECRET";
    const n = normalizedDraft(input);
    assert.equal(n.ok, true);
    assert.equal(JSON.stringify(n.draft).includes("SECRET"), false);
    assert.equal(JSON.stringify(n.draft).includes("owner_id"), false);
    assert.match(n.fingerprint, /^[a-f0-9]{64}$/);
  });
  it("creates and CAS-updates tenant-linked project data, with no server context leak", async () => {
    const h = harness();
    const created = await h.store.save(h.req, PID, { expectedRevision: 0, draft: draft() });
    assert.equal(created.ok, true);
    assert.equal(created.worldBible.revision, 1);
    assert.equal(JSON.stringify(created).includes("KEEP_PRIVATE"), false);
    assert.equal((await h.store.get(h.req, PID)).worldBible.fingerprint, created.worldBible.fingerprint);
    const updated = await h.store.save(h.req, PID, {
      expectedRevision: 1, draft: { ...draft(), title: "Second revision" }
    });
    assert.equal(updated.worldBible.revision, 2);
    assert.equal((await h.store.save(h.req, PID, { expectedRevision: 1, draft: draft() })).code, "world_bible_revision_conflict");
    assert.ok(h.calls.filter((call) => call.method === "PATCH").every((call) => call.url.includes("revision=eq.1")));
  });
  it("rejects cross-org access and archived project modifications before any write", async () => {
    const h = harness();
    assert.equal((await h.store.get({ ...h.req, organizationId: OTHER }, PID)).status, 404);
    assert.equal((await h.store.save({ ...h.req, organizationId: OTHER }, PID, { expectedRevision: 0, draft: draft() })).status, 404);
    assert.equal((await h.store.save({ ...h.req, archived: true }, PID, { expectedRevision: 0, draft: draft() })).code, "project_archived");
    assert.equal(h.rows.length, 0);
  });
  it("fails closed on malformed records and unavailable storage", async () => {
    const h = harness();
    assert.equal((await h.store.save(h.req, PID, { draft: draft() })).code, "expected_revision_required");
    assert.equal((await h.store.save(h.req, PID, { expectedRevision: 0, draft: { ...draft(), medium: "untrusted" } })).status, 400);
    await h.store.save(h.req, PID, { expectedRevision: 0, draft: draft() });
    h.corrupted();
    assert.equal((await h.store.get(h.req, PID)).code, "world_bible_storage_invalid");
    h.offline();
    assert.equal((await h.store.get(h.req, PID)).status, 503);
  });
});

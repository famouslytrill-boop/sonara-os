// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const { canonicalSource, createCreatorWorldBibleStore } = require("../lib/sonara-creator-world-bible-store.cjs");
const registerWorld = require("../routes/sonara-creator-world-bible-routes.cjs");
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const source = () => ({ title: "Original Series", medium: "podcast",
  entities: [{ id: "lead", kind: "character", name: "Lead" }],
  scenes: [{ id: "opening", title: "Pilot", entityIds: ["lead"], durationSeconds: 60 }],
  resources: { sampleRateHz: 48000, channels: 2, bitDepth: 16 } });

function harness() {
  const projectId = id(10);
  const table = new Map();
  const calls = [];
  let archived = false;
  let failNetwork = false;
  let conflict = false;
  const store = {
    async get(req, project) {
      if (project !== projectId) return { ok: false, status: 404, code: "project_not_found", message: "Missing." };
      if (req.sonaraAccess?.user?.id === id(99))
        return { ok: false, status: 404, code: "project_not_found", message: "Missing." };
      const tenant = req.sonaraAccess?.user?.id === id(2) ? id(22) : id(1);
      if (tenant !== id(1)) return { ok: false, status: 404, code: "project_not_found", message: "Missing." };
      return { ok: true, project: { id: projectId, title: "Original Series", medium: "audio",
        revision: 2, archived_at: archived ? "2026-10-09T10:00:00.000Z" : null },
      ctx: { user: { id: req.sonaraAccess.user.id }, organizationId: tenant,
        config: { url: "https://db.example.invalid", serviceKey: "NEVER_SHOW_SECRET" } } };
    }
  };
  async function backend(url, options) {
    const parsed = new URL(url);
    const q = parsed.searchParams;
    calls.push({ url, options });
    assert.equal(parsed.pathname, "/rest/v1/creator_world_bibles");
    assert.equal(q.get("organization_id"), `eq.${id(1)}`);
    assert.equal(q.get("project_id"), `eq.${projectId}`);
    if (failNetwork) throw new Error("network unavailable");
    if (options.method === "GET") return { ok: true, json: async () => table.has(projectId) ? [structuredClone(table.get(projectId))] : [] };
    const data = JSON.parse(options.body);
    assert.ok(!JSON.stringify(data).includes("NEVER_SHOW_SECRET"));
    if (options.method === "POST") {
      assert.equal(data.organization_id, id(1));
      assert.equal(data.created_by, id(3));
      if (table.has(projectId)) return { ok: false, status: 409 };
      table.set(projectId, { project_id: projectId, revision: 1, source: data.source, updated_at: "2026-10-09" });
      return { ok: true, json: async () => [structuredClone(table.get(projectId))] };
    }
    assert.equal(options.method, "PATCH");
    if (conflict) {
      conflict = false;
      const old = table.get(projectId); table.set(projectId, { ...old, revision: old.revision + 1 });
    }
    const match = Number(q.get("revision")?.slice(3));
    if (!table.has(projectId) || table.get(projectId).revision !== match)
      return { ok: true, json: async () => [] };
    table.set(projectId, { project_id: projectId, revision: data.revision, source: data.source, updated_at: "2026-10-09" });
    return { ok: true, json: async () => [structuredClone(table.get(projectId))] };
  }
  const worldStore = createCreatorWorldBibleStore({ projectStore: store, supabaseHeaders: () => ({ authorization: "server-only" }), fetch: backend });
  const req = (user = id(3)) => ({ sonaraAccess: { user: { id: user } } });
  return { projectId, table, calls, store, worldStore, req, setArchived: () => { archived = true; },
    failNetwork: () => { failNetwork = true; }, triggerRace: () => { conflict = true; } };
}
function routeApp(h, enabled = true) {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use((req, _res, next) => { req.sonaraAccess = { user: { id: id(req.get("x-other-tenant") ? 2 : 3) } }; next(); });
  registerWorld(app, { projectStore: h.store, worldBibleStore: h.worldStore,
    worldStorageEnabled: enabled, supabaseHeaders: () => ({}),
    requirePaidOrOwnerAccess: () => (req, res, next) => req.get("x-authorized") === "yes" ? next() : res.sendStatus(403),
    layout: ({ title, body, sections }) => `<html><title>${title}</title><main>${body}${sections.join("")}</main></html>`,
    brandCard: (heading, detail) => `<p>${heading}: ${detail}</p>`,
    linkAction: (href, title) => `<a href="${href}">${title}</a>`,
    escapeHtml: (t) => String(t).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]))
  });
  return app;
}
describe("Creator Project World Bible persistent storage", () => {
  it("normalizes allowed fields, rechecks hash and ignores client-supplied authority markers", () => {
    const input = { ...source(), tenantId: id(99), rightsCleared: true, approvedBy: id(99),
      entities: [{ ...source().entities[0], secretKey: "discard" }] };
    const result = canonicalSource(input);
    assert.equal(result.ok, true);
    assert.equal(result.source.rightsCleared, undefined);
    assert.equal(result.source.tenantId, undefined);
    assert.equal(result.source.entities[0].secretKey, undefined);
    assert.equal(result.blueprint.publishesAutomatically, false);
    assert.equal(result.blueprint.rightsCleared, false);
    assert.equal(canonicalSource(result.source).blueprint.sha256, result.blueprint.sha256);
    assert.equal(canonicalSource({ ...source(), scenes: [{ id: "bad", title: "Bad", entityIds: ["foreign"] }] }).ok, false);
  });
  it("creates once, saves successive revisions and detects stale and duplicate writes", async () => {
    const h = harness();
    assert.equal((await h.worldStore.get(h.req(), h.projectId)).status, 404);
    const first = await h.worldStore.save(h.req(), h.projectId, { expectedRevision: 0, source: source() });
    assert.equal(first.ok, true); assert.equal(first.revision, 1);
    assert.equal((await h.worldStore.save(h.req(), h.projectId, { expectedRevision: 0, source: source() })).code, "revision_conflict");
    const updated = await h.worldStore.save(h.req(), h.projectId, { expectedRevision: 1, source: { ...source(), title: "Updated" } });
    assert.equal(updated.revision, 2);
    assert.equal(updated.blueprint.title, "Updated");
    assert.equal((await h.worldStore.save(h.req(), h.projectId, { expectedRevision: 1, source: source() })).status, 409);
    assert.equal((await h.worldStore.get(h.req(), h.projectId)).source.title, "Updated");
  });
  it("refuses cross-tenant and missing-project access before any data operation", async () => {
    const h = harness();
    const denied = await h.worldStore.save(h.req(id(2)), h.projectId, { expectedRevision: 0, source: source() });
    assert.equal(denied.status, 404);
    assert.equal(h.calls.length, 0);
    assert.equal((await h.worldStore.get(h.req(), id(99))).status, 404);
    assert.equal(h.calls.length, 0);
  });
  it("prevents editing archived projects and rejects a concurrent compare-and-swap race", async () => {
    const h = harness();
    await h.worldStore.save(h.req(), h.projectId, { expectedRevision: 0, source: source() });
    h.triggerRace();
    assert.equal((await h.worldStore.save(h.req(), h.projectId, { expectedRevision: 1, source: source() })).code, "revision_conflict");
    h.setArchived();
    assert.equal((await h.worldStore.save(h.req(), h.projectId, { expectedRevision: 2, source: source() })).code, "project_archived");
  });
  it("fails closed on bad input, unverifiable DB answers and missing network", async () => {
    const h = harness();
    assert.equal((await h.worldStore.save(h.req(), h.projectId, { expectedRevision: -1, source: source() })).status, 400);
    const bad = { ...source(), resources: { expectedViewers: "all" } };
    assert.equal((await h.worldStore.save(h.req(), h.projectId, { expectedRevision: 0, source: bad })).status, 400);
    h.failNetwork();
    assert.equal((await h.worldStore.get(h.req(), h.projectId)).status, 503);
  });
});
describe("Creator World Bible guarded HTTP endpoints", () => {
  const data = () => ({ expectedRevision: 0, source: source() });
  const authorized = (agent) => agent.set("x-authorized", "yes");
  it("keeps its feature flag off by default and returns an honest setup-required response", async () => {
    const h = harness(), app = routeApp(h, false);
    assert.equal((await authorized(request(app).get(`/api/creator-studio/projects/${h.projectId}/world`))).status, 503);
    assert.equal((await authorized(request(app).get(`/creator-studio/projects/${h.projectId}/world`))).status, 503);
    assert.equal(h.calls.length, 0);
  });
  it("enforces auth and JSON-only intent for saves", async () => {
    const h = harness(), app = routeApp(h);
    const path = `/api/creator-studio/projects/${h.projectId}/world`;
    assert.equal((await request(app).put(path).set("x-sonara-intent", "world-bible-save").send(data())).status, 403);
    assert.equal((await authorized(request(app).put(path)).send(data())).status, 415);
    assert.equal((await authorized(request(app).put(path)).set("x-sonara-intent", "world-bible-save").send(data())).status, 200);
    assert.equal((await authorized(request(app).get(path))).status, 200);
    assert.equal((await authorized(request(app).get(path)).set("x-other-tenant", "yes")).status, 404);
  });
  it("serves editable and HTML-escaped JSON without revealing server credentials", async () => {
    const h = harness(), app = routeApp(h);
    const path = `/creator-studio/projects/${h.projectId}/world`;
    const result = await authorized(request(app).get(path));
    assert.equal(result.status, 200);
    assert.match(result.text, /data-world-bible-form/);
    assert.match(result.headers["cache-control"], /no-store/);
    assert.doesNotMatch(result.text, /NEVER_SHOW_SECRET/);
  });
});

// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const register = require("../routes/sonara-creator-project-routes.cjs");
const PID = "00000000-0000-4000-8000-000000000099";
const UID = "00000000-0000-4000-8000-000000000001";
const ORG = "00000000-0000-4000-8000-000000000002";
function setup(enabled = true) {
  const rows = [];
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (x) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[x]));
  const db = { get: async (req, id) => {
    if (id !== PID || req.get("x-workspace") === "other") return { ok: false, status: 404, code: "project_not_found" };
    return { ok: true, project: { id, archived_at: req.get("x-archived") ? "2026-10-09T00:00:00Z" : null },
      ctx: { organizationId: ORG, user: { id: UID }, config: { url: "https://db.example", serviceKey: "PRIVATE_SECRET" } } };
  } };
  async function fetch(url, opts = {}) {
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get("organization_id"), "eq." + ORG);
    const existing = rows[0];
    if (!opts.method) return { ok: true, status: 200, json: async () => existing ? [existing] : [] };
    const payload = JSON.parse(opts.body);
    if (opts.method === "POST") {
      if (existing) return { ok: false, status: 409 };
      rows.push(payload);
    } else if (opts.method === "PATCH") {
      if (existing?.revision !== Number(parsed.searchParams.get("revision").slice(3))) {
        return { ok: true, status: 200, json: async () => [] };
      }
      Object.assign(existing, payload);
    }
    return { ok: true, status: 200, json: async () => [rows[0]] };
  }
  register(app, {
    projectStore: db, supabaseHeaders: () => ({ apikey: "PRIVATE_SECRET" }), fetch,
    worldBiblePersistenceEnabled: enabled,
    requirePaidOrOwnerAccess: () => (req, res, next) => req.get("x-paid") ? next() : res.status(403).json({ ok: false }),
    wantsJson: () => true, escapeHtml: esc,
    brandCard: (name, body) => `<article>${esc(name)} ${esc(body)}</article>`,
    linkAction: (url, title) => `<a href="${esc(url)}">${esc(title)}</a>`,
    layout: ({ title, body, sections = [] }) => `<!doctype html><title>${esc(title)}</title><p>${esc(body)}</p>${sections.join("")}`
  });
  return { app, rows };
}
const draft = { title: "Draft", medium: "film", entities: [], scenes: [{ id: "one", title: "Opening", durationSeconds: 60 }], resources: {} };

describe("Feature-gated Creator World Bible project routes", () => {
  it("fails closed when turned off and always requires the existing creator guard", async () => {
    const { app } = setup(false);
    assert.equal((await request(app).get(`/api/creator-studio/projects/${PID}/world-bible`)).status, 403);
    const off = await request(app).get(`/api/creator-studio/projects/${PID}/world-bible`).set("x-paid", "yes");
    assert.equal(off.status, 503);
    assert.equal(off.body.code, "world_bible_migration_not_verified");
  });
  it("saves through the canonical project gate and returns no credential strings", async () => {
    const { app, rows } = setup(true);
    const endpoint = `/api/creator-studio/projects/${PID}/world-bible`;
    const denied = await request(app).post(endpoint).set("x-paid", "yes").set("x-workspace", "other").send({ expectedRevision: 0, draft });
    assert.equal(denied.status, 404);
    const saved = await request(app).post(endpoint).set("x-paid", "yes").send({ expectedRevision: 0, draft });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.worldBible.revision, 1);
    assert.equal(JSON.stringify(saved.body).includes("PRIVATE_SECRET"), false);
    assert.equal(rows.length, 1);
    const stale = await request(app).post(endpoint).set("x-paid", "yes").send({ expectedRevision: 0, draft });
    assert.equal(stale.status, 409);
    const archived = await request(app).post(endpoint).set("x-paid", "yes").set("x-archived", "yes").send({ expectedRevision: 1, draft });
    assert.equal(archived.status, 409);
    const found = await request(app).get(endpoint).set("x-paid", "yes");
    assert.equal(found.status, 200);
    assert.equal(found.body.worldBible.draft.title, "Draft");
    assert.match(found.headers["cache-control"], /no-store/);
  });
  it("provides a private JSON editor that escapes stored text and refuses malformed input", async () => {
    const { app } = setup(true);
    const endpoint = `/creator-studio/projects/${PID}/world-bible`;
    const initial = await request(app).get(endpoint).set("x-paid", "yes");
    assert.equal(initial.status, 200);
    assert.match(initial.text, /name="expectedRevision"/);
    assert.match(initial.headers["cache-control"], /no-store/);
    const malformed = await request(app).post(endpoint).set("x-paid", "yes")
      .type("form").send({ expectedRevision: "0", draft: "{broken" });
    assert.equal(malformed.status, 400);
    const posted = await request(app).post(endpoint).set("x-paid", "yes").type("form")
      .send({ expectedRevision: "0", draft: JSON.stringify({ ...draft, title: "<script>x</script>" }) });
    assert.equal(posted.status, 303);
    const read = await request(app).get(endpoint).set("x-paid", "yes");
    assert.doesNotMatch(read.text, /<script>x<\/script>/);
    assert.match(read.text, /&lt;script&gt;/);
  });
});

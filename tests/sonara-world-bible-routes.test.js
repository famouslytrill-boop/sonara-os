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
    const md = await request(app).get(`${endpoint}/export/markdown`).set("x-paid", "yes");
    assert.equal(md.status, 200);
    assert.match(md.headers["content-disposition"], /attachment/);
    assert.match(md.text, /Ordered story beats/);
    assert.match(md.headers["cache-control"], /no-store/);
    assert.equal((await request(app).get(`${endpoint}/export/markdown`)).status, 403);
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
  it("rejects cross-site World Bible form and API writes before reaching the database", async () => {
    const { app, rows } = setup(true);
    const endpoint = `/api/creator-studio/projects/${PID}/world-bible`;
    const malicious = await request(app).post(endpoint).set("x-paid", "yes")
      .set("Origin", "https://attacker.example").send({ expectedRevision: 0, draft });
    assert.equal(malicious.status, 403);
    assert.equal(malicious.body.code, "cross_origin_world_write_denied");
    const sameSiteSubdomain = await request(app).post(endpoint).set("x-paid", "yes")
      .set("Sec-Fetch-Site", "same-site").send({ expectedRevision: 0, draft });
    assert.equal(sameSiteSubdomain.status, 403);
    const forgedForm = await request(app).post(`/creator-studio/projects/${PID}/world-bible`)
      .set("x-paid", "yes").set("Sec-Fetch-Site", "cross-site").type("form")
      .send({ expectedRevision: "0", draft: JSON.stringify(draft) });
    assert.equal(forgedForm.status, 403);
    assert.equal(rows.length, 0);
  });

  it("downloads private CSV, OTIO gap placeholders and marker-only MIDI from one saved World Bible", async () => {
    const { app } = setup(true);
    const base = `/api/creator-studio/projects/${PID}/world-bible`;
    const saved = await request(app).post(base).set("x-paid", "yes")
      .send({ expectedRevision: 0, draft });
    assert.equal(saved.status, 200);
    const cue = await request(app).get(`${base}/export/csv`).set("x-paid", "yes");
    assert.equal(cue.status, 200);
    assert.match(cue.headers["content-disposition"], /world-bible-.*\.csv/);
    assert.match(cue.text, /"Opening"/);
    assert.match(cue.headers["cache-control"], /no-store/);
    const otio = await request(app).get(`${base}/export/otio?fps=30`).set("x-paid", "yes");
    assert.equal(otio.status, 200);
    const timeline = typeof otio.body === "object" && otio.body?.OTIO_SCHEMA
      ? otio.body : JSON.parse(otio.text || Buffer.from(otio.body).toString("utf8"));
    assert.equal(timeline.OTIO_SCHEMA, "Timeline.1");
    assert.equal(timeline.tracks.children[0].children[0].OTIO_SCHEMA, "Gap.1");
    assert.equal(timeline.tracks.children[0].children[0].source_range.duration.value, 1800);
    const readyPage = await request(app).get(`/creator-studio/projects/${PID}/world-bible`).set("x-paid", "yes");
    assert.match(readyPage.text, /world-bible\/export\/otio/);
    assert.match(readyPage.text, /world-bible\/export\/midi/);
    const midi = await request(app).get(`${base}/export/midi`).set("x-paid", "yes");
    assert.equal(midi.status, 200);
    assert.equal(Buffer.from(midi.body).toString("ascii", 0, 4), "MThd");
    assert.equal(Buffer.from(midi.body).toString("ascii", 14, 18), "MTrk");
    assert.equal((await request(app).get(`${base}/export/midi`)).status, 403);
    assert.equal((await request(app).get(`${base}/export/otio`).set("x-paid", "yes").set("x-workspace", "other")).status, 404);
  });
  it("rejects unsupported frame rates and unknown timing but preserves untimed cue sheets", async () => {
    const { app } = setup(true);
    const base = `/api/creator-studio/projects/${PID}/world-bible`;
    const untimed = { ...draft, scenes: [{ id: "one", title: "Unscheduled opening" }] };
    assert.equal((await request(app).post(base).set("x-paid", "yes")
      .send({ expectedRevision: 0, draft: untimed })).status, 200);
    const page = await request(app).get(`/creator-studio/projects/${PID}/world-bible`).set("x-paid", "yes");
    assert.equal(page.status, 200);
    assert.doesNotMatch(page.text, /world-bible\/export\/otio/);
    assert.doesNotMatch(page.text, /world-bible\/export\/midi/);
    const csv = await request(app).get(`${base}/export/csv`).set("x-paid", "yes");
    assert.equal(csv.status, 200);
    assert.match(csv.text, /"unknown"/);
    const otio = await request(app).get(`${base}/export/otio`).set("x-paid", "yes");
    assert.equal(otio.status, 422);
    assert.equal(otio.body.code, "world_bible_export_needs_valid_timing");
    assert.equal((await request(app).get(`${base}/export/midi`).set("x-paid", "yes")).status, 422);
    const invalid = await request(app).get(`${base}/export/otio?fps=29.97`).set("x-paid", "yes");
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.code, "invalid_export_frame_rate");
    assert.equal((await request(app).get(`${base}/export/unknown`).set("x-paid", "yes")).status, 400);
  });

  it("exports a private narrative audit, DOT diagram and editable Fountain scene outline", async () => {
    const { app } = setup(true);
    const root = `/api/creator-studio/projects/${PID}/world-bible`;
    const story = { ...draft, entities: [{ id: "person", kind: "character", name: "Lead" }],
      scenes: [{ id: "opening", title: "Begin", durationSeconds: 8, entityIds: ["person"] },
        { id: "ending", title: "Finish", durationSeconds: 6, dependsOn: ["opening"] }] };
    assert.equal((await request(app).post(root).set("x-paid", "yes")
      .send({ expectedRevision: 0, draft: story })).status, 200);
    const audit = await request(app).get(`${root}/export/audit`).set("x-paid", "yes");
    assert.equal(audit.status, 200);
    const parsed = audit.body?.schema ? audit.body : JSON.parse(audit.text);
    assert.equal(parsed.schema, "sonara.narrative-integrity.v1");
    assert.equal(parsed.counts.dependencyEdges, 1);
    assert.equal(parsed.criticalPathPlannedSeconds, 14);
    assert.equal(parsed.semantics.runtimeExecution, false);
    const dot = await request(app).get(`${root}/export/dot`).set("x-paid", "yes");
    assert.equal(dot.status, 200);
    const dotText = dot.text ?? Buffer.from(dot.body).toString("utf8");
    assert.match(dotText, /"opening" -> "ending"/);
    const fountain = await request(app).get(`${root}/export/fountain`).set("x-paid", "yes");
    assert.equal(fountain.status, 200);
    assert.match(fountain.text, /\.SCENE 1 - BEGIN/);
    assert.match(fountain.text, /not a completed screenplay/);
    for (const result of [audit, dot, fountain]) {
      assert.match(result.headers["cache-control"], /no-store/);
      assert.match(result.headers["content-disposition"], /attachment/);
    }
    assert.equal((await request(app).get(`${root}/export/audit`)).status, 403);
    assert.equal((await request(app).get(`${root}/export/dot`)
      .set("x-paid", "yes").set("x-workspace", "other")).status, 404);
    assert.equal((await request(app).get(`${root}/export/quest`).set("x-paid", "yes")).status, 422);
  });
  it("exports only non-executable game prerequisite JSON for game World Bibles", async () => {
    const { app } = setup(true);
    const root = `/api/creator-studio/projects/${PID}/world-bible`;
    const game = { ...draft, medium: "game",
      scenes: [{ id: "intro", title: "Intro" },
        { id: "mission", title: "Mission", dependsOn: ["intro"] }] };
    assert.equal((await request(app).post(root).set("x-paid", "yes")
      .send({ expectedRevision: 0, draft: game })).status, 200);
    const quest = await request(app).get(`${root}/export/quest`).set("x-paid", "yes");
    assert.equal(quest.status, 200);
    const parsed = quest.body?.schema ? quest.body : JSON.parse(quest.text);
    assert.equal(parsed.schema, "sonara.game.quest-prerequisites.v1");
    assert.equal(parsed.nodes[1].plannedDurationSeconds, null);
    assert.deepEqual(parsed.nodes[1].designPrerequisiteIds, ["intro"]);
    assert.equal(parsed.choices.length, 0);
    assert.equal(parsed.executable, false);
    assert.equal(parsed.externalAssetsIncluded, false);
    const world = await request(app).get(`/creator-studio/projects/${PID}/world-bible`).set("x-paid", "yes");
    assert.match(world.text, /world-bible\/export\/quest/);
  });

});

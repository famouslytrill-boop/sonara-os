// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const { createHash } = require("node:crypto");
const { validateGraph, applyCommand, exportProject } = require("../lib/sonara-creator-project-graph.cjs");
const { createCreatorProjectStore } = require("../lib/sonara-creator-project-store.cjs");
const register = require("../routes/sonara-creator-project-routes.cjs");
const { FREE_TOOL_PATHS } = require("../lib/sonara-tool-access.cjs");
const clone = (value) => JSON.parse(JSON.stringify(value));
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const empty = () => ({ version: 1, nodes: [] });
function database() {
  const projects = [];
  const assets = [{ id: id(20), organization_id: id(1), title: "Owned recording", status: "ready" }, { id: id(21), organization_id: id(2), title: "Another workspace", status: "ready" }];
  const generated = [{ id: id(22), organization_id: id(1), user_id: id(3), job_id: id(40), asset_role: "output", media_type: "audio" },
    { id: id(23), organization_id: id(2), user_id: id(4), job_id: id(41), asset_role: "output", media_type: "video" }];
  const jobs = [{ id: id(40), organization_id: id(1), user_id: id(3), title: "Original audio", status: "completed" },
    { id: id(41), organization_id: id(2), user_id: id(4), title: "Private film", status: "completed" }];
  const calls = [];
  let offline = false;
  let loseRace = false;
  async function fetch(url, options) {
    const parsed = new URL(url); const query = parsed.searchParams;
    calls.push({ url, options });
    if (offline) return { ok: false };
    const org = query.get("organization_id").slice(3);
    assert.ok(org, "every store query must be tenant scoped");
    const tables = { creator_assets: assets, creator_projects: projects, creator_generation_assets: generated, creator_generation_jobs: jobs };
    const table = tables[parsed.pathname.split("/").at(-1)];
    assert.ok(table, "the client cannot choose an arbitrary table");
    if (options.method === "POST") {
      const body = JSON.parse(options.body);
      assert.equal(body.organization_id, org);
      table.push({ ...body, id: id(10), revision: 1, archived_at: null });
      return { ok: true, json: async () => clone([table.at(-1)]) };
    }
    let found = table.filter((row) => row.organization_id === org);
    if (query.has("user_id")) found = found.filter((row) => row.user_id === query.get("user_id").slice(3));
    const filter = query.get("id");
    if (filter?.startsWith("eq.")) found = found.filter((row) => row.id === filter.slice(3));
    if (filter?.startsWith("in.(")) found = found.filter((row) => filter.slice(4, -1).split(",").includes(row.id));
    if (query.get("status") === "neq.archived") found = found.filter((row) => row.status !== "archived");
    if (query.get("status") === "eq.completed") found = found.filter((row) => row.status === "completed");
    if (query.has("asset_role")) found = found.filter((row) => ["output", "stem"].includes(row.asset_role));
    if (query.has("media_type")) found = found.filter((row) => ["audio", "music", "voice", "video", "image"].includes(row.media_type));
    if (options.method === "PATCH") {
      if (loseRace) { found[0].revision += 1; loseRace = false; }
      found = found.filter((row) => row.revision === Number(query.get("revision").slice(3)));
      found.forEach((row) => Object.assign(row, JSON.parse(options.body)));
    }
    return { ok: true, json: async () => clone(found) };
  }
  const store = createCreatorProjectStore({ getSupabaseServerConfig: () => ({ ok: true, url: "https://database.test", serviceKey: "NEVER_RENDER_THIS" }),
    supabaseHeaders: () => ({}), getCustomerPrimaryOrganization: async (user) => ({ ok: true, organizationId: user.id === id(4) ? id(2) : id(1) }), fetch });
  return { store, projects, assets, generated, jobs, calls, setOffline: () => { offline = true; }, loseRace: () => { loseRace = true; } };
}
const req = { sonaraAccess: { user: { id: id(3) } } };
describe("Creator Project Graph", () => {
  it("derives source-to-clip edges and preserves mute intent", () => {
    const source = applyCommand(empty(), { action: "add_source", assetId: id(20), durationMs: 3000 }, id(30));
    const graph = applyCommand(source, { action: "add_clip", sourceId: id(30), inMs: 500, outMs: 2500, startMs: 1000, muted: "true" }, id(31));
    assert.deepEqual(graph.edges, [{ from: id(30), to: id(31), relation: "used_by" }]);
    assert.equal(graph.nodes[1].muted, true);
    assert.throws(() => applyCommand(graph, { action: "remove", nodeId: id(30) }), /clips/);
  });
  it("rejects duplicate IDs, dangling clips, excessive durations and unknown kinds", () => {
    const source = { id: id(30), kind: "source", assetId: id(20), durationMs: 2000 };
    assert.throws(() => validateGraph({ version: 1, nodes: [source, source] }), /unique/);
    for (const nodes of [[{ id: id(31), kind: "clip", sourceId: id(30), inMs: 0, outMs: 1000, startMs: 0 }], [{ ...source, durationMs: Infinity }], [{ ...source, kind: "execute_code" }]]) assert.throws(() => validateGraph({ version: 1, nodes }));
    assert.throws(() => applyCommand({ version: 1, nodes: [source] }, { action: "add_clip", sourceId: id(30), inMs: 0, outMs: 3000, startMs: 0 }, id(31)), /exceeds/);
    assert.throws(() => applyCommand(empty(), { action: "add_caption", startMs: 2, endMs: 1, text: "caption" }, id(31)), /after/);
  });
  it("edits timing, captions and mute without replacing source identity or accepting invalid trims", () => {
    let graph = applyCommand(empty(), { action: "add_source", assetId: id(20), durationMs: 3000 }, id(30));
    graph = applyCommand(graph, { action: "add_clip", sourceId: id(30), inMs: 0, outMs: 2000, startMs: 0 }, id(31));
    graph = applyCommand(graph, { action: "update_clip", nodeId: id(31), startMs: 1000, muted: "true", sourceId: id(99), id: id(99) });
    assert.equal(graph.nodes[1].sourceId, id(30)); assert.equal(graph.nodes[1].id, id(31));
    assert.equal(graph.nodes[1].muted, true); assert.equal(graph.nodes[1].startMs, 1000);
    graph = applyCommand(graph, { action: "update_clip", nodeId: id(31), muted: "false" });
    assert.equal(graph.nodes[1].muted, false);
    assert.throws(() => applyCommand(graph, { action: "update_source", nodeId: id(30), durationMs: 1000 }), /exceeds/);
    assert.throws(() => applyCommand(graph, { action: "update_clip", nodeId: id(31), inMs: 2000 }), /duration/);
    assert.throws(() => applyCommand(graph, { action: "update_caption", nodeId: id(31), text: "wrong kind" }), /not in/);
    graph = applyCommand(graph, { action: "add_caption", startMs: 0, endMs: 1000, text: "Draft" }, id(32));
    graph = applyCommand(graph, { action: "update_caption", nodeId: id(32), text: "Final", endMs: 2000 });
    assert.match(exportProject({ id: id(10), title: "Film", revision: 1, graph }, "vtt").data, /Final/);
  });
  it("uses completed generated output without leaking private files or widening access", async () => {
    const db = database(); await db.store.create(req, { title: "Film", medium: "audio" });
    const picker = await db.store.assets(req);
    assert.equal(picker.rows.some((asset) => asset.id === id(22) && asset.origin === "generation"), true);
    assert.equal(picker.rows.some((asset) => asset.id === id(23)), false);
    assert.equal((await db.store.command(req, id(10), { action: "add_source", assetRef: `generation:${id(23)}`, durationMs: 2000, revision: 1 })).code, "source_unavailable");
    const saved = await db.store.command(req, id(10), { action: "add_source", assetRef: `generation:${id(22)}`, durationMs: 2000, revision: 1 });
    assert.equal(saved.ok, true); assert.equal(saved.project.graph.nodes[0].origin, "generation");
    db.generated[0].user_id = id(5);
    assert.equal((await db.store.readForExport(req, id(10))).code, "source_unavailable");
    db.generated[0].user_id = id(3); db.jobs[0].status = "running";
    assert.equal((await db.store.readForExport(req, id(10))).code, "source_unavailable");
    db.jobs[0].status = "completed"; db.generated[0].asset_role = "reference";
    assert.equal((await db.store.readForExport(req, id(10))).code, "source_unavailable");
    assert.throws(() => applyCommand(empty(), { action: "add_source", assetId: id(22), origin: "billing_subscriptions", durationMs: 1000 }, id(30)), /supported/);
  });
  it("makes stable exports and safe multi-cue WebVTT from user text", () => {
    const graph = applyCommand(empty(), { action: "add_caption", startMs: 1500, endMs: 3000, text: "<script>& -->\ntext" }, id(31));
    const project = { id: id(10), title: "Actual work", medium: "video", revision: 1, graph };
    const vtt = exportProject(project, "vtt").data;
    assert.match(vtt, /00:00:01.500 --> 00:00:03.000/);
    assert.match(vtt, /&lt;script&gt;&amp; --&gt; text/);
    const manifest = JSON.parse(exportProject(project, "json").data);
    const { sha256, ...content } = manifest;
    assert.equal(sha256, createHash("sha256").update(JSON.stringify(content)).digest("hex"));
    assert.equal(manifest.mediaRendered, false);
    assert.equal(exportProject(project, "json").data, exportProject({ ...project, graph: { ...graph, nodes: [...graph.nodes].reverse() } }, "json").data);
    assert.throws(() => exportProject(project, "exe"), /Choose/);
  });
  it("saves real source references and refuses another organization's asset or project", async () => {
    const db = database();
    const made = await db.store.create(req, { title: "Film", medium: "video", organization_id: id(2) });
    assert.equal(made.ok, true); assert.equal(db.projects[0].organization_id, id(1));
    assert.equal((await db.store.command(req, id(10), { action: "add_source", assetId: id(21), durationMs: 2000, revision: 1 })).code, "source_unavailable");
    const saved = await db.store.command(req, id(10), { action: "add_source", assetId: id(20), durationMs: 2000, revision: 1 });
    assert.equal(saved.project.revision, 2);
    const other = await db.store.get({ sonaraAccess: { user: { id: id(4) } } }, id(10));
    assert.equal(other.status, 404);
  });
  it("refuses stale saves including a race between the read and PATCH", async () => {
    const db = database(); await db.store.create(req, { title: "Film", medium: "mixed" });
    db.loseRace();
    const command = { action: "add_caption", startMs: 0, endMs: 1000, text: "caption", revision: 1 };
    assert.equal((await db.store.command(req, id(10), command)).code, "revision_conflict");
    assert.equal((await db.store.command(req, id(10), command)).code, "revision_conflict");
    assert.equal(db.projects[0].graph.nodes.length, 0);
  });
  it("archives and restores without removing source files", async () => {
    const db = database(); await db.store.create(req, { title: "Film", medium: "audio" });
    await db.store.command(req, id(10), { action: "archive", revision: 1 });
    assert.equal((await db.store.command(req, id(10), { action: "add_caption", revision: 2 })).code, "project_archived");
    assert.equal((await db.store.command(req, id(10), { action: "restore", revision: 2 })).project.archived_at, null);
    assert.equal(db.assets.length, 2);
  });
  it("reports storage failure and never silently exports a missing source", async () => {
    const db = database(); await db.store.create(req, { title: "Film", medium: "video" });
    await db.store.command(req, id(10), { action: "add_source", assetId: id(20), durationMs: 2000, revision: 1 });
    db.assets[0].status = "archived";
    assert.equal((await db.store.readForExport(req, id(10))).code, "source_unavailable");
    db.setOffline(); assert.equal((await db.store.list(req)).status, 503);
  });
  it("connects create, edit, detail and export routes without rendering server context", async () => {
    const db = database(); const app = express(); app.use(express.json()); app.use(express.urlencoded({ extended: false }));
    register(app, { projectStore: db.store, layout: ({ heading, sections }) => `<h1>${heading}</h1>${sections.join("")}`, brandCard: (a, b) => `<h2>${a}</h2><p>${b}</p>`, linkAction: () => "", escapeHtml: (x) => String(x).replace(/</g, "&lt;"), wantsJson: (r) => r.get("accept") === "application/json", requirePaidOrOwnerAccess: (product) => { assert.equal(product, "creator_studio"); return (r, _s, next) => { r.sonaraAccess = req.sonaraAccess; next(); }; } });
    const create = await request(app).post("/api/creator-studio/projects").set("accept", "application/json").send({ title: "Film", medium: "video" });
    assert.equal(create.status, 200);
    const edit = await request(app).post(`/api/creator-studio/projects/${id(10)}/commands`).type("form").send({ action: "add_caption", revision: 1, text: "Hello", startMs: 0, endMs: 2000 });
    assert.equal(edit.status, 303);
    const detail = await request(app).get(`/creator-studio/projects/${id(10)}`); assert.match(detail.text, /Hello/);
    const json = await request(app).get(`/api/creator-studio/projects/${id(10)}`); assert.doesNotMatch(json.text, /NEVER_RENDER_THIS|serviceKey|"ctx"/);
    const vtt = await request(app).get(`/api/creator-studio/projects/${id(10)}/export/vtt`); assert.equal(vtt.status, 200); assert.match(vtt.text, /Hello/);
    assert.match(vtt.headers["content-disposition"], /attachment/);
  });
  it("registers exactly four free tools per child and three local parent tools", async () => {
    const app = require("../server.js");
    for (const slug of ["business-builder", "creator-studio", "growth-studio"]) assert.equal(FREE_TOOL_PATHS.filter((path) => path.startsWith(`/${slug}/`)).length, 4);
    assert.equal(app.locals.sonaraParentTools.length, 3);
    for (const tool of app.locals.sonaraParentTools) {
      const page = await request(app).get(tool.path); assert.equal(page.status, 200); assert.match(page.text, /data-parent-tool/);
    }
    const protectedRoute = await request(app).post("/api/creator-studio/projects").set("accept", "application/json").send({ title: "No access", medium: "mixed" });
    assert.ok([401, 503].includes(protectedRoute.status));
    assert.equal(protectedRoute.body.ok, false);
  });
});

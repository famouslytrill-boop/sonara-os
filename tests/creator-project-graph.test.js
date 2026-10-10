// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const { createHash } = require("node:crypto");
const { validateGraph, applyCommand, validateSnapshot, exportProject } = require("../lib/sonara-creator-project-graph.cjs");
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
  it("imports complete SRT batches and rejects malformed input without partial writes", async () => {
    const db = database();
    await db.store.create(req, { title: "Captioned film", medium: "video" });
    const subtitles = "\uFEFF1\r\n00:00:00,500 --> 00:00:02,000\r\nFirst line\r\nSecond line\r\n\r\n2\r\n00:00:03,000 --> 00:00:04,000\r\n<script>literal</script>";
    const result = await db.store.command(req, id(10), { action: "import_subtitles", revision: 1, subtitles });
    assert.equal(result.ok, true);
    assert.equal(result.project.revision, 2);
    assert.equal(result.project.graph.nodes.length, 2);
    assert.ok(result.project.graph.nodes.some((node) => node.text === "First line\nSecond line"));
    assert.ok(exportProject(result.project, "vtt").data.includes("&lt;script&gt;literal&lt;/script&gt;"));
    const saved = clone(db.projects);
    for (const bad of ["", null, "x".repeat(65537), "1\n00:61:00,000 --> 00:62:00,000\nBad", "1\n00:00:02,000 --> 00:00:01,000\nBackwards", "1\n24:00:00,000 --> 24:00:01,000\nToo late", subtitles + "\n\n3\ninvalid\nBad"]) {
      const rejected = await db.store.command(req, id(10), { action: "import_subtitles", revision: 2, subtitles: bad });
      assert.equal(rejected.code, "invalid_graph");
      assert.deepEqual(db.projects, saved);
    }
    assert.equal((await db.store.command(req, id(10), { action: "import_subtitles", revision: 1, subtitles })).code, "revision_conflict");
    assert.equal((await db.store.command({ sonaraAccess: { user: { id: id(4) } } }, id(10), { action: "import_subtitles", revision: 2, subtitles })).code, "project_not_found");
    db.loseRace();
    assert.equal((await db.store.command(req, id(10), { action: "import_subtitles", revision: 2, subtitles })).code, "revision_conflict");
    assert.equal(db.projects[0].graph.nodes.length, 2);
  });
  it("limits imported captions by total graph capacity and UTF-8 bytes", () => {
    const { importSubtitles } = require("../lib/sonara-creator-project-graph.cjs");
    let next = 1000;
    const cue = "1\n00:00:00,000 --> 00:00:01,000\nCaption";
    const full = { version: 1, nodes: Array.from({ length: 500 }, (_, i) => ({ id: id(i), kind: "caption", startMs: 0, endMs: 1, text: "Existing" })) };
    assert.throws(() => importSubtitles(full, cue, () => id(next++)), /capacity/);
    assert.throws(() => importSubtitles(empty(), "é".repeat(32769), () => id(next++)), /64 KB/);
  });
  it("uses one graph interface for server and browser drafts and excludes untrusted metadata", () => {
    const browser = {};
    require("node:vm").runInNewContext(require("node:fs").readFileSync(require.resolve("../public/creator-project-graph-core.js"), "utf8"), { globalThis: browser, TextEncoder: globalThis.TextEncoder });
    const graph = applyCommand(empty(), { action: "add_caption", startMs: 0, endMs: 1000, text: "Original caption" }, id(31));
    const input = { version: 1, projectId: id(10), title: "Draft", medium: "video", revision: 1, graph: { ...graph, edges: [{ from: "fake", to: "fake" }] }, serviceKey: "discard", organization_id: id(99), signedUrl: "discard" };
    assert.deepEqual(JSON.parse(JSON.stringify(browser.SonaraCreatorGraph.validateSnapshot(input, id(10)))), validateSnapshot(input, id(10)));
    assert.deepEqual(Object.keys(validateSnapshot(input, id(10))), ["version", "projectId", "title", "medium", "revision", "graph"]);
    assert.equal(validateSnapshot(input).graph.edges.length, 0);
    for (const changed of [{ projectId: id(11) }, { revision: 0 }, { revision: 1.5 }, { medium: "provider_code" }, { title: "" }, { graph: { version: 1, nodes: Array(501).fill({}) } }]) assert.throws(() => validateSnapshot({ ...input, ...changed }, id(10)));
  });
  it("exports stable SRT timing and escapes caption markup without execution", () => {
    let graph = applyCommand(empty(), { action: "add_caption", startMs: 1500, endMs: 3000, text: "<b>Owned</b>\nsecond line" }, id(31));
    graph = applyCommand(graph, { action: "add_caption", startMs: 10, endMs: 1000, text: "First" }, id(32));
    const output = exportProject({ id: id(10), title: "Film", medium: "video", revision: 1, graph }, "srt");
    assert.equal(output.extension, "srt");
    assert.equal(output.data, "1\n00:00:00,010 --> 00:00:01,000\nFirst\n\n2\n00:00:01,500 --> 00:00:03,000\n&lt;b&gt;Owned&lt;/b&gt; second line\n");
    assert.equal(exportProject({ graph: { ...graph, nodes: [...graph.nodes].reverse() } }, "srt").data, output.data);
  });
  it("restores a device snapshot through source authorization, revision CAS and captured identity", async () => {
    const db = database(); const made = await db.store.create(req, { title: "Film", medium: "video" });
    const graph = applyCommand(empty(), { action: "add_source", assetId: id(20), durationMs: 2000 }, id(30));
    const snapshot = { version: 1, projectId: id(10), title: "Local name", medium: "video", revision: 1, graph };
    const command = { action: "restore_snapshot", revision: 1, deviceScope: `${id(3)}:${id(1)}`, snapshot };
    assert.equal(made.ok, true);
    assert.equal((await db.store.command(req, id(10), { ...command, deviceScope: `${id(5)}:${id(1)}` })).code, "workspace_changed");
    assert.equal((await db.store.command(req, id(10), { ...command, snapshot: { ...snapshot, projectId: id(11) } })).code, "invalid_graph");
    assert.equal((await db.store.command(req, id(10), { ...command, snapshot: { ...snapshot, revision: 2 } })).code, "revision_conflict");
    assert.equal((await db.store.command(req, id(10), { ...command, snapshot: { ...snapshot, medium: "audio" } })).code, "invalid_graph");
    const foreign = applyCommand(empty(), { action: "add_source", assetId: id(21), durationMs: 2000 }, id(30));
    assert.equal((await db.store.command(req, id(10), { ...command, snapshot: { ...snapshot, graph: foreign } })).code, "source_unavailable");
    const generated = applyCommand(empty(), { action: "add_source", assetId: id(22), origin: "generation", durationMs: 2000 }, id(30));
    db.generated[0].user_id = id(5);
    assert.equal((await db.store.command(req, id(10), { ...command, snapshot: { ...snapshot, graph: generated } })).code, "source_unavailable");
    const restored = await db.store.command(req, id(10), command);
    assert.equal(restored.project.revision, 2); assert.equal(restored.project.title, "Film"); assert.deepEqual(restored.project.graph, graph);
    assert.equal((await db.store.command(req, id(10), command)).code, "revision_conflict");
    const changedIdentity = { sonaraAccess: { user: { id: id(5) } } };
    assert.equal((await db.store.command(changedIdentity, id(10), { ...command, revision: 2, snapshot: { ...snapshot, revision: 2 } })).code, "workspace_changed");
    await db.store.command(req, id(10), { action: "archive", revision: 2 });
    assert.equal((await db.store.command(req, id(10), { ...command, revision: 3, snapshot: { ...snapshot, revision: 3 } })).code, "project_archived");
  });
  it("does not overwrite a cloud race or claim success when snapshot storage fails", async () => {
    const db = database(); await db.store.create(req, { title: "Film", medium: "video" });
    const snapshot = { version: 1, projectId: id(10), title: "Film", medium: "video", revision: 1, graph: applyCommand(empty(), { action: "add_caption", startMs: 0, endMs: 1000, text: "Kept" }, id(31)) };
    const command = { action: "restore_snapshot", revision: 1, deviceScope: `${id(3)}:${id(1)}`, snapshot };
    db.loseRace();
    assert.equal((await db.store.command(req, id(10), command)).code, "revision_conflict");
    assert.equal(db.projects[0].graph.nodes.length, 0);
    db.setOffline(); assert.equal((await db.store.command(req, id(10), command)).status, 503);
  });
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
    assert.match(detail.text, /name="subtitles"/);
    assert.match(detail.text, /data-midi-export/);
    assert.match(detail.text, /creator-project-midi\.js/);
    assert.match(detail.text, /name="notes"/);
    assert.match(detail.text, /Create MIDI file/);
    assert.match(detail.text, /No data is uploaded/);
    const imported = await request(app).post(`/api/creator-studio/projects/${id(10)}/commands`).type("form").send({ action: "import_subtitles", revision: 2, subtitles: "1\n00:00:03,000 --> 00:00:04,000\nImported cue" });
    assert.equal(imported.status, 303);
    const json = await request(app).get(`/api/creator-studio/projects/${id(10)}`); assert.doesNotMatch(json.text, /NEVER_RENDER_THIS|serviceKey|"ctx"/);
    const vtt = await request(app).get(`/api/creator-studio/projects/${id(10)}/export/vtt`); assert.equal(vtt.status, 200); assert.match(vtt.text, /Hello/);
    assert.match(vtt.text, /Imported cue/);
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

describe("Creator timeline workflows", () => {
  const { summarizeTimeline } = require("../public/creator-project-graph-core.js");
  function timeline() {
    let graph = applyCommand(empty(), { action: "add_source", assetId: id(20), durationMs: 10000 }, id(30));
    graph = applyCommand(graph, { action: "add_clip", sourceId: id(30), inMs: 1000, outMs: 5000, startMs: 2000, muted: true }, id(31));
    return applyCommand(graph, { action: "add_caption", startMs: 1000, endMs: 7000, text: "Caption" }, id(32));
  }
  it("splits a trimmed clip at its timeline position without losing media or mute state", () => {
    const original = timeline(), before = clone(original);
    const split = applyCommand(original, { action: "split_clip", nodeId: id(31), atMs: "3500" }, id(33));
    assert.deepEqual(split.nodes.find((node) => node.id === id(31)), { id: id(31), kind: "clip", sourceId: id(30), inMs: 1000, outMs: 2500, startMs: 2000, muted: true });
    assert.deepEqual(split.nodes.find((node) => node.id === id(33)), { id: id(33), kind: "clip", sourceId: id(30), inMs: 2500, outMs: 5000, startMs: 3500, muted: true });
    assert.equal(split.edges.length, 2);
    assert.deepEqual(original, before);
    for (const atMs of [2000, 6000, 3500.5, true, ""]) assert.throws(() => applyCommand(original, { action: "split_clip", nodeId: id(31), atMs }, id(33)));
    assert.throws(() => applyCommand(original, { action: "split_clip", nodeId: id(32), atMs: 3500 }, id(33)), /Choose a clip/);
    assert.throws(() => applyCommand(original, { action: "split_clip", nodeId: id(31), atMs: 3500 }, id(31)), /unique/);
  });
  it("shifts all captions atomically, preserving clips, and refuses partial or coerced updates", () => {
    const original = applyCommand(timeline(), { action: "add_caption", startMs: 8000, endMs: 9000, text: "Later" }, id(34));
    const before = clone(original);
    const shifted = applyCommand(original, { action: "shift_captions", offsetMs: "-1000" });
    assert.deepEqual(shifted.nodes.filter((n) => n.kind === "caption").map((n) => [n.startMs, n.endMs]), [[0, 6000], [7000, 8000]]);
    assert.deepEqual(shifted.nodes.filter((n) => n.kind !== "caption"), original.nodes.filter((n) => n.kind !== "caption"));
    for (const offsetMs of [-1001, 86400000, 0, 0.5, true, null, "", "1e3"]) assert.throws(() => applyCommand(original, { action: "shift_captions", offsetMs }));
    assert.throws(() => applyCommand(empty(), { action: "shift_captions", offsetMs: 1 }), /Add captions/);
    assert.deepEqual(original, before);
    assert.deepEqual(applyCommand(shifted, { action: "shift_captions", offsetMs: 1000 }), original);
  });
  it("measures union gaps and overlaps rather than summing overlapping clips repeatedly", () => {
    let graph = timeline();
    for (const [n, startMs, outMs] of [[33, 3000, 3000], [34, 4000, 1000]]) graph = applyCommand(graph, { action: "add_clip", sourceId: id(30), inMs: 0, outMs, startMs }, id(n));
    graph = applyCommand(graph, { action: "add_source", assetId: id(21), durationMs: 1000 }, id(35));
    const expected = { durationMs: 7000, clipCount: 3, captionCount: 1, sourceCount: 2, unusedSourceCount: 1, mutedClipCount: 1, gapMs: 3000, overlapMs: 3000 };
    assert.deepEqual(summarizeTimeline(graph), expected);
    assert.deepEqual(summarizeTimeline({ ...graph, nodes: [...graph.nodes].reverse() }), expected);
    assert.equal(summarizeTimeline(empty()).durationMs, 0);
    const split = applyCommand(timeline(), { action: "split_clip", nodeId: id(31), atMs: 3500 }, id(33));
    assert.equal(summarizeTimeline(split).overlapMs, 0);
    assert.equal(summarizeTimeline(split).gapMs, 3000);
  });
  it("retains revision conflicts and source authorization for new graph commands", async () => {
    const db = database(); await db.store.create(req, { title: "Timeline", medium: "video" });
    db.projects[0].graph = timeline();
    const split = await db.store.command(req, id(10), { action: "split_clip", nodeId: id(31), atMs: 3500, revision: 1 });
    assert.equal(split.project.revision, 2);
    assert.equal((await db.store.command(req, id(10), { action: "shift_captions", offsetMs: 100, revision: 1 })).code, "revision_conflict");
    db.assets[0].status = "archived";
    assert.equal((await db.store.command(req, id(10), { action: "shift_captions", offsetMs: 100, revision: 2 })).code, "source_unavailable");
    assert.equal(db.projects[0].revision, 2);
  });
});

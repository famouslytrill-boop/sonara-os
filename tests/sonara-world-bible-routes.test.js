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
function setup(enabled = true, interactive = false, storyPersistent = false) {
  const rows = [];
  const storyRevisions = [];
  let latestStory = null;
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
    if (url.endsWith("/rpc/sonara_save_story_draft")) {
      const rpc = JSON.parse(opts.body);
      const now = "2026-10-09T20:00:00Z";
      if (rpc.p_organization_id !== ORG || rpc.p_project_id !== PID ||
        rpc.p_expected_revision !== (latestStory?.revision || 0) ||
        (latestStory && latestStory.world_fingerprint !== rpc.p_world_fingerprint)) {
        return { ok: false, status: 409 };
      }
      latestStory = { project_id: PID, organization_id: ORG,
        revision: rpc.p_expected_revision + 1, fingerprint: rpc.p_fingerprint,
        world_fingerprint: rpc.p_world_fingerprint, story: rpc.p_story,
        updated_at: now, created_at: now };
      storyRevisions.push({ ...latestStory });
      return { ok: true, status: 200, json: async () => [{
        revision: latestStory.revision, fingerprint: latestStory.fingerprint,
        world_fingerprint: latestStory.world_fingerprint, updated_at: now
      }] };
    }
    const parsed = new URL(url);
    if (url.includes("/creator_story_drafts?")) {
      assert.equal(parsed.searchParams.get("organization_id"), "eq." + ORG);
      assert.equal(parsed.searchParams.get("project_id"), "eq." + PID);
      return { ok: true, status: 200, json: async () => latestStory ? [latestStory] : [] };
    }
    if (url.includes("/creator_story_draft_revisions?")) {
      assert.equal(parsed.searchParams.get("organization_id"), "eq." + ORG);
      assert.equal(parsed.searchParams.get("project_id"), "eq." + PID);
      const exact = parsed.searchParams.get("revision");
      const list = exact ? storyRevisions.filter((x) => x.revision === Number(exact.slice(3)))
        : [...storyRevisions].reverse().slice(0, Number(parsed.searchParams.get("limit") || 25));
      return { ok: true, status: 200, json: async () => list };
    }
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
    interactiveDraftPreviewEnabled: interactive,
    storyRevisionPersistenceEnabled: storyPersistent,
    requirePaidOrOwnerAccess: () => (req, res, next) => req.get("x-paid") ? next() : res.status(403).json({ ok: false }),
    wantsJson: () => true, escapeHtml: esc,
    brandCard: (name, body) => `<article>${esc(name)} ${esc(body)}</article>`,
    linkAction: (url, title) => `<a href="${esc(url)}">${esc(title)}</a>`,
    layout: ({ title, body, sections = [] }) => `<!doctype html><title>${esc(title)}</title><p>${esc(body)}</p>${sections.join("")}`
  });
  return { app, rows, storyRevisions, get latestStory() { return latestStory; } };
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

  it("keeps the interactive preview off independently of World Bible storage", async () => {
    const { app } = setup(true, false);
    const path = `/api/creator-studio/projects/${PID}/world-bible/interactive/preview`;
    assert.equal((await request(app).post(path).set("x-paid", "yes")
      .send({ expectedWorldRevision: 1, story: {}, decisions: [] })).status, 503);
    assert.equal((await request(app).post(path)
      .send({ expectedWorldRevision: 1, story: {}, decisions: [] })).status, 403);
  });
  it("privately simulates authored choices with version matching, no persistence and controlled scope", async () => {
    const { app, rows } = setup(true, true);
    const api = `/api/creator-studio/projects/${PID}/world-bible`;
    const document = { title: "Branching Series", medium: "game",
      entities: [{ id: "hero", kind: "character", name: "Hero" }],
      scenes: [{ id: "start", title: "Start" }, { id: "finish", title: "Finish" }], resources: {} };
    assert.equal((await request(app).post(api).set("x-paid", "yes")
      .send({ expectedRevision: 0, draft: document })).status, 200);
    const body = { expectedWorldRevision: 1, decisions: ["walk"], story: {
      version: 1, startSceneId: "start", state: [{ id: "trust", initial: 0, min: 0, max: 2 }],
      scenes: [{ sceneId: "start", prose: "Step forward.",
        dialogue: [{ speakerId: "hero", text: "Let's go." }],
        choices: [{ id: "walk", label: "Walk", targetSceneId: "finish",
          effect: { stateId: "trust", delta: 1 } }] },
      { sceneId: "finish", prose: "Done.", dialogue: [], choices: [] }]
    } };
    const path = `${api}/interactive/preview`;
    const preview = await request(app).post(path).set("x-paid", "yes")
      .set("x-sonara-intent", "interactive-preview").send(body);
    assert.equal(preview.status, 200);
    assert.equal(preview.body.ok, true);
    assert.equal(preview.body.sourceSaved, false);
    assert.equal(preview.body.preview.status, "authored_end");
    assert.equal(preview.body.preview.state.trust, 1);
    assert.deepEqual(preview.body.preview.visitedSceneIds, ["start", "finish"]);
    assert.equal(preview.body.preview.boundary.gameCompiled, false);
    assert.equal(JSON.stringify(preview.body).includes("PRIVATE_SECRET"), false);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].revision, 1);
    assert.equal(rows[0].draft.medium, "game");
    assert.match(preview.headers["cache-control"], /no-store/);
    const page = await request(app).get(`/creator-studio/projects/${PID}/world-bible`)
      .set("x-paid", "yes");
    assert.match(page.text, /data-sonara-interactive-preview/);
    assert.match(page.text, /Not saved/);
    assert.equal((await request(app).post(path).set("x-paid", "yes")
      .set("x-sonara-intent", "interactive-preview")
      .send({ ...body, expectedWorldRevision: 2 })).status, 409);
    assert.equal((await request(app).post(path).set("x-paid", "yes")
      .set("x-sonara-intent", "interactive-preview").set("x-workspace", "other")
      .send(body)).status, 404);
  });
  it("rejects malicious previews, cross-origin attempts and malformed request intent", async () => {
    const { app } = setup(true, true);
    const api = `/api/creator-studio/projects/${PID}/world-bible`;
    assert.equal((await request(app).post(api).set("x-paid", "yes").send({
      expectedRevision: 0, draft: { title: "Choices", medium: "interactive", entities: [],
        scenes: [{ id: "start", title: "Beginning" }], resources: {} }
    })).status, 200);
    const path = `${api}/interactive/preview`;
    const payload = { expectedWorldRevision: 1, decisions: [], story: {
      version: 1, startSceneId: "start", state: [],
      scenes: [{ sceneId: "start", prose: "", dialogue: [], choices: [] }]
    } };
    assert.equal((await request(app).post(path).set("x-paid", "yes")
      .send(payload)).status, 415);
    assert.equal((await request(app).post(path).set("x-paid", "yes")
      .set("x-sonara-intent", "interactive-preview")
      .set("Origin", "https://attacker.example").send(payload)).status, 403);
    assert.equal((await request(app).post(path).set("x-paid", "yes")
      .set("x-sonara-intent", "interactive-preview")
      .set("Sec-Fetch-Site", "same-site").send(payload)).status, 403);
    assert.equal((await request(app).post(path).set("x-paid", "yes")
      .set("x-sonara-intent", "interactive-preview").send({
        ...payload, story: { ...payload.story, script: "process.env" }
      })).status, 400);
    assert.equal((await request(app).post(path).set("x-paid", "yes")
      .set("x-sonara-intent", "interactive-preview").send({
        ...payload, decisions: ["injected"]
      })).status, 400);
    assert.equal((await request(app).post(path).set("x-paid", "yes")
      .set("x-sonara-intent", "interactive-preview").send(payload)).status, 200);
  });

  it("keeps revision storage independently disabled even with World Bible read enabled", async () => {
    const { app } = setup(true, true, false);
    const base = `/api/creator-studio/projects/${PID}/world-bible/interactive`;
    assert.equal((await request(app).get(`${base}/draft`).set("x-paid", "yes")).status, 503);
    assert.equal((await request(app).get(`${base}/revisions`).set("x-paid", "yes")).status, 503);
    assert.equal((await request(app).post(`${base}/draft`).set("x-paid", "yes")
      .set("x-sonara-intent", "story-save").send({})).status, 503);
    assert.equal((await request(app).get(`${base}/draft`)).status, 403);
  });
  it("saves and recovers tenant-scoped story snapshots with exact CAS and no world data mutation", async () => {
    const { app, rows, storyRevisions } = setup(true, true, true);
    const wb = `/api/creator-studio/projects/${PID}/world-bible`;
    const source = { title: "Our Game", medium: "game",
      entities: [{ id: "hero", kind: "character", name: "Hero" }],
      scenes: [{ id: "intro", title: "Introduction" },
        { id: "end", title: "Ending" }], resources: {} };
    assert.equal((await request(app).post(wb).set("x-paid", "yes")
      .send({ expectedRevision: 0, draft: source })).status, 200);
    const path = `${wb}/interactive/draft`;
    const story = { version: 1, startSceneId: "intro", state: [],
      scenes: [{ sceneId: "intro", prose: "Draft prose.",
        dialogue: [{ speakerId: "hero", text: "Hi." }],
        choices: [{ id: "continue", label: "Continue", targetSceneId: "end" }] },
      { sceneId: "end", prose: "Done.", dialogue: [], choices: [] }] };
    const body = { expectedRevision: 0, expectedWorldRevision: 1, story };
    const saved = await request(app).post(path).set("x-paid", "yes")
      .set("x-sonara-intent", "story-save").send(body);
    assert.equal(saved.status, 200);
    assert.equal(saved.body.storyDraft.revision, 1);
    assert.equal(storyRevisions.length, 1);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].revision, 1);
    const loaded = await request(app).get(path).set("x-paid", "yes");
    assert.equal(loaded.status, 200);
    assert.equal(loaded.body.storyDraft.draft.scenes[0].prose, "Draft prose.");
    assert.match(loaded.headers["cache-control"], /no-store/);
    assert.equal(JSON.stringify(loaded.body).includes("PRIVATE_SECRET"), false);
    assert.equal((await request(app).post(path).set("x-paid", "yes")
      .set("x-sonara-intent", "story-save").send(body)).status, 409);
    const updated = { ...story, scenes: [ { ...story.scenes[0], prose: "Edited draft." }, story.scenes[1] ] };
    const next = await request(app).post(path).set("x-paid", "yes")
      .set("x-sonara-intent", "story-save")
      .send({ expectedRevision: 1, expectedWorldRevision: 1, story: updated });
    assert.equal(next.status, 200);
    assert.equal(next.body.storyDraft.revision, 2);
    const list = await request(app).get(`${wb}/interactive/revisions?limit=2`).set("x-paid", "yes");
    assert.equal(list.status, 200);
    assert.deepEqual(list.body.revisions.map(x=>x.revision), [2,1]);
    assert.equal(list.body.revisions.some(x=>x.draft), false);
    const prior = await request(app).get(`${wb}/interactive/revisions/1`).set("x-paid", "yes");
    assert.equal(prior.status, 200);
    assert.equal(prior.body.storyDraft.draft.scenes[0].prose, "Draft prose.");
    const page = await request(app).get(`/creator-studio/projects/${PID}/world-bible`).set("x-paid", "yes");
    assert.match(page.text, /data-story-save/);
    assert.match(page.text, /data-story-load/);
  });
  it("refuses forged, stale, archived, cross-tenant and unauthorized story mutations", async () => {
    const { app } = setup(true, true, true);
    const path = `/api/creator-studio/projects/${PID}/world-bible/interactive/draft`;
    const body = { expectedRevision: 0, expectedWorldRevision: 1,
      story: { version: 1, startSceneId: "intro", state: [], scenes: [] } };
    assert.equal((await request(app).post(path).set("x-paid", "yes")
      .set("x-sonara-intent", "story-save").send(body)).status, 404);
    assert.equal((await request(app).post(path).send(body)).status, 403);
    assert.equal((await request(app).post(path).set("x-paid", "yes")
      .set("x-sonara-intent", "story-save").send(body)).status, 400);
    assert.equal((await request(app).post(path).set("x-paid", "yes")
      .set("x-sonara-intent", "story-save")
      .set("Origin", "https://attacker.example").send(body)).status, 403);
    assert.equal((await request(app).post(path).set("x-paid", "yes")
      .set("x-sonara-intent", "story-save")
      .set("Sec-Fetch-Site", "same-site").send(body)).status, 403);
    assert.equal((await request(app).get(path).set("x-paid", "yes")
      .set("x-workspace", "other")).status, 404);
    assert.equal((await request(app).get(`/api/creator-studio/projects/${PID}/world-bible/interactive/revisions?limit=26`)
      .set("x-paid", "yes")).status, 400);
    assert.equal((await request(app).get(`/api/creator-studio/projects/${PID}/world-bible/interactive/revisions/101`)
      .set("x-paid", "yes")).status, 400);
  });

});

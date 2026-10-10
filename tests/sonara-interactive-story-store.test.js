// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const assert = require("node:assert/strict");
const { createInteractiveStoryDraftStore } = require("../lib/sonara-interactive-story-store.cjs");
const { normalizedDraft } = require("../lib/sonara-world-bible-store.cjs");
const PID = "00000000-0000-4000-8000-000000000099";
const ORG = "00000000-0000-4000-8000-000000000002";
const UID = "00000000-0000-4000-8000-000000000001";
const worldSource = () => ({ title: "My world", medium: "interactive",
  entities: [{ id: "hero", kind: "character", name: "Hero" }],
  scenes: [{ id: "intro", title: "Introduction" },
    { id: "end", title: "Ending" }], resources: {} });
const prose = () => ({ version: 1, startSceneId: "intro", state: [],
  scenes: [
    { sceneId: "intro", prose: "A new story.", dialogue: [{ speakerId: "hero", text: "Hello." }],
      choices: [{ id: "go", label: "Go", targetSceneId: "end" }] },
    { sceneId: "end", prose: "The end.", dialogue: [], choices: [] }
  ] });
function setup() {
  const ctx = { user: { id: UID }, organizationId: ORG,
    config: { url: "https://db.example", serviceKey: "PRIVATE_SECRET" } };
  let world = worldSource();
  let wbRevision = 1, head = null;
  const history = [], calls = [];
  function worldRecord() {
    const checked = normalizedDraft(world);
    assert.equal(checked.ok, true);
    return { draft: checked.draft, fingerprint: checked.fingerprint, revision: wbRevision };
  }
  const projectStore = { get: async (req, id) =>
    id !== PID || req.scope === "foreign"
      ? { ok: false, status: 404, code: "project_not_found" }
      : { ok: true, ctx, project: { id, archived_at: req.archived ? "2026-10-09T00:00:00Z" : null } } };
  const worldStore = { get: async (req, id) =>
    id !== PID || req.scope === "foreign"
      ? { ok: false, status: 404, code: "project_not_found" }
      : { ok: true, worldBible: worldRecord() } };
  const fetch = async (url, options = {}) => {
    calls.push({ url, options });
    if (url.endsWith("/rpc/sonara_save_story_draft")) {
      const payload = JSON.parse(options.body);
      assert.equal(payload.p_project_id, PID);
      assert.equal(payload.p_organization_id, ORG);
      assert.equal(payload.p_editor_id, UID);
      assert.equal(payload.p_story.worldFingerprint, payload.p_world_fingerprint);
      const actual = head?.revision || 0;
      if (actual !== payload.p_expected_revision ||
        payload.p_world_fingerprint !== worldRecord().fingerprint ||
        (head && head.world_fingerprint !== payload.p_world_fingerprint))
        return { ok: false, status: 409 };
      const now = "2026-10-09T15:00:00Z";
      head = {
        project_id: PID, organization_id: ORG, revision: actual + 1,
        world_fingerprint: payload.p_world_fingerprint, fingerprint: payload.p_fingerprint,
        story: payload.p_story, updated_at: now
      };
      history.push({ ...head, created_at: now });
      return { ok: true, status: 200,
        json: async () => [{ revision: head.revision, fingerprint: head.fingerprint,
          world_fingerprint: head.world_fingerprint, updated_at: now }] };
    }
    const params = new URL(url).searchParams;
    assert.equal(params.get("organization_id"), "eq." + ORG);
    assert.equal(params.get("project_id"), "eq." + PID);
    let rows;
    if (url.includes("/creator_story_draft_revisions?")) {
      const rev = params.get("revision");
      rows = rev ? history.filter((e) => e.revision === Number(rev.slice(3)))
        : [...history].reverse().slice(0, Number(params.get("limit") || 25));
    } else if (url.includes("/creator_story_drafts?")) rows = head ? [head] : [];
    else throw Error("unexpected table URL");
    return { ok: true, status: 200, json: async () => rows };
  };
  const store = createInteractiveStoryDraftStore({
    projectStore, worldStore, supabaseHeaders: () => ({ apikey: "PRIVATE_SECRET" }), fetch
  });
  return { store, calls, history, get head() { return head; },
    reviseWorld(change) { world = { ...world, ...change }; wbRevision++; } };
}
describe("Tenant-scoped append-only interactive story draft adapter", () => {
  it("writes only through a single atomic RPC and confirms read-after-write", async () => {
    const x = setup(), req = {};
    assert.deepEqual(await x.store.get(req, PID),
      { ok: true, storyDraft: null, worldRevision: 1 });
    const saved = await x.store.save(req, PID, { expectedRevision: 0,
      expectedWorldRevision: 1, story: prose() });
    assert.equal(saved.ok, true);
    assert.equal(saved.storyDraft.revision, 1);
    assert.equal(x.history.length, 1);
    assert.ok(x.calls.some((call) => call.url.endsWith("/rpc/sonara_save_story_draft")));
    assert.equal(x.calls.filter((call) => call.options.method).length, 1);
    const read = await x.store.get(req, PID);
    assert.equal(read.ok, true);
    assert.equal(read.storyDraft.worldChanged, false);
    assert.equal(read.storyDraft.draft.scenes[0].prose, "A new story.");
    assert.equal(JSON.stringify(read).includes("PRIVATE_SECRET"), false);
  });
  it("never overwrites concurrently edited revisions; complete revisions remain recoverable", async () => {
    const x = setup(), req = {};
    assert.equal((await x.store.save(req, PID, { expectedRevision: 0,
      expectedWorldRevision: 1, story: prose() })).ok, true);
    assert.equal((await x.store.save(req, PID, { expectedRevision: 0,
      expectedWorldRevision: 1, story: prose() })).status, 409);
    const next = prose(); next.scenes[0].prose = "Author edited text.";
    const update = await x.store.save(req, PID, { expectedRevision: 1,
      expectedWorldRevision: 1, story: next });
    assert.equal(update.storyDraft.revision, 2);
    assert.equal(x.history.length, 2);
    const list = await x.store.revisions(req, PID, 10);
    assert.deepEqual(list.revisions.map((row) => row.revision), [2, 1]);
    assert.ok(list.revisions.every((row) => !Object.hasOwn(row, "draft")));
    const old = await x.store.getRevision(req, PID, 1);
    assert.equal(old.storyDraft.draft.scenes[0].prose, "A new story.");
    const latest = await x.store.get(req, PID);
    assert.equal(latest.storyDraft.draft.scenes[0].prose, "Author edited text.");
    assert.equal((await x.store.getRevision(req, PID, 9)).status, 404);
  });
  it("protects stale World Bible revisions and retains older author text for manual recovery", async () => {
    const x = setup(), req = {};
    assert.equal((await x.store.save(req, PID, { expectedRevision: 0,
      expectedWorldRevision: 1, story: prose() })).ok, true);
    x.reviseWorld({ title: "Updated world title" });
    const previous = await x.store.get(req, PID);
    assert.equal(previous.ok, true);
    assert.equal(previous.storyDraft.worldChanged, true);
    assert.equal(previous.storyDraft.draft.scenes[0].prose, "A new story.");
    assert.equal((await x.store.save(req, PID, { expectedRevision: 1,
      expectedWorldRevision: 1, story: prose() })).status, 409);
    assert.equal((await x.store.save(req, PID, { expectedRevision: 1,
      expectedWorldRevision: 2, story: prose() })).status, 409);
    assert.equal(x.history.length, 1);
  });
  it("rejects archived/foreign project, invalid dialogue and revision bounds before writing", async () => {
    const x = setup();
    const data = { expectedRevision: 0, expectedWorldRevision: 1, story: prose() };
    assert.equal((await x.store.save({ scope: "foreign" }, PID, data)).status, 404);
    assert.equal((await x.store.get({ scope: "foreign" }, PID)).status, 404);
    assert.equal((await x.store.revisions({ scope: "foreign" }, PID)).status, 404);
    assert.equal((await x.store.save({ archived: true }, PID, data)).code, "project_archived");
    const forged = prose(); forged.scenes[0].dialogue[0].speakerId = "admin";
    assert.equal((await x.store.save({}, PID, { ...data, story: forged })).status, 400);
    assert.equal((await x.store.save({}, PID, { ...data, expectedRevision: 100 })).status, 400);
    assert.equal((await x.store.revisions({}, PID, 26)).status, 400);
    assert.equal((await x.store.getRevision({}, PID, 101)).status, 400);
    assert.equal(x.history.length, 0);
  });
  it("fails closed on malformed persisted snapshots instead of assuming valid storage", async () => {
    const x = setup();
    const okay = await x.store.save({}, PID, { expectedRevision: 0,
      expectedWorldRevision: 1, story: prose() });
    assert.equal(okay.ok, true);
    x.head.story.scenes[0].dialogue[0].speakerId = "invalid";
    const read = await x.store.get({}, PID);
    assert.equal(read.status, 503);
    assert.equal(read.code, "story_storage_invalid");
  });
});

// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const { validateInteractiveStory } = require("./sonara-interactive-story-draft.cjs");
const TABLE = "creator_story_drafts";
const HISTORY = "creator_story_draft_revisions";
const FINGERPRINT = /^[a-f0-9]{64}$/;
const err = (status, code) => ({ ok: false, status, code });
function fromSnapshot(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)
    || record.schema !== "sonara.interactive-story.v1" || record.version !== 1
    || !Array.isArray(record.state) || !Array.isArray(record.scenes)) return null;
  return { version: record.version, startSceneId: record.startSceneId,
    state: record.state, scenes: record.scenes };
}
function validRow(row, projectId, organizationId) {
  return row && row.project_id === projectId && row.organization_id === organizationId
    && Number.isSafeInteger(row.revision) && row.revision >= 1 && row.revision <= 100
    && FINGERPRINT.test(row.fingerprint || "")
    && FINGERPRINT.test(row.world_fingerprint || "");
}
function createInteractiveStoryDraftStore({ projectStore, worldStore, supabaseHeaders,
  fetch: request = (...args) => fetch(...args) }) {
  if (typeof projectStore?.get !== "function" || typeof worldStore?.get !== "function"
    || typeof supabaseHeaders !== "function")
    throw new TypeError("Saved interactive stories require guarded project and World Bible stores.");
  async function scope(req, projectId) {
    const project = await projectStore.get(req, projectId);
    if (!project.ok) return project;
    const world = await worldStore.get(req, projectId);
    if (!world.ok) return world;
    if (!world.worldBible) return err(404, "world_bible_not_found");
    if (!["interactive", "game"].includes(world.worldBible.draft?.medium))
      return err(422, "interactive_world_required");
    return { ok: true, world: world.worldBible, ctx: project.ctx, archived: !!project.project.archived_at };
  }
  function endpoint(ctx, table, projectId, select, options = "") {
    return `${ctx.config.url}/rest/v1/${table}?organization_id=eq.${encodeURIComponent(ctx.organizationId)}&project_id=eq.${encodeURIComponent(projectId)}&select=${select}${options}`;
  }
  async function query(ctx, url) {
    const res = await request(url, { headers: supabaseHeaders(ctx.config) }).catch(() => null);
    if (!res?.ok) return err(503, "story_storage_unavailable");
    const rows = await res.json().catch(() => null);
    return Array.isArray(rows) ? { ok: true, rows } : err(503, "story_storage_invalid");
  }
  function snapshot(row, scoped) {
    if (!validRow(row, scoped.projectId, scoped.ctx.organizationId)
      || !fromSnapshot(row.story)) return err(503, "story_storage_invalid");
    const changed = row.world_fingerprint !== scoped.world.fingerprint;
    // On a changed World Bible, preserve the original authored prose for manual
    // reconciliation. Never treat it as validated/executable against the new world.
    if (!changed) {
      const checked = validateInteractiveStory(scoped.world, fromSnapshot(row.story));
      if (!checked.ok || checked.fingerprint !== row.fingerprint)
        return err(503, "story_storage_invalid");
    }
    return { ok: true, storyDraft: {
      revision: row.revision, fingerprint: row.fingerprint,
      worldFingerprint: row.world_fingerprint, worldChanged: changed,
      draft: fromSnapshot(row.story), updatedAt: row.updated_at || row.created_at || null
    } };
  }
  async function get(req, projectId) {
    const s = await scope(req, projectId);
    if (!s.ok) return s;
    const scoped = { ...s, projectId };
    const q = await query(s.ctx, endpoint(s.ctx, TABLE, projectId,
      "project_id,organization_id,revision,fingerprint,world_fingerprint,story,updated_at", "&limit=1"));
    if (!q.ok) return q;
    if (q.rows.length > 1) return err(503, "story_storage_invalid");
    if (!q.rows.length) return { ok: true, storyDraft: null, worldRevision: s.world.revision };
    const found = snapshot(q.rows[0], scoped);
    return found.ok ? { ...found, worldRevision: s.world.revision } : found;
  }
  async function save(req, projectId, input) {
    if (!input || !Number.isSafeInteger(input.expectedRevision)
      || input.expectedRevision < 0 || input.expectedRevision >= 100
      || !Number.isSafeInteger(input.expectedWorldRevision)
      || input.expectedWorldRevision < 1) return err(400, "story_expected_revisions_required");
    const s = await scope(req, projectId);
    if (!s.ok) return s;
    if (s.archived) return err(409, "project_archived");
    if (s.world.revision !== input.expectedWorldRevision)
      return err(409, "world_bible_revision_conflict");
    const checked = validateInteractiveStory(s.world, input.story);
    if (!checked.ok) return err(400, checked.code);
    const args = {
      p_project_id: projectId, p_organization_id: s.ctx.organizationId,
      p_editor_id: s.ctx.user.id, p_expected_revision: input.expectedRevision,
      p_world_fingerprint: s.world.fingerprint, p_fingerprint: checked.fingerprint,
      p_story: checked.story
    };
    const response = await request(`${s.ctx.config.url}/rest/v1/rpc/sonara_save_story_draft`, {
      method: "POST", headers: { ...supabaseHeaders(s.ctx.config),
        "content-type": "application/json", prefer: "return=representation" },
      body: JSON.stringify(args)
    }).catch(() => null);
    if (response?.status === 409) return err(409, "story_revision_or_world_conflict");
    if (!response?.ok) return err(503, "story_storage_unavailable");
    const rows = await response.json().catch(() => null);
    const row = Array.isArray(rows) && rows.length === 1 ? rows[0] : null;
    if (!row || row.revision !== input.expectedRevision + 1
      || row.fingerprint !== checked.fingerprint
      || row.world_fingerprint !== s.world.fingerprint)
      return err(503, "story_storage_unconfirmed");
    return { ok: true, storyDraft: {
      revision: row.revision, fingerprint: checked.fingerprint,
      worldFingerprint: s.world.fingerprint, worldChanged: false,
      draft: input.story, updatedAt: row.updated_at || null
    }, worldRevision: s.world.revision };
  }
  async function revisions(req, projectId, limit = 25) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 25)
      return err(400, "invalid_revision_limit");
    const s = await scope(req, projectId);
    if (!s.ok) return s;
    const q = await query(s.ctx, endpoint(s.ctx, HISTORY, projectId,
      "project_id,organization_id,revision,fingerprint,world_fingerprint,created_at",
      `&order=revision.desc&limit=${limit}`));
    if (!q.ok) return q;
    if (q.rows.some((row) => !validRow(row, projectId, s.ctx.organizationId)))
      return err(503, "story_storage_invalid");
    return { ok: true, revisions: q.rows.map((row) => ({
      revision: row.revision, fingerprint: row.fingerprint,
      worldFingerprint: row.world_fingerprint, createdAt: row.created_at
    })), worldRevision: s.world.revision };
  }
  async function getRevision(req, projectId, revision) {
    if (!Number.isSafeInteger(revision) || revision < 1 || revision > 100)
      return err(400, "invalid_revision");
    const s = await scope(req, projectId);
    if (!s.ok) return s;
    const q = await query(s.ctx, endpoint(s.ctx, HISTORY, projectId,
      "project_id,organization_id,revision,fingerprint,world_fingerprint,story,created_at",
      `&revision=eq.${revision}&limit=1`));
    if (!q.ok) return q;
    if (!q.rows.length) return err(404, "story_revision_not_found");
    if (q.rows.length !== 1) return err(503, "story_storage_invalid");
    const found = snapshot(q.rows[0], { ...s, projectId });
    return found.ok ? { ...found, worldRevision: s.world.revision } : found;
  }
  return { get, save, revisions, getRevision };
}
module.exports = { createInteractiveStoryDraftStore };

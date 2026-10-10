// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Feature-gated adapter. No table/migration is shipped in this PR.
// Uses the canonical project store to resolve membership, archived state and tenant.
const { planWorldbuilding } = require("./sonara-worldbuilding-planner.cjs");
const TABLE = "creator_world_bibles";
const KEYS = Object.freeze(["sampleRateHz", "channels", "bitDepth", "audioBitrateKbps",
  "videoBitrateKbps", "expectedViewers", "wordsPerPage", "gameTickHz"]);
const error = (status, code) => ({ ok: false, status, code });

function normalizedDraft(input) {
  const initial = planWorldbuilding(input);
  if (!initial.ok) return initial;
  const trimmed = {
    title: input.title.trim(), medium: input.medium,
    entities: (input.entities || []).map((item) => ({
      id: item.id, kind: item.kind, name: item.name.trim(),
      ...(item.description === undefined ? {} : { description: item.description.trim() })
    })),
    scenes: input.scenes.map((item) => ({
      id: item.id, title: item.title.trim(),
      ...(item.entityIds === undefined ? {} : { entityIds: [...item.entityIds] }),
      ...(item.dependsOn === undefined ? {} : { dependsOn: [...item.dependsOn] }),
      ...(item.placeId === undefined ? {} : { placeId: item.placeId }),
      ...(item.durationSeconds === undefined ? {} : { durationSeconds: item.durationSeconds }),
      ...(item.spokenWords === undefined ? {} : { spokenWords: item.spokenWords }),
      ...(item.speakingWpm === undefined ? {} : { speakingWpm: item.speakingWpm })
    })),
    resources: Object.fromEntries(KEYS.filter((key) => input.resources?.[key] !== undefined).map((key) => [key, input.resources[key]]))
  };
  const canonical = planWorldbuilding(trimmed);
  if (!canonical.ok) return canonical;
  if (Buffer.byteLength(JSON.stringify(trimmed), "utf8") > 65536) return error(400, "world_bible_too_large");
  return { ok: true, draft: trimmed, fingerprint: canonical.blueprint.sha256, blueprint: canonical.blueprint };
}
function createWorldBibleStore({ projectStore, supabaseHeaders, fetch: request = (...args) => fetch(...args) }) {
  if (!projectStore || typeof projectStore.get !== "function" || typeof supabaseHeaders !== "function") {
    throw new TypeError("World Bible storage requires a tenant-authorized Creator project store and server-only headers.");
  }
  async function readRow(ctx, projectId) {
    const endpoint = `${ctx.config.url}/rest/v1/${TABLE}?organization_id=eq.${encodeURIComponent(ctx.organizationId)}&project_id=eq.${encodeURIComponent(projectId)}&select=project_id,revision,draft,fingerprint,updated_at&limit=1`;
    const response = await request(endpoint, { headers: supabaseHeaders(ctx.config) }).catch(() => null);
    if (!response?.ok) return error(503, "world_bible_storage_unavailable");
    const rows = await response.json().catch(() => null);
    if (!Array.isArray(rows)) return error(503, "world_bible_storage_unavailable");
    if (!rows.length) return { ok: true, worldBible: null };
    if (rows.length !== 1 || rows[0]?.project_id !== projectId ||
        !Number.isSafeInteger(rows[0].revision) || rows[0].revision < 1) return error(503, "world_bible_storage_invalid");
    const validated = normalizedDraft(rows[0].draft);
    if (!validated.ok || rows[0].fingerprint !== validated.fingerprint) return error(503, "world_bible_storage_invalid");
    return { ok: true, worldBible: {
      projectId, revision: rows[0].revision, draft: validated.draft,
      fingerprint: validated.fingerprint, updatedAt: rows[0].updated_at
    } };
  }
  async function resolve(req, id) {
    const project = await projectStore.get(req, id);
    return project.ok ? { ok: true, project, ctx: project.ctx } : project;
  }
  async function get(req, id) {
    const scope = await resolve(req, id);
    return scope.ok ? readRow(scope.ctx, id) : scope;
  }
  async function save(req, id, input) {
    if (!input || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) {
      return error(400, "expected_revision_required");
    }
    const validated = normalizedDraft(input.draft);
    if (!validated.ok) return error(400, validated.code);
    const scope = await resolve(req, id);
    if (!scope.ok) return scope;
    if (scope.project.project.archived_at) return error(409, "project_archived");
    const existing = await readRow(scope.ctx, id);
    if (!existing.ok) return existing;
    const actual = existing.worldBible?.revision || 0;
    if (actual !== input.expectedRevision) return error(409, "world_bible_revision_conflict");
    const nextRevision = actual + 1;
    const ctx = scope.ctx;
    const query = `organization_id=eq.${encodeURIComponent(ctx.organizationId)}&project_id=eq.${encodeURIComponent(id)}&revision=eq.${actual}&select=project_id,revision,fingerprint`;
    const creating = actual === 0;
    const endpoint = `${ctx.config.url}/rest/v1/${TABLE}${creating ? "?select=project_id,revision,fingerprint" : "?" + query}`;
    const body = creating ? {
      organization_id: ctx.organizationId, project_id: id, last_editor_id: ctx.user.id,
      revision: nextRevision, draft: validated.draft, fingerprint: validated.fingerprint
    } : { last_editor_id: ctx.user.id, revision: nextRevision, draft: validated.draft,
      fingerprint: validated.fingerprint, updated_at: new Date().toISOString() };
    const response = await request(endpoint, {
      method: creating ? "POST" : "PATCH",
      headers: { ...supabaseHeaders(ctx.config), "content-type": "application/json", prefer: "return=representation" },
      body: JSON.stringify(body)
    }).catch(() => null);
    if (response?.status === 409) return error(409, "world_bible_revision_conflict");
    if (!response?.ok) return error(503, "world_bible_storage_unavailable");
    const rows = await response.json().catch(() => null);
    if (!Array.isArray(rows)) return error(503, "world_bible_storage_unavailable");
    if (rows.length !== 1 || rows[0]?.project_id !== id || rows[0]?.revision !== nextRevision
        || rows[0]?.fingerprint !== validated.fingerprint) {
      return rows.length === 0 ? error(409, "world_bible_revision_conflict") : error(503, "world_bible_storage_unconfirmed");
    }
    return { ok: true, worldBible: {
      projectId: id, revision: nextRevision, fingerprint: validated.fingerprint,
      draft: validated.draft, updatedAt: body.updated_at || null
    } };
  }
  return { get, save };
}
module.exports = { createWorldBibleStore, normalizedDraft };

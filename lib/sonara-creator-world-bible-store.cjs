// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { UUID } = require("../public/creator-project-graph-core.js");
const { planWorldbuilding } = require("./sonara-worldbuilding-planner.cjs");

const TABLE = "creator_world_bibles";
const MAX_SOURCE_BYTES = 65536;
const fail = (status, code, message) => ({ ok: false, status, code, message });
const keys = ["sampleRateHz", "channels", "bitDepth", "audioBitrateKbps", "videoBitrateKbps",
  "expectedViewers", "wordsPerPage", "gameTickHz"];
const own = (source, key) => Object.hasOwn(source, key);
function canonicalSource(source) {
  const planned = planWorldbuilding(source);
  if (!planned.ok) return fail(400, planned.code, "Check the world bible and its references before saving.");
  // This is the ONLY stored user data. Never accept arbitrary metadata, a
  // client-generated hash, foreign tenant IDs, rights approvals, or execution flags.
  const entities = (source.entities || []).map((x) => ({ id: x.id, kind: x.kind, name: x.name.trim(),
    ...(own(x, "description") ? { description: x.description.trim() } : {}) }));
  const scenes = source.scenes.map((x) => ({ id: x.id, title: x.title.trim(),
    ...(own(x, "entityIds") ? { entityIds: [...x.entityIds] } : {}),
    ...(own(x, "dependsOn") ? { dependsOn: [...x.dependsOn] } : {}),
    ...(own(x, "placeId") ? { placeId: x.placeId } : {}),
    ...(own(x, "durationSeconds") ? { durationSeconds: x.durationSeconds } : {}),
    ...(own(x, "spokenWords") ? { spokenWords: x.spokenWords } : {}),
    ...(own(x, "speakingWpm") ? { speakingWpm: x.speakingWpm } : {}) }));
  const resources = {};
  for (const key of keys) if (own(source.resources || {}, key)) resources[key] = source.resources[key];
  const cleaned = { title: source.title.trim(), medium: source.medium, entities, scenes, resources };
  if (Buffer.byteLength(JSON.stringify(cleaned), "utf8") > MAX_SOURCE_BYTES)
    return fail(413, "world_bible_too_large", "Use a World Bible under 64 KB.");
  const confirmation = planWorldbuilding(cleaned);
  if (!confirmation.ok) return fail(400, confirmation.code, "The World Bible could not be verified.");
  return { ok: true, source: cleaned, blueprint: confirmation.blueprint };
}
function createCreatorWorldBibleStore({ projectStore, supabaseHeaders, fetch: request = (...args) => fetch(...args) }) {
  if (!projectStore || typeof projectStore.get !== "function" || typeof supabaseHeaders !== "function")
    throw new TypeError("A tenant-checked Creator Project Store and server headers are required.");
  async function authorized(req, id, writing = false) {
    if (typeof id !== "string" || !UUID.test(id)) return fail(400, "invalid_project", "Choose a valid Creator project.");
    const project = await projectStore.get(req, id);
    if (!project.ok) return project;
    if (!project.ctx?.organizationId || !project.ctx?.config?.url || !project.ctx?.user?.id)
      return fail(503, "project_context_unavailable", "The project context could not be confirmed.");
    if (writing && project.project.archived_at)
      return fail(409, "project_archived", "Restore the project before editing its world bible.");
    return project;
  }
  async function rows(project, method, id, revision, source) {
    const ctx = project.ctx;
    const filters = `organization_id=eq.${encodeURIComponent(ctx.organizationId)}&project_id=eq.${encodeURIComponent(id)}`
      + (method === "PATCH" ? `&revision=eq.${revision}` : "");
    const url = `${ctx.config.url}/rest/v1/${TABLE}?${filters}&select=project_id,revision,source,updated_at`;
    const options = { method, headers: { ...supabaseHeaders(ctx.config, { prefer: "return=representation" }),
      prefer: "return=representation", ...(method === "GET" ? {} : { "content-type": "application/json" }) } };
    if (method !== "GET") {
      options.body = JSON.stringify(method === "POST"
        ? { project_id: id, organization_id: ctx.organizationId, created_by: ctx.user.id, revision: 1, source }
        : { revision: revision + 1, source, updated_at: new Date().toISOString() });
    }
    const response = await request(url, options).catch(() => null);
    if (!response) return fail(503, "world_storage_unavailable", "World Bible storage did not respond.");
    if (!response.ok) {
      if (method === "POST" && response.status === 409) return fail(409, "revision_conflict", "The World Bible was created in another tab. Reload.");
      return fail(503, "world_storage_unavailable", "World Bible storage could not complete the request.");
    }
    const payload = await response.json().catch(() => null);
    if (!Array.isArray(payload) || payload.length > 1)
      return fail(503, "world_storage_invalid_response", "The World Bible save or read could not be confirmed.");
    return { ok: true, rows: payload };
  }
  function shaped(project, row) {
    if (!row || !Number.isSafeInteger(row.revision) || row.revision < 1
      || row.project_id !== project.project.id) return fail(503, "stored_world_invalid", "Stored World Bible data failed verification.");
    const normalized = canonicalSource(row.source);
    if (!normalized.ok) return fail(503, "stored_world_invalid", "Stored World Bible data failed validation.");
    return { ok: true, projectId: project.project.id, projectRevision: project.project.revision,
      revision: row.revision, updatedAt: row.updated_at || null,
      source: normalized.source, blueprint: normalized.blueprint };
  }
  async function get(req, id) {
    const project = await authorized(req, id);
    if (!project.ok) return project;
    const result = await rows(project, "GET", id);
    if (!result.ok) return result;
    if (!result.rows.length) return fail(404, "world_not_found", "This project has no saved World Bible.");
    return shaped(project, result.rows[0]);
  }
  async function save(req, id, data) {
    if (!data || typeof data !== "object" || Array.isArray(data) || !Number.isSafeInteger(data.expectedRevision)
      || data.expectedRevision < 0 || data.expectedRevision > 2147483646)
      return fail(400, "revision_required", "Supply a valid expectedRevision (zero when creating).");
    const normalized = canonicalSource(data.source);
    if (!normalized.ok) return normalized;
    const project = await authorized(req, id, true);
    if (!project.ok) return project;
    const method = data.expectedRevision === 0 ? "POST" : "PATCH";
    const result = await rows(project, method, id, data.expectedRevision, normalized.source);
    if (!result.ok) return result;
    if (!result.rows.length) return fail(409, "revision_conflict", "The World Bible changed. Reload before saving.");
    const saved = shaped(project, result.rows[0]);
    if (!saved.ok) return saved;
    if (saved.revision !== data.expectedRevision + 1)
      return fail(503, "world_storage_invalid_response", "The saved revision did not match.");
    return saved;
  }
  return { get, save };
}
module.exports = { createCreatorWorldBibleStore, canonicalSource, MAX_SOURCE_BYTES };

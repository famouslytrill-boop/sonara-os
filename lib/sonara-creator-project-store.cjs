// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const { randomUUID } = require("node:crypto");
const { UUID, applyCommand, validateGraph, validateSnapshot, importSubtitles } = require("./sonara-creator-project-graph.cjs");
const TABLE = "creator_projects";
const error = (status, code, message) => ({ ok: false, status, code, message });
function createCreatorProjectStore({ getSupabaseServerConfig, supabaseHeaders, getCustomerPrimaryOrganization, fetch: request = (...args) => fetch(...args) }) {
  async function context(req) {
    const user = req.sonaraAccess?.user || req.sonaraUser;
    if (!user?.id) return error(401, "customer_auth_required", "Sign in to open your projects.");
    const config = getSupabaseServerConfig();
    if (!config.ok) return error(503, "setup_required", "Project storage is not configured.");
    const organization = await getCustomerPrimaryOrganization(user).catch(() => ({ ok: false }));
    if (!organization.ok) return error(503, "workspace_unavailable", "We could not open your workspace.");
    return { ok: true, config, user, organizationId: organization.organizationId };
  }
  async function rows(ctx, table, query, options = {}) {
    const response = await request(`${ctx.config.url}/rest/v1/${table}?organization_id=eq.${encodeURIComponent(ctx.organizationId)}&${query}`, {
      ...options, headers: supabaseHeaders(ctx.config, { prefer: "return=representation" })
    }).catch(() => null);
    const data = response?.ok ? await response.json().catch(() => null) : null;
    return Array.isArray(data) ? { ok: true, rows: data } : error(503, "project_storage_unavailable", "Project storage did not answer. Reload before retrying; the save could not be confirmed.");
  }
  async function get(req, id) {
    if (!UUID.test(id)) return error(400, "invalid_project", "Choose a valid project.");
    const ctx = await context(req);
    if (!ctx.ok) return ctx;
    const result = await rows(ctx, TABLE, `id=eq.${encodeURIComponent(id)}&select=id,title,medium,revision,graph,archived_at,updated_at&limit=1`);
    if (!result.ok) return result;
    if (!result.rows[0]) return error(404, "project_not_found", "That project is not in your workspace.");
    try { validateGraph(result.rows[0].graph); }
    catch { return error(503, "stored_graph_invalid", "This project's stored entries could not be read. Contact support before changing it."); }
    return { ok: true, project: result.rows[0], ctx };
  }
  async function list(req) {
    const ctx = await context(req);
    if (!ctx.ok) return ctx;
    const result = await rows(ctx, TABLE, `select=id,title,medium,revision,graph,archived_at,updated_at&order=updated_at.desc&limit=101`);
    return !result.ok ? result : { ok: true, projects: result.rows.slice(0, 100), truncated: result.rows.length > 100 };
  }
  async function assets(req) {
    const ctx = await context(req);
    if (!ctx.ok) return ctx;
    const [library, generated] = await Promise.all([
      rows(ctx, "creator_assets", "select=id,title,status&status=neq.archived&order=created_at.desc&limit=100"),
      rows(ctx, "creator_generation_assets", `select=id,job_id,media_type&user_id=eq.${encodeURIComponent(ctx.user.id)}&asset_role=in.(output,stem)&media_type=in.(audio,music,voice,video,image)&order=created_at.desc&limit=100`)
    ]);
    if (!library.ok || !generated.ok) return !library.ok ? library : generated;
    const jobIds = [...new Set(generated.rows.map((asset) => asset.job_id))];
    const completed = new Map();
    for (let offset = 0; offset < jobIds.length; offset += 50) {
      const found = await rows(ctx, "creator_generation_jobs", `id=in.(${jobIds.slice(offset, offset + 50).map(encodeURIComponent).join(",")})&user_id=eq.${encodeURIComponent(ctx.user.id)}&select=id,title&status=eq.completed&limit=50`);
      if (!found.ok) return found;
      for (const job of found.rows) completed.set(job.id, job.title);
    }
    return { ok: true, rows: [...library.rows.map((asset) => ({ ...asset, origin: "library" })),
      ...generated.rows.filter((asset) => completed.has(asset.job_id)).map((asset) => ({ id: asset.id, origin: "generation", title: `${completed.get(asset.job_id) || "Generated work"} · ${asset.media_type}` }))] };
  }
  async function verifySources(ctx, graph) {
    const sources = graph.nodes.filter((entry) => entry.kind === "source");
    for (const origin of ["library", "generation"]) {
      const ids = sources.filter((node) => (node.origin || "library") === origin).map((node) => node.assetId);
      for (let offset = 0; offset < ids.length; offset += 50) {
        const chunk = ids.slice(offset, offset + 50);
        const result = await rows(ctx, origin === "generation" ? "creator_generation_assets" : "creator_assets", `id=in.(${chunk.map(encodeURIComponent).join(",")})&${origin === "generation" ? `select=id,job_id&user_id=eq.${encodeURIComponent(ctx.user.id)}&asset_role=in.(output,stem)&media_type=in.(audio,music,voice,video,image)` : "select=id&status=neq.archived"}&limit=50`);
        if (!result.ok) return result;
        const found = new Set(result.rows.map((row) => row.id));
        if (!chunk.every((id) => found.has(id))) return error(409, "source_unavailable", "A source is missing or archived. Remove it or restore the asset before continuing.");
        if (origin === "generation") {
          const jobIds = [...new Set(result.rows.map((asset) => asset.job_id))];
          const jobs = await rows(ctx, "creator_generation_jobs", `id=in.(${jobIds.map(encodeURIComponent).join(",")})&user_id=eq.${encodeURIComponent(ctx.user.id)}&select=id&status=eq.completed&limit=50`);
          if (!jobs.ok) return jobs;
          const ready = new Set(jobs.rows.map((job) => job.id));
          if (!jobIds.every((job) => ready.has(job))) return error(409, "source_unavailable", "Wait for the generation to finish before using its output.");
        }
      }
    }
    return { ok: true };
  }
  async function create(req, input = {}) {
    if (typeof input.title !== "string" || !input.title.trim() || input.title.length > 180 || !["audio", "video", "image", "mixed"].includes(input.medium)) return error(400, "invalid_project", "Enter a title and choose the kind of project.");
    const ctx = await context(req);
    if (!ctx.ok) return ctx;
    const result = await rows(ctx, TABLE, `select=id,title,medium,revision,graph,archived_at,updated_at`, { method: "POST", body: JSON.stringify({ organization_id: ctx.organizationId, user_id: ctx.user.id, title: input.title.trim(), medium: input.medium, graph: validateGraph({ version: 1, nodes: [] }) }) });
    return !result.ok ? result : result.rows[0] ? { ok: true, project: result.rows[0] } : error(503, "project_storage_unavailable", "The project was not confirmed saved.");
  }
  async function command(req, id, input = {}) {
    const current = await get(req, id);
    if (!current.ok) return current;
    const revision = Number(input.revision);
    if (!Number.isSafeInteger(revision) || revision < 1) return error(400, "revision_required", "Reload this project before changing it.");
    if (revision !== current.project.revision) return error(409, "revision_conflict", "This project changed in another tab. Reload before saving.");
    if (current.project.archived_at && input.action !== "restore") return error(409, "project_archived", "Restore this project before editing it.");
    let patch;
    try {
      if (input.action === "import_subtitles") {
        patch = { graph: importSubtitles(current.project.graph, input.subtitles, randomUUID) };
      } else if (input.action === "restore_snapshot") {
        const scope = `${current.ctx.user.id}:${current.ctx.organizationId}`;
        if (input.deviceScope !== scope) return error(409, "workspace_changed", "Your signed-in account or workspace changed. Open this project again before saving a device draft.");
        const snapshot = validateSnapshot(input.snapshot, id);
        if (snapshot.revision !== revision) return error(409, "revision_conflict", "This draft was based on another workspace revision. Keep the draft and compare it with the latest project.");
        if (snapshot.medium !== current.project.medium) return error(400, "invalid_graph", "Choose a draft with the same project kind.");
        patch = { graph: snapshot.graph };
      } else {
      patch = ["archive", "restore"].includes(input.action)
        ? { archived_at: input.action === "archive" ? new Date().toISOString() : null }
        : { graph: applyCommand(current.project.graph, input, randomUUID()) };
      }
    } catch (e) { return error(400, "invalid_graph", e.message); }
    if (patch.graph) {
      const sources = await verifySources(current.ctx, patch.graph);
      if (!sources.ok) return sources;
    }
    const result = await rows(current.ctx, TABLE, `id=eq.${encodeURIComponent(id)}&revision=eq.${encodeURIComponent(revision)}&select=id,title,medium,revision,graph,archived_at,updated_at`, { method: "PATCH", body: JSON.stringify({ ...patch, revision: revision + 1, updated_at: new Date().toISOString() }) });
    return !result.ok ? result : result.rows[0] ? { ok: true, project: result.rows[0] } : error(409, "revision_conflict", "This project changed before your save. Reload before trying again.");
  }
  async function readForExport(req, id) {
    const current = await get(req, id);
    if (!current.ok) return current;
    const sources = await verifySources(current.ctx, current.project.graph);
    return sources.ok ? current : sources;
  }
  return { list, get, create, command, assets, readForExport };
}
module.exports = { createCreatorProjectStore };

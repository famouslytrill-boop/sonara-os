// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const { createCreatorProjectStore } = require("../lib/sonara-creator-project-store.cjs");
const { exportProject } = require("../lib/sonara-creator-project-graph.cjs");
module.exports = function registerCreatorProjectRoutes(app, deps) {
  const { layout, brandCard, linkAction, escapeHtml: esc, requirePaidOrOwnerAccess, wantsJson } = deps;
  const store = deps.projectStore || createCreatorProjectStore(deps);
  const guard = requirePaidOrOwnerAccess("creator_studio");
  const base = "/creator-studio/projects";
  const api = "/api/creator-studio/projects";
  const field = (name, label, type = "text", attrs = "") => `<label>${esc(label)}<input name="${name}" type="${type}" ${attrs} required></label>`;
  const hidden = (name, value) => `<input type="hidden" name="${name}" value="${esc(value)}">`;
  const number = (name, label, min = 0) => field(name, label, "number", `min="${min}" max="86400000" step="1"`);
  function page(res, heading, sections, status = 200) {
    return res.status(status).type("html").send(layout({ title: heading, eyebrow: "Creator Studio", heading,
      body: "Connect your assets, arrange clips, and write timed captions. Download your work without a connected provider.",
      sections, actions: [linkAction(base, "Projects"), linkAction("/creator-studio/assets", "Asset library"), linkAction("/creator-studio/dashboard", "Creator workspace")] }));
  }
  function answer(req, res, result, fallback) {
    // context contains server-only credentials; it never crosses this seam.
    const { ctx: _ctx, ...body } = result;
    if (wantsJson(req)) return res.status(result.ok ? 200 : result.status).json(body);
    if (result.ok) return res.redirect(303, `${base}/${result.project.id}`);
    return page(res, "Your change was not saved", [brandCard("What happened", result.message), `<a href="${esc(fallback)}">Return to the project</a>`], result.status);
  }
  app.get(base, guard, async (req, res) => {
    const result = await store.list(req);
    if (!result.ok) return page(res, "Projects are unavailable", [brandCard("Project storage", result.message)], result.status);
    const cards = result.projects.map((project) => `<article class="card"><h2><a href="${base}/${esc(project.id)}">${esc(project.title)}</a></h2><p>${esc(project.medium)} · Revision ${project.revision}${project.archived_at ? " · Archived" : ""}</p></article>`);
    return page(res, "Your creative projects", [
      `<section class="card"><h2>Start a project</h2><form method="post" action="/api/creator-studio/projects">${field("title", "Project title", "text", 'maxlength="180"')}<label>Project kind<select name="medium"><option value="mixed">Mixed media</option><option value="audio">Audio</option><option value="video">Video</option><option value="image">Images</option></select></label><button type="submit">Create project</button></form></section>`,
      ...cards, ...(cards.length ? [] : [brandCard("Your first project", "Create a project above, then add assets from your library.")]),
      ...(result.truncated ? [brandCard("Latest 100 projects", "This list shows your 100 most recently updated projects.")] : [])
    ]);
  });
  app.get(`${base}/:id`, guard, async (req, res) => {
    const result = await store.get(req, req.params.id);
    if (!result.ok) return page(res, "Project unavailable", [brandCard("Project", result.message)], result.status);
    const project = result.project;
    const destination = `${api}/${project.id}/commands`;
    const form = (action, content, label) => `<form method="post" action="${destination}">${hidden("revision", project.revision)}${hidden("action", action)}${content}<button type="submit">${label}</button></form>`;
    const nodes = project.graph.nodes;
    const sections = [brandCard("Your project", `Revision ${project.revision}. ${nodes.length} entries. Source durations are supplied by you; exports describe edits and do not render a film or verify rights.`),
      `<div class="card-actions"><a class="action" href="${api}/${project.id}/export/json">Download project JSON</a><a class="action" href="${api}/${project.id}/export/vtt">Download captions</a><a class="action" href="${api}/${project.id}/export/csv">Download edit list</a></div>`];
    if (!project.archived_at) {
      const assets = await store.assets(req);
      if (assets.ok) sections.push(`<section class="card"><h2>Add a source</h2>${assets.rows.length
        ? form("add_source", `<label>Asset (latest 100)<select name="assetId">${assets.rows.map((asset) => `<option value="${esc(asset.id)}">${esc(asset.title)}</option>`).join("")}</select></label>${number("durationMs", "Source duration in milliseconds", 1)}`, "Add source")
        : '<p>Add a real asset to your <a href="/creator-studio/assets">asset library</a> first.</p>'}</section>`);
      else sections.push(brandCard("Asset library unavailable", assets.message));
      const sources = nodes.filter((node) => node.kind === "source");
      if (sources.length) sections.push(`<section class="card"><h2>Arrange a clip</h2>${form("add_clip", `<label>Source<select name="sourceId">${sources.map((source, i) => `<option value="${source.id}">Source ${i + 1} · ${source.durationMs} ms</option>`).join("")}</select></label>${number("inMs", "Source in (ms)")}${number("outMs", "Source out (ms)", 1)}${number("startMs", "Timeline start (ms)")}<label><input type="checkbox" name="muted" value="true">Mute this clip</label>`, "Add clip")}</section>`);
      sections.push(`<section class="card"><h2>Add a caption</h2>${form("add_caption", `${number("startMs", "Caption start (ms)")}${number("endMs", "Caption end (ms)", 1)}<label>Caption text<textarea name="text" maxlength="2000" required></textarea></label>`, "Add caption")}</section>`);
    }
    sections.push(`<section class="card"><h2>Project entries</h2>${nodes.length ? nodes.map((node) => `<article><h3>${esc(node.kind)}</h3><p>${esc(node.kind === "caption" ? node.text : node.kind === "source" ? `${node.assetId} · ${node.durationMs} ms` : `${node.inMs}–${node.outMs} ms at ${node.startMs} ms${node.muted ? " · Muted" : ""}`)}</p>${!project.archived_at ? form("remove", hidden("nodeId", node.id), "Remove entry") : ""}</article>`).join("") : "<p>No entries yet.</p>"}</section>`);
    sections.push(`<section class="card"><h2>${project.archived_at ? "Restore" : "Archive"} project</h2>${form(project.archived_at ? "restore" : "archive", "", project.archived_at ? "Restore project" : "Archive project")}</section>`);
    return page(res, project.title, sections);
  });
  app.get(api, guard, async (req, res) => {
    const result = await store.list(req);
    res.status(result.ok ? 200 : result.status).json(result);
  });
  app.post(api, guard, async (req, res) => answer(req, res, await store.create(req, req.body), base));
  app.get(`${api}/:id`, guard, async (req, res) => {
    const { ctx: _ctx, ...result } = await store.get(req, req.params.id);
    res.status(result.ok ? 200 : result.status).json(result);
  });
  app.post(`${api}/:id/commands`, guard, async (req, res) => answer(req, res, await store.command(req, req.params.id, req.body), `${base}/${req.params.id}`));
  app.get(`${api}/:id/export/:format`, guard, async (req, res) => {
    const result = await store.readForExport(req, req.params.id);
    if (!result.ok) return answer(req, res, result, `${base}/${req.params.id}`);
    try {
      const output = exportProject(result.project, req.params.format);
      res.set("Content-Disposition", `attachment; filename="project-${result.project.id}.${output.extension}"`);
      return res.type(output.type).send(output.data);
    } catch (e) { return answer(req, res, { ok: false, status: 400, code: "invalid_export", message: e.message }, `${base}/${req.params.id}`); }
  });
};

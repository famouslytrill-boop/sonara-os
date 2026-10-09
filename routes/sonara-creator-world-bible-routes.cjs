// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { createCreatorWorldBibleStore } = require("../lib/sonara-creator-world-bible-store.cjs");

module.exports = function registerCreatorWorldBibleRoutes(app, deps) {
  const { projectStore, requirePaidOrOwnerAccess, layout, brandCard, linkAction, escapeHtml: esc,
    supabaseHeaders } = deps;
  if (!projectStore || typeof requirePaidOrOwnerAccess !== "function"
      || typeof layout !== "function" || typeof brandCard !== "function"
      || typeof linkAction !== "function" || typeof esc !== "function")
    throw new TypeError("World Bible routes require Creator Project access and HTML helpers.");
  const guard = requirePaidOrOwnerAccess("creator_studio");
  const enabled = deps.worldStorageEnabled === true || (deps.worldStorageEnabled === undefined
    && process.env.SONARA_CREATOR_WORLD_STORAGE_ENABLED === "true");
  const store = enabled ? (deps.worldBibleStore || createCreatorWorldBibleStore({ projectStore, supabaseHeaders, fetch: deps.fetch })) : null;
  const base = "/creator-studio/projects";
  const api = "/api/creator-studio/projects";
  const unavailable = { ok: false, status: 503, code: "world_storage_not_enabled",
    message: "World Bible saving is disabled pending database and security verification." };
  const response = (res, result) => res.status(result.ok ? 200 : result.status)
    .set("Cache-Control", "private, no-store").json(result);
  app.get(`${api}/:id/world`, guard, async (req, res) => {
    if (!enabled) return response(res, unavailable);
    return response(res, await store.get(req, req.params.id));
  });
  app.put(`${api}/:id/world`, guard, async (req, res) => {
    if (!enabled) return response(res, unavailable);
    // A JSON-only, custom-header mutation cannot be submitted by an ordinary
    // cross-origin HTML form. Existing session/tenant authorization still applies.
    if (!req.is("application/json") || req.get("x-sonara-intent") !== "world-bible-save")
      return response(res, { ok: false, status: 415, code: "json_save_intent_required",
        message: "Save using JSON and the Creator editor intent header." });
    return response(res, await store.save(req, req.params.id, req.body));
  });
  app.get(`${base}/:id/world`, guard, async (req, res) => {
    res.set("Cache-Control", "private, no-store");
    if (!enabled) return res.status(503).type("html").send(layout({
      title: "World Bible storage not enabled", eyebrow: "Creator Studio",
      heading: "World Bible storage is not enabled",
      body: "This workspace has not passed database migration and access-control verification.",
      actions: [linkAction(base, "Projects"), linkAction("/creator-studio/worldbuilding", "Use the unsaved planner")],
      sections: [brandCard("No data has been saved", "The existing project and media timeline remain unchanged.")]
    }));
    const project = await projectStore.get(req, req.params.id);
    if (!project.ok) return res.status(project.status).type("html").send(layout({
      title: "Project unavailable", eyebrow: "Creator Studio", heading: "Project unavailable",
      body: "This project could not be opened.", actions: [linkAction(base, "Projects")], sections: []
    }));
    const saved = await store.get(req, req.params.id);
    if (!saved.ok && saved.code !== "world_not_found") return res.status(saved.status).type("html").send(layout({
      title: "World Bible unavailable", eyebrow: "Creator Studio", heading: "World Bible unavailable",
      body: "Storage could not be verified. Nothing was changed.",
      actions: [linkAction(`${base}/${project.project.id}`, "Return to project")],
      sections: [brandCard("Storage", saved.message)]
    }));
    const starter = { title: project.project.title, medium: project.project.medium === "audio" ? "podcast"
      : project.project.medium === "video" ? "film" : "interactive", entities: [],
    scenes: [{ id: "scene-1", title: "First scene" }], resources: {} };
    const source = saved.ok ? saved.source : starter;
    const revision = saved.ok ? saved.revision : 0;
    return res.status(200).type("html").send(layout({
      title: "World Bible", eyebrow: "Creator Studio", heading: `${project.project.title} — World Bible`,
      body: "Edit original characters, places, rules and scenes. Changes are saved only when you press Save, and conflicting revisions are rejected.",
      actions: [linkAction(`${base}/${project.project.id}`, "Media project"),
        linkAction("/creator-studio/worldbuilding", "Unsaved planner")],
      sections: [
        brandCard("Publishing and media generation", "Saving narrative records does not generate audio, video, games or books, and never authorizes publishing, license clearance or paid providers."),
        `<section class="card"><h2>${saved.ok ? "Edit saved World Bible" : "Create a World Bible"}</h2>
<form data-world-bible-form data-project-id="${esc(project.project.id)}" data-revision="${revision}">
<label for="world-bible-json">World Bible JSON</label>
<textarea id="world-bible-json" rows="20" maxlength="65536" spellcheck="false" required>${esc(JSON.stringify(source, null, 2))}</textarea>
<button type="submit">Save World Bible</button>
<p data-world-bible-status role="status" aria-live="polite">${saved.ok ? `Revision ${revision} loaded.` : "No World Bible has been saved for this project."}</p></form></section>
<script src="/creator-world-bible-editor.js" defer></script>`
      ]
    }));
  });
};

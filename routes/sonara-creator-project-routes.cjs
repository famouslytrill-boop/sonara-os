// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const { createCreatorProjectStore } = require("../lib/sonara-creator-project-store.cjs");
const { createWorldBibleStore, normalizedDraft } = require("../lib/sonara-world-bible-store.cjs");
const { renderWorldBibleMarkdown } = require("../lib/sonara-world-bible-export.cjs");
const { renderWorldBibleCueCsv, renderWorldBibleOtio, renderWorldBibleMidi } = require("../lib/sonara-world-bible-interchange.cjs");
const { summarizeTimeline } = require("../public/creator-project-graph-core.js");
const { exportProject } = require("../lib/sonara-creator-project-graph.cjs");
// Defense in depth for new World Bible writes. Ordinary cross-origin forms can
// submit simple POST requests, so membership alone does not stop CSRF.
// A separate, fully tested session-bound CSRF strategy remains a release gate.
function worldBibleWriteIsCrossOrigin(req) {
  const site = req.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return true;
  const origin = req.get("origin");
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    const host = req.get("host");
    return !host || !["https:", "http:"].includes(parsed.protocol)
      || parsed.host.toLowerCase() !== host.toLowerCase();
  } catch { return true; }
}
function offlineDraftForm(project, scope, esc) {
  if (project.archived_at) return "";
  const snapshot = { version: 1, projectId: project.id, title: project.title, medium: project.medium, revision: project.revision, graph: project.graph };
  return `<section class="card" data-project-draft data-project-id="${esc(project.id)}" data-device-scope="${esc(scope)}" data-snapshot="${esc(JSON.stringify(snapshot))}"><h2>Edit a local draft</h2><p>Edit captions, clip timing and mute settings in this open page, even when disconnected. Device saves store this project's text and asset references for this account and workspace in this browser. Source media is not copied. Saved copies remain until you forget them or the browser clears storage; download a backup for work you need to keep. Workspace and provider actions check your subscription when you reconnect.</p><p data-draft-revision></p><div class="card-actions"><button type="button" data-draft-action="save">Save draft on this device</button><button type="button" data-draft-action="open">Open saved draft</button><button type="button" data-draft-action="forget">Forget saved draft</button><button type="button" data-draft-action="sync">Save draft to workspace</button><a data-draft-download hidden>Download local draft</a></div><label>Open project JSON (up to 2 MB)<input type="file" accept="application/json,.json" data-draft-import></label><p role="status" aria-live="polite" data-draft-status>No device copy is written until you choose Save draft on this device. Local edits stay separate from the workspace until you save them there.</p><form data-draft-caption><h3>Add a local caption</h3><label>Caption start (ms)<input name="startMs" type="number" min="0" max="86400000" step="1" required></label><label>Caption end (ms)<input name="endMs" type="number" min="1" max="86400000" step="1" required></label><label>New caption text<textarea name="text" maxlength="2000" required></textarea></label><button type="submit">Add to local draft</button></form><form data-draft-shift><h3>Shift all local captions</h3><label>Shift in milliseconds (negative moves earlier)<input name="offsetMs" type="number" min="-86400000" max="86400000" step="1" required></label><button type="submit">Shift local captions</button></form><p data-draft-timeline></p><div data-draft-entries></div><noscript>Enable JavaScript to edit local drafts. The workspace forms and server downloads still work.</noscript></section><script src="/creator-project-graph-core.js" defer></script><script src="/creator-project-device-store.js" defer></script><script src="/creator-project-draft.js" defer></script>`;
}
function audioRenderForm(project, esc) {
  const clips = project.graph.nodes.filter((node) => node.kind === "clip");
  if (!clips.length || project.archived_at) return "";
  const active = new Set(clips.filter((clip) => !clip.muted).map((clip) => clip.sourceId));
  const sources = project.graph.nodes.filter((node) => node.kind === "source" && active.has(node.id));
  return `<section class="card"><h2>Render project audio on your device</h2><p>Choose your local audio copies for the sources below. Clip trims, timing and mute settings produce a 44.1 kHz stereo WAV. These selected files are not automatically matched to stored assets. Use PCM 16-bit WAV sources up to three minutes and 20 MB each, 64 MB total, a timeline up to three minutes, and ten minutes total unmuted clip time. Processing stays on this device; playback starts only when you press play.</p><form data-project-audio data-project-id="${esc(project.id)}" data-audio-graph="${esc(JSON.stringify(project.graph))}">${sources.map((source, i) => `<label>Source ${i + 1} · ${esc(source.assetId)}<input type="file" accept="audio/wav,.wav" data-source-id="${esc(source.id)}" required></label>`).join("")}<button type="submit">Render WAV</button><p role="status" aria-live="polite">Choose your recordings, then render. Muted clips become silence.</p><audio controls hidden></audio><a data-audio-download hidden>Download WAV</a></form></section><script src="/creator-project-audio.js" defer></script>`;
}
module.exports = function registerCreatorProjectRoutes(app, deps) {
  const { layout, brandCard, linkAction, escapeHtml: esc, requirePaidOrOwnerAccess, wantsJson } = deps;
  const store = deps.projectStore || createCreatorProjectStore(deps);
  // A separate SQL proposal must be independently applied and verified first.
  // Disabled by default even when the route exists. No implicit migration.
  const worldEnabled = deps.worldBiblePersistenceEnabled === true
    || process.env.SONARA_CREATOR_WORLD_BIBLE_PERSISTENCE_ENABLED === "true";
  const worldStore = worldEnabled ? createWorldBibleStore({ ...deps, projectStore: store }) : null;
  const guard = requirePaidOrOwnerAccess("creator_studio");
  const base = "/creator-studio/projects";
  const api = "/api/creator-studio/projects";
  const field = (name, label, type = "text", attrs = "") => `<label>${esc(label)}<input name="${name}" type="${type}" ${attrs} required></label>`;
  const hidden = (name, value) => `<input type="hidden" name="${name}" value="${esc(value)}">`;
  const number = (name, label, min = 0) => field(name, label, "number", `min="${min}" max="86400000" step="1"`);
  const editNumber = (name, label, value, min = 0) => field(name, label, "number", `min="${min}" max="86400000" step="1" value="${esc(value)}"`);
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

  const worldUnavailable = () => ({ ok: false, status: 503, code: "world_bible_migration_not_verified" });
  // Accessible JSON-text editor and sibling API, scoped by the same paid/owner
  // Creator project guard used by all existing project mutation endpoints.
  app.get(`${base}/:id/world-bible`, guard, async (req, res) => {
    res.set("Cache-Control", "private, no-store");
    if (!worldStore) return page(res, "World Bible storage unavailable",
      [brandCard("Not enabled", "This project attachment is disabled until database security and release gates pass.")], 503);
    const result = await worldStore.get(req, req.params.id);
    if (!result.ok) return page(res, "World Bible unavailable", [brandCard("Storage", result.code)], result.status);
    const current = result.worldBible;
    const timelinePlan = current ? normalizedDraft(current.draft) : null;
    const timelineReady = timelinePlan?.ok && timelinePlan.blueprint.medium !== "book"
      && timelinePlan.blueprint.estimates.timingCoverage === "complete_plan";
    const initial = current?.draft || { title: "Original world", medium: "film",
      entities: [], scenes: [{ id: "opening", title: "Opening" }], resources: {} };
    return page(res, "World Bible", [
      brandCard("Versioned private project data", `Revision ${current?.revision || 0}. Every save checks the expected revision. This is source material, not a rendered production or automatically published work.`),
      ...(current ? [`<p><a href="${api}/${esc(req.params.id)}/world-bible/export/markdown">Download World Bible Markdown</a></p>`] : []),
      ...(current ? [`<p><a href="${api}/${esc(req.params.id)}/world-bible/export/csv">Download cue sheet (CSV)</a></p>`] : []),
      ...(timelineReady ? [`<p><a href="${api}/${esc(req.params.id)}/world-bible/export/otio?fps=24">Download editorial placeholders (OTIO, 24 fps)</a></p>`,
        `<p><a href="${api}/${esc(req.params.id)}/world-bible/export/midi">Download scene markers (MIDI, 120 BPM)</a></p>`] : []),
      ...(current && !timelineReady ? [brandCard("Timed exports not available",
        "OTIO and MIDI require complete durations for a media or interactive project. Add scene timing before exporting.") ] : []),
      `<section class="card"><h2>Edit structured World Bible JSON</h2>
<form method="post" action="${base}/${esc(req.params.id)}/world-bible">
<input type="hidden" name="expectedRevision" value="${current?.revision || 0}">
<label>World Bible JSON<textarea name="draft" rows="20" maxlength="65536" required>${esc(JSON.stringify(initial, null, 2))}</textarea></label>
<button type="submit">Save this revision</button></form></section>`
    ]);
  });
  app.post(`${base}/:id/world-bible`, guard, async (req, res) => {
    res.set("Cache-Control", "private, no-store");
    if (worldBibleWriteIsCrossOrigin(req)) return page(res, "World Bible not saved",
      [brandCard("Security", "This editing request did not come from the project website.")], 403);
    if (!worldStore) return page(res, "World Bible storage unavailable",
      [brandCard("Not enabled", "Migration and release approval are required.")], 503);
    const raw = req.body?.draft;
    const revision = req.body?.expectedRevision;
    let draft;
    if (typeof raw !== "string" || Buffer.byteLength(raw, "utf8") > 65536 ||
        typeof revision !== "string" || !/^(0|[1-9][0-9]{0,8})$/.test(revision)) {
      return page(res, "World Bible not saved", [brandCard("Validation", "Provide a bounded JSON document and the current revision.")], 400);
    }
    try { draft = JSON.parse(raw); } catch {
      return page(res, "World Bible not saved", [brandCard("Validation", "The document is not valid JSON.")], 400);
    }
    const result = await worldStore.save(req, req.params.id, { expectedRevision: Number(revision), draft });
    if (!result.ok) return page(res, "World Bible not saved", [brandCard("Validation", result.code)], result.status);
    return res.redirect(303, `${base}/${req.params.id}/world-bible`);
  });
  app.get(`${base}/:id`, guard, async (req, res) => {
    const result = await store.get(req, req.params.id);
    if (!result.ok) return page(res, "Project unavailable", [brandCard("Project", result.message)], result.status);
    const project = result.project;
    const destination = `${api}/${project.id}/commands`;
    const form = (action, content, label) => `<form method="post" action="${destination}">${hidden("revision", project.revision)}${hidden("action", action)}${content}<button type="submit">${label}</button></form>`;
    const nodes = project.graph.nodes;
    const timeline = summarizeTimeline(project.graph);
    const sections = [brandCard("Your project", `Revision ${project.revision}. ${nodes.length} entries. Source durations are supplied by you; exports describe edits and do not render a film or verify rights.`),
      `<p><a href="/creator-studio/generation?project=${project.id}">Generate media for this project</a></p>`,
      ...(worldEnabled ? [`<p><a href="${base}/${esc(project.id)}/world-bible">Edit project World Bible</a></p>`] : []),
      `<div class="card-actions"><a class="action" href="${api}/${project.id}/export/json">Download project JSON</a><a class="action" href="${api}/${project.id}/export/vtt">Download captions</a><a class="action" href="${api}/${project.id}/export/srt">Download SRT captions</a><a class="action" href="${api}/${project.id}/export/csv">Download edit list</a></div>`];
    sections.push(brandCard("Timeline summary", `${timeline.durationMs} ms total · ${timeline.clipCount} clips · ${timeline.captionCount} captions · ${timeline.unusedSourceCount} unused sources · ${timeline.mutedClipCount} muted clips. ${timeline.gapMs} ms without clips; ${timeline.overlapMs} ms with overlapping clips. Gaps and overlaps describe placement, not audio silence or errors.`));
    if (!project.archived_at) {
      sections.push(`<section class="card"><h2>Import subtitles</h2><p>Paste plain-text SRT subtitles, up to 64 KB. All cues are added together; existing captions are kept. Formatting tags are treated as text. No connected provider is needed.</p>${form("import_subtitles", '<label>SRT subtitles<textarea name="subtitles" maxlength="65536" required></textarea></label>', "Import subtitles")}</section>`);
      if (timeline.captionCount) sections.push(`<section class="card"><h2>Shift all captions</h2><p>Move captions together. Negative values move earlier. If any caption would leave the 24-hour timeline, nothing is changed.</p>${form("shift_captions", field("offsetMs", "Shift (ms)", "number", 'min="-86400000" max="86400000" step="1"'), "Shift captions")}</section>`);
      const assets = await store.assets(req);
      if (assets.ok) sections.push(`<section class="card"><h2>Add a source</h2>${assets.rows.length
        ? form("add_source", `<p>Your library assets and your completed generated media. Private generated media remains accessible only to its creator.</p><label>Asset (latest 100 per library)<select name="assetRef">${assets.rows.map((asset) => `<option value="${esc(asset.origin || "library")}:${esc(asset.id)}">${esc(asset.title)}</option>`).join("")}</select></label>${number("durationMs", "Source duration in milliseconds", 1)}`, "Add source")
        : '<p>Add a real asset to your <a href="/creator-studio/assets">asset library</a> first.</p>'}</section>`);
      else sections.push(brandCard("Asset library unavailable", assets.message));
      const sources = nodes.filter((node) => node.kind === "source");
      if (sources.length) sections.push(`<section class="card"><h2>Arrange a clip</h2>${form("add_clip", `<label>Source<select name="sourceId">${sources.map((source, i) => `<option value="${source.id}">Source ${i + 1} · ${source.durationMs} ms</option>`).join("")}</select></label>${number("inMs", "Source in (ms)")}${number("outMs", "Source out (ms)", 1)}${number("startMs", "Timeline start (ms)")}<label><input type="checkbox" name="muted" value="true">Mute this clip</label>`, "Add clip")}</section>`);
      sections.push(`<section class="card"><h2>Add a caption</h2>${form("add_caption", `${number("startMs", "Caption start (ms)")}${number("endMs", "Caption end (ms)", 1)}<label>Caption text<textarea name="text" maxlength="2000" required></textarea></label>`, "Add caption")}</section>`);
    }
    const editor = (node) => {
      const fields = node.kind === "source" ? editNumber("durationMs", "Source duration (ms)", node.durationMs, 1)
        : node.kind === "caption" ? `${editNumber("startMs", "Caption start (ms)", node.startMs)}${editNumber("endMs", "Caption end (ms)", node.endMs, 1)}<label>Caption text<textarea name="text" maxlength="2000" required>${esc(node.text)}</textarea></label>`
          : `${editNumber("inMs", "Source in (ms)", node.inMs)}${editNumber("outMs", "Source out (ms)", node.outMs, 1)}${editNumber("startMs", "Timeline start (ms)", node.startMs)}<label>Clip sound<select name="muted"><option value="false"${!node.muted ? " selected" : ""}>Sound on</option><option value="true"${node.muted ? " selected" : ""}>Muted</option></select></label>`;
      const split = node.kind === "clip" && node.outMs - node.inMs > 1
        ? form("split_clip", `${hidden("nodeId", node.id)}${field("atMs", "Split at timeline position (ms)", "number", `min="${node.startMs + 1}" max="${node.startMs + node.outMs - node.inMs - 1}" step="1"`)}`, "Split clip") : "";
      return form(`update_${node.kind}`, `${hidden("nodeId", node.id)}${fields}`, "Save entry") + split;
    };
    sections.push(`<section class="card"><h2>Project entries</h2>${nodes.length ? nodes.map((node) => `<article><h3>${esc(node.kind)}</h3><p>${esc(node.kind === "caption" ? node.text : node.kind === "source" ? `${node.origin || "library"} · ${node.assetId} · ${node.durationMs} ms` : `${node.inMs}–${node.outMs} ms at ${node.startMs} ms${node.muted ? " · Muted" : ""}`)}</p>${!project.archived_at ? editor(node) + form("remove", hidden("nodeId", node.id), "Remove entry") : ""}</article>`).join("") : "<p>No entries yet.</p>"}</section>`);
    sections.push(`<section class="card"><h2>${project.archived_at ? "Restore" : "Archive"} project</h2>${form(project.archived_at ? "restore" : "archive", "", project.archived_at ? "Restore project" : "Archive project")}</section>`);
    sections.push(audioRenderForm(project, esc));
    if (result.ctx?.user?.id && result.ctx.organizationId) sections.push(offlineDraftForm(project, `${result.ctx.user.id}:${result.ctx.organizationId}`, esc));
    return page(res, project.title, sections);
  });

  app.get(`${api}/:id/world-bible`, guard, async (req, res) => {
    res.set("Cache-Control", "private, no-store");
    const result = worldStore ? await worldStore.get(req, req.params.id) : worldUnavailable();
    return res.status(result.ok ? 200 : result.status).json(result);
  });

  app.get(`${api}/:id/world-bible/export/markdown`, guard, async (req, res) => {
    res.set("Cache-Control", "private, no-store");
    if (!worldStore) return res.status(503).json(worldUnavailable());
    const result = await worldStore.get(req, req.params.id);
    if (!result.ok) return res.status(result.status).json(result);
    if (!result.worldBible) return res.status(404).json({ ok: false, code: "world_bible_not_found" });
    try {
      const output = renderWorldBibleMarkdown(result.worldBible);
      return res.set("Content-Disposition", `attachment; filename="world-bible-${req.params.id}.md"`)
        .type(output.type).send(output.data);
    } catch {
      return res.status(503).json({ ok: false, code: "world_bible_export_invalid" });
    }
  });
  // Interchange outputs are derived from a private, tenant-scoped saved draft.
  // The OTIO file is placeholder gaps, MIDI is markers only, and CSV is a
  // spreadsheet-friendly cue sheet; none is a rendered media asset.
  app.get(`${api}/:id/world-bible/export/:format`, guard, async (req, res) => {
    res.set("Cache-Control", "private, no-store");
    if (!worldStore) return res.status(503).json(worldUnavailable());
    if (!["csv", "otio", "midi"].includes(req.params.format)) {
      return res.status(400).json({ ok: false, code: "unsupported_world_bible_export" });
    }
    const result = await worldStore.get(req, req.params.id);
    if (!result.ok) return res.status(result.status).json(result);
    if (!result.worldBible) return res.status(404).json({ ok: false, code: "world_bible_not_found" });
    try {
      const format = req.params.format;
      let output;
      if (format === "csv") output = renderWorldBibleCueCsv(result.worldBible);
      if (format === "otio") {
        const value = req.query.fps;
        if (value !== undefined && !["24", "25", "30", "60"].includes(value)) {
          return res.status(400).json({ ok: false, code: "invalid_export_frame_rate" });
        }
        output = renderWorldBibleOtio(result.worldBible, Number(value ?? 24));
      }
      if (format === "midi") output = renderWorldBibleMidi(result.worldBible);
      return res.set("Content-Disposition", `attachment; filename="world-bible-${req.params.id}.${output.extension}"`)
        .type(output.type).send(output.data);
    } catch (error) {
      if (error instanceof TypeError || error instanceof RangeError) {
        return res.status(422).json({ ok: false, code: "world_bible_export_needs_valid_timing", message: error.message });
      }
      return res.status(503).json({ ok: false, code: "world_bible_export_unavailable" });
    }
  });
  app.post(`${api}/:id/world-bible`, guard, async (req, res) => {
    res.set("Cache-Control", "private, no-store");
    if (worldBibleWriteIsCrossOrigin(req)) return res.status(403).json({ ok: false, code: "cross_origin_world_write_denied" });
    const result = worldStore ? await worldStore.save(req, req.params.id, req.body) : worldUnavailable();
    return res.status(result.ok ? 200 : result.status).json(result);
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
module.exports.audioRenderForm = audioRenderForm;
module.exports.offlineDraftForm = offlineDraftForm;

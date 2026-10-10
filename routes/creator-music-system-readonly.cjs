// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const {
  CREATOR_MUSIC_SYSTEM_TABLES,
  CREATOR_MUSIC_PUBLIC_LABELS,
  CREATOR_MUSIC_ROUTES,
  CREATOR_MUSIC_REQUIRED_FIELDS,
  CREATOR_MUSIC_SAFETY_RULES
} = require("../lib/creator-music-system-config.cjs");
const { workflowTemplates, planMediaWorkflow, buildGenerationJobs } = require("../lib/sonara-creator-media-workflows.cjs");
const { templates: automationTemplates, validateWorkflow } = require("../lib/sonara-workflow-planner.cjs");
const { makeMelodyScore, renderScoreWav, renderTranscriptVtt } = require("../lib/sonara-deterministic-media.cjs");
const { planWorldbuilding } = require("../lib/sonara-worldbuilding-planner.cjs");

module.exports = function registerCreatorMusicSystemReadOnlyRoutes(app, deps = {}) {
  const requireWorkspaceAccess = typeof deps.requireWorkspaceAccess === "function" ? deps.requireWorkspaceAccess : () => pass;
  const access = requireWorkspaceAccess("creator_studio");
  const layout = deps.layout || basicLayout;
  const brandCard = deps.brandCard || card;
  const linkAction = deps.linkAction || link;

  app.get(CREATOR_MUSIC_ROUTES.home, access, (req, res) => {
    const mediaTemplates = workflowTemplates();
    res.type("html").send(layout({
      title: "Music Creation System",
      eyebrow: "Creator Studio",
      heading: "Music Creation System",
      body: "Build original music systems, song blueprints, production notes, instruction packs, release packages, quality checks, export packages, and approval-aware audio/video production workflows.",
      actions: [
        linkAction(CREATOR_MUSIC_ROUTES.createSystem, "Create system"),
        linkAction(CREATOR_MUSIC_ROUTES.songBlueprint, "Song blueprint"),
        linkAction(CREATOR_MUSIC_ROUTES.promptPacks, "Instruction packs"),
        linkAction("/creator-studio/worldbuilding", "Worldbuilding planner"),
        linkAction("/creator-studio/generation/music", "Music generation"),
        linkAction("/creator-studio/generation/video", "Video generation")
      ],
      sections: [
        brandCard("Original system only", "This area builds reusable original music systems without private artist-name seeds."),
        brandCard("Required music fields", CREATOR_MUSIC_REQUIRED_FIELDS.join(", ")),
        brandCard(
          "Production workflows",
          `${mediaTemplates.length} provider-neutral audio/video workflow templates are available through /api/creator/workflows/templates. Planning a workflow never pretends a render happened; worker/provider steps stay marked setup required until a real adapter is configured.`
        ),
        `<article class="card"><h2>Download an original sound</h2><p>Enter 1 to 16 notes as eighth notes (C3–B5, #, b, or - for a rest). This creates a real mono WAV file on this server without a model or a provider. It is a simple tone sequence, not natural speech.</p>
<form method="post" action="/api/creator/media/score.wav">
<label for="score-notes">Notes</label> <input id="score-notes" name="notes" type="text" required maxlength="80" placeholder="C4 E4 G4 C5" autocomplete="off">
<label for="score-bpm">Tempo (BPM)</label> <input id="score-bpm" name="bpm" type="number" min="60" max="180" value="120" required>
<button type="submit">Download WAV</button></form></article>`,
        `<article class="card"><h2>Download captions</h2><p>Type an approved transcript and its duration. The resulting WebVTT file can be attached to your own video. This does not transcribe or translate speech.</p>
<form method="post" action="/api/creator/media/captions.vtt">
<label for="caption-text">Transcript</label> <textarea id="caption-text" name="text" required maxlength="500" rows="3"></textarea>
<label for="caption-seconds">Duration in seconds</label> <input id="caption-seconds" name="durationSeconds" type="number" min="1" max="60" value="10" required>
<button type="submit">Download captions</button></form></article>`,
        // Eleven cards, one per table, each reading "Ready for saved records."
        // Nothing saves one: no route and no library in this repository reads or
        // writes any of the eleven, so every card was a promise the product did
        // not keep. One card that names them and says what is true replaces
        // eleven that said what was not.
        brandCard(
          "Record areas reserved",
          `${CREATOR_MUSIC_SYSTEM_TABLES.map((table) => CREATOR_MUSIC_PUBLIC_LABELS[table] || table).join(", ")}. Each has a database table with its own access rules. Saving records into them is not built yet, and nothing on this page writes one.`
        )
      ]
    }));
  });


  // Owner workspace only. The preview does not persist content, invoke a model,
  // publish, render media or produce a real DAW/game-engine project file.
  app.get("/creator-studio/worldbuilding", access, (req, res) => {
    res.set("Cache-Control", "private, no-store");
    res.type("html").send(layout({
      title: "Worldbuilding and Production Planner", eyebrow: "Creator Studio",
      heading: "Worldbuilding and Production Planner",
      body: "Build an original story world and plan scenes for a game, book, film, music project, vlog, podcast or stream. This preview is not saved.",
      actions: [linkAction(CREATOR_MUSIC_ROUTES.home, "Music System"),
        linkAction("/creator-studio/projects", "Creator projects")],
      sections: [
        brandCard("Reality check", "This tool validates continuity and computes bounded estimates. It does not create a finished game, audio recording, book, rendered video, live stream, or cleared license."),
        `<article class="card"><h2>Create a world bible</h2>
<form method="post" action="/creator-studio/worldbuilding">
<label for="world-title">Title</label><input id="world-title" name="title" maxlength="160" required>
<label for="world-medium">Format</label><select id="world-medium" name="medium">
<option value="film">Film / storyboard</option><option value="game">Video game</option>
<option value="interactive">Interactive story</option><option value="book">Book</option>
<option value="podcast">Podcast</option><option value="vlog">Vlog</option>
<option value="stream">Streaming show</option><option value="music">Music project</option></select>
<label for="world-characters">Characters (one name per line)</label>
<textarea id="world-characters" name="characters" maxlength="4000" rows="3"></textarea>
<label for="world-places">Locations (one per line)</label>
<textarea id="world-places" name="places" maxlength="4000" rows="3"></textarea>
<label for="world-scenes">Scenes, chapters, quests or episodes (one title per line)</label>
<textarea id="world-scenes" name="scenes" maxlength="8000" rows="5" required></textarea>
<label for="world-seconds">Planned seconds per scene (optional; leave blank if unknown)</label>
<input id="world-seconds" name="secondsPerScene" type="number" min="1" max="86400" step="1">
<button type="submit">Preview world bible</button></form></article>`
      ]
    }));
  });

  app.post("/creator-studio/worldbuilding", access, (req, res) => {
    const parsed = parseWorldbuildingForm(req.body);
    const result = parsed.ok ? planWorldbuilding(parsed.input) : parsed;
    res.set("Cache-Control", "private, no-store");
    return res.status(result.ok ? 200 : 400).type("html").send(layout({
      title: result.ok ? "World Bible Preview" : "Check your World Bible",
      eyebrow: "Creator Studio",
      heading: result.ok ? result.blueprint.title : "Check your World Bible",
      body: result.ok
        ? "Validated plan, not saved. Export by copying the JSON. No media was generated and no content was published."
        : "The blueprint could not be validated. Correct the fields and submit again.",
      actions: [linkAction("/creator-studio/worldbuilding", "Create another preview")],
      sections: result.ok
        ? [brandCard("Planning coverage", result.blueprint.estimates.timingCoverage),
          `<article class="card"><h2>Versioned preview JSON</h2><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(JSON.stringify(result.blueprint, null, 2))}</pre></article>`]
        : [brandCard("Validation", result.code)]
    }));
  });

  // Advanced structured API supports entity references and causal dependencies.
  // The same creator workspace guard applies as for the existing media tools.
  app.post("/api/creator/worldbuilding/plan", access, (req, res) => {
    const result = planWorldbuilding(req.body);
    return res.status(result.ok ? 200 : 400)
      .set("Cache-Control", "private, no-store").json(result);
  });

  app.get(CREATOR_MUSIC_ROUTES.createSystem, access, (req, res) => {
    res.type("html").send(layout({
      title: "Create Music System",
      eyebrow: "Creator Studio",
      heading: "Create Music System",
      // This said "Use the browser helper /creator-music-system.js with the
      // Creator Studio API routes to save real records." No page served that
      // helper, and the eleven endpoints it called were never registered, so the
      // sentence described a save path that did not exist at either end.
      body: "This is the plan for a music system, not a form yet. The fields below are what one holds. Saving a system is not built; the music and video generation areas, and the WAV and captions downloads on the music system page, do work today.",
      actions: [linkAction(CREATOR_MUSIC_ROUTES.home, "Music system")],
      sections: [brandCard("System fields", "System name, project name, identity summary, rules, privacy, and status.")]
    }));
  });

  app.get(CREATOR_MUSIC_ROUTES.songBlueprint, access, (req, res) => {
    res.type("html").send(layout({
      title: "Song Blueprint",
      eyebrow: "Creator Studio",
      heading: "Song Blueprint",
      body: "Plan key, rhythmic feel, harmonic identity, drum language, vocal mode, structure, theme, and hook.",
      actions: [linkAction(CREATOR_MUSIC_ROUTES.home, "Music system")],
      sections: CREATOR_MUSIC_REQUIRED_FIELDS.map((field) => brandCard(field.replace(/_/g, " "), "Required for specific repeatable output."))
    }));
  });

  app.get(CREATOR_MUSIC_ROUTES.promptPacks, access, (req, res) => {
    res.type("html").send(layout({
      title: "Instruction Packs",
      eyebrow: "Creator Studio",
      heading: "Instruction Packs",
      body: "Save reusable music, vocal, mix, cover, video, and sound-design instructions after review.",
      actions: [linkAction(CREATOR_MUSIC_ROUTES.home, "Music system")],
      sections: CREATOR_MUSIC_SAFETY_RULES.map((rule) => brandCard("Rule", rule))
    }));
  });

  app.get(CREATOR_MUSIC_ROUTES.readiness, access, (req, res) => {
    res.json({
      ok: true,
      tables: CREATOR_MUSIC_SYSTEM_TABLES,
      requiredFields: CREATOR_MUSIC_REQUIRED_FIELDS,
      mediaWorkflowTemplates: workflowTemplates().map((item) => item.key),
      automationTemplates: automationTemplates().filter((item) => item.product === "creator_studio").map((item) => item.key)
    });
  });

  app.get("/api/creator/workflows/templates", access, (req, res) => {
    res.status(200).json({
      ok: true,
      media: workflowTemplates(),
      automations: automationTemplates().filter((item) => item.product === "creator_studio"),
      safeguards: {
        arbitraryCodeAllowed: false,
        automaticPublishing: false,
        paidGenerationRequiresApproval: true,
        configuredWorkerOrProviderRequiredForExecution: true
      }
    });
  });

  app.post("/api/creator/workflows/plan", access, (req, res) => {
    const planned = planMediaWorkflow(req.body || {});
    if (!planned.ok) return res.status(400).json(planned);
    return res.status(200).json({
      ...planned,
      generationJobIntents: buildGenerationJobs(planned.plan)
    });
  });

  app.post("/api/creator/automations/validate", access, (req, res) => {
    const validated = validateWorkflow(req.body || {});
    return res.status(validated.ok ? 200 : 400).json(validated);
  });

  // Pure, bounded exports: no tenant record, external provider, GPU worker,
  // recording, voice reference, or production database write is involved.
  app.post("/api/creator/media/score.wav", access, (req, res) => {
    try {
      const wav = renderScoreWav(makeMelodyScore(req.body));
      return res.status(200).set({ "Content-Type": "audio/wav", "Content-Disposition": 'attachment; filename="sonara-score.wav"', "Cache-Control": "private, no-store" }).send(wav);
    } catch (error) {
      if (!(error instanceof TypeError || error instanceof RangeError)) throw error;
      return mediaInputError(req, res, error.message, layout, linkAction);
    }
  });

  app.post("/api/creator/media/captions.vtt", access, (req, res) => {
    try {
      const vtt = renderTranscriptVtt(req.body);
      return res.status(200).set({ "Content-Type": "text/vtt; charset=utf-8", "Content-Disposition": 'attachment; filename="sonara-captions.vtt"', "Cache-Control": "private, no-store" }).send(vtt);
    } catch (error) {
      if (!(error instanceof TypeError || error instanceof RangeError)) throw error;
      return mediaInputError(req, res, error.message, layout, linkAction);
    }
  });
};

function parseWorldbuildingForm(body) {
  if (!body || typeof body !== "object"
      || ["title", "medium", "characters", "places", "scenes", "secondsPerScene"].some((key) =>
        body[key] !== undefined && (typeof body[key] !== "string" || body[key].length > 8000))) {
    return { ok: false, code: "invalid_worldbuilding_form" };
  }
  const lines = (value) => String(value || "").split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
  const characters = lines(body.characters);
  const places = lines(body.places);
  const scenes = lines(body.scenes);
  if (characters.length + places.length > 128 || scenes.length === 0 || scenes.length > 64) {
    return { ok: false, code: "worldbuilding_form_limit" };
  }
  const seconds = body.secondsPerScene ? Number(body.secondsPerScene) : undefined;
  if (seconds !== undefined && (!Number.isSafeInteger(seconds) || seconds < 1 || seconds > 86400)) {
    return { ok: false, code: "invalid_scene_duration" };
  }
  return { ok: true, input: {
    title: body.title, medium: body.medium,
    entities: [
      ...characters.map((name, index) => ({ id: `character-${index + 1}`, kind: "character", name })),
      ...places.map((name, index) => ({ id: `place-${index + 1}`, kind: "place", name }))
    ],
    scenes: scenes.map((title, index) => ({ id: `scene-${index + 1}`, title,
      ...(seconds === undefined ? {} : { durationSeconds: seconds }) }))
  } };
}

function mediaInputError(req, res, message, layout, linkAction) {
  if (!req.accepts("html")) return res.status(400).json({ ok: false, code: "invalid_media_input", message });
  return res.status(400).type("html").send(layout({
    title: "Check your media input", eyebrow: "Creator Studio", heading: "Check your media input",
    body: message, sections: [], actions: [linkAction(CREATOR_MUSIC_ROUTES.home, "Return to Music System")]
  }));
}

function pass(req, res, next) { next(); }
function esc(value) { return String(value || "").replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char])); }
function card(title, body) { return `<article class="card"><h2>${esc(title)}</h2><p>${esc(body)}</p></article>`; }
function link(href, label) { return `<a class="action" href="${esc(href)}">${esc(label)}</a>`; }
function basicLayout(data) { return `<!doctype html><html><head><title>${esc(data.title)}</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main><p>${esc(data.eyebrow)}</p><h1>${esc(data.heading)}</h1><p>${esc(data.body)}</p><nav>${(data.actions || []).join("")}</nav><section>${(data.sections || []).join("")}</section></main></body></html>`; }

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
        ...CREATOR_MUSIC_SYSTEM_TABLES.map((table) => brandCard(CREATOR_MUSIC_PUBLIC_LABELS[table] || table, "Ready for saved records."))
      ]
    }));
  });

  app.get(CREATOR_MUSIC_ROUTES.createSystem, access, (req, res) => {
    res.type("html").send(layout({
      title: "Create Music System",
      eyebrow: "Creator Studio",
      heading: "Create Music System",
      body: "Use the browser helper /creator-music-system.js with the Creator Studio API routes to save real records.",
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
function basicLayout(data) { return `<!doctype html><html><head><title>${esc(data.title)}</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main><p>${esc(data.eyebrow)}</p><h1>${esc(data.heading)}</h1><p>${esc(data.body)}</p><nav>${(data.actions || []).join("")}</nav><section>${(data.sections || []).join("")}</section><script src="/creator-music-system.js"></script></main></body></html>`; }

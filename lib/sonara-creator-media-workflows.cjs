// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Provider-neutral Creator Studio production plans. These are plans, not fake
// renders. A step that needs a configured external worker/provider is marked
// accordingly so the UI can say setup required instead of pretending output was
// created.

const OPERATIONS = Object.freeze({
  generate_image: { medium: "image", execution: "worker_or_provider", approval: "approval_required" },
  edit_image: { medium: "image", execution: "worker_or_provider", approval: "approval_required" },
  create_image_export_plan: { medium: "image", execution: "local_plan", approval: "not_required" },
  generate_voice: { medium: "audio", execution: "worker_or_provider", approval: "approval_required" },
  generate_music: { medium: "audio", execution: "worker_or_provider", approval: "approval_required" },
  generate_sound_effects: { medium: "audio", execution: "worker_or_provider", approval: "approval_required" },
  analyze_audio: { medium: "audio", execution: "worker_or_provider", approval: "not_required" },
  transcribe_audio: { medium: "audio", execution: "worker_or_provider", approval: "not_required" },
  split_stems: { medium: "audio", execution: "worker_or_provider", approval: "not_required" },
  normalize_audio: { medium: "audio", execution: "worker_or_provider", approval: "not_required" },
  generate_waveform: { medium: "audio", execution: "worker_or_provider", approval: "not_required" },
  music_theory_analysis: { medium: "audio", execution: "worker_or_provider", approval: "not_required" },
  create_daw_export_plan: { medium: "audio", execution: "local_plan", approval: "not_required" },
  transcode_video: { medium: "video", execution: "worker_or_provider", approval: "not_required" },
  extract_audio: { medium: "video", execution: "worker_or_provider", approval: "not_required" },
  caption_video: { medium: "video", execution: "worker_or_provider", approval: "not_required" },
  generate_thumbnails: { medium: "video", execution: "worker_or_provider", approval: "not_required" },
  render_template: { medium: "video", execution: "worker_or_provider", approval: "approval_required" },
  social_export_plan: { medium: "video", execution: "local_plan", approval: "not_required" },
  package_release: { medium: "mixed", execution: "local_plan", approval: "not_required" },
  publish_release: { medium: "mixed", execution: "external_provider", approval: "approval_required" }
});

const TEMPLATE_DEFINITIONS = Object.freeze([
  Object.freeze({
    key: "image-concept-and-export",
    name: "Image concept + export plan",
    medium: "image",
    steps: ["generate_image", "create_image_export_plan", "package_release"]
  }),
  Object.freeze({
    key: "voice-podcast-production",
    name: "Voice + podcast production plan",
    medium: "audio",
    steps: ["generate_voice", "normalize_audio", "transcribe_audio", "generate_waveform", "package_release"]
  }),
  Object.freeze({
    key: "music-and-sound-production",
    name: "Music + sound production plan",
    medium: "audio",
    steps: ["generate_music", "generate_sound_effects", "normalize_audio", "package_release"]
  }),
  Object.freeze({
    key: "cinematic-multimedia-production",
    name: "Cinematic multimedia production plan",
    medium: "mixed",
    steps: ["generate_image", "render_template", "generate_music", "caption_video", "generate_thumbnails", "package_release"]
  }),
  Object.freeze({
    key: "music-analysis-and-daw",
    name: "Music analysis + DAW handoff",
    medium: "audio",
    steps: ["analyze_audio", "music_theory_analysis", "generate_waveform", "create_daw_export_plan"]
  }),
  Object.freeze({
    key: "stem-prep-and-release",
    name: "Stem prep + release package",
    medium: "audio",
    steps: ["analyze_audio", "split_stems", "normalize_audio", "package_release"]
  }),
  Object.freeze({
    key: "video-caption-social-pack",
    name: "Video captions + social export pack",
    medium: "video",
    steps: ["transcode_video", "extract_audio", "transcribe_audio", "caption_video", "generate_thumbnails", "social_export_plan"]
  }),
  Object.freeze({
    key: "music-video-production",
    name: "Music video production plan",
    medium: "mixed",
    steps: ["analyze_audio", "render_template", "caption_video", "generate_thumbnails", "package_release"]
  })
]);

function clean(value, max = 220) {
  return String(value ?? "").trim().slice(0, max);
}

function normalizeStep(step, index) {
  const source = typeof step === "string" ? { operation: step } : (step && typeof step === "object" ? step : {});
  const operation = clean(source.operation || source.type, 80);
  const definition = OPERATIONS[operation];
  if (!definition) return { ok: false, code: "unsupported_media_operation", index, operation: operation || null };
  return {
    ok: true,
    step: {
      operation,
      execution: definition.execution,
      approval: definition.approval,
      config: source.config && typeof source.config === "object" && !Array.isArray(source.config) ? source.config : {}
    }
  };
}

function planMediaWorkflow(input = {}) {
  const name = clean(input.name, 180);
  const medium = clean(input.medium || "mixed", 20);
  const rawSteps = Array.isArray(input.steps) ? input.steps : [];
  if (!name) return { ok: false, code: "workflow_name_required" };
  if (!["audio", "image", "video", "mixed"].includes(medium)) return { ok: false, code: "invalid_media_medium" };
  if (!rawSteps.length) return { ok: false, code: "workflow_steps_required" };
  if (rawSteps.length > 24) return { ok: false, code: "too_many_media_steps", max: 24 };

  const steps = [];
  for (let index = 0; index < rawSteps.length; index += 1) {
    const parsed = normalizeStep(rawSteps[index], index);
    if (!parsed.ok) return parsed;
    steps.push(parsed.step);
  }

  const approvalRequired = steps.some((step) => step.approval === "approval_required");
  const externalWorkRequired = steps.some((step) => step.execution !== "local_plan");
  return {
    ok: true,
    plan: {
      name,
      medium,
      projectId: clean(input.projectId || input.project_id, 80) || null,
      sourceAssetIds: Array.isArray(input.sourceAssetIds || input.source_asset_ids)
        ? (input.sourceAssetIds || input.source_asset_ids).map((value) => clean(value, 100)).filter(Boolean).slice(0, 100)
        : [],
      steps,
      approvalRequired,
      externalWorkRequired,
      status: externalWorkRequired ? "setup_or_worker_required" : "ready",
      publishesAutomatically: false
    }
  };
}

function workflowTemplates() {
  return TEMPLATE_DEFINITIONS.map((template) => {
    const result = planMediaWorkflow(template);
    return { ...template, plan: result.ok ? result.plan : null };
  });
}

function buildGenerationJobs(plan = {}) {
  // Convert only generation-capable operations into job intents already
  // understood by creator_generation_jobs. Analysis/transcode work remains an
  // integration/worker job and is not mislabeled as generated content.
  const mapping = {
    generate_image: "text_to_image",
    edit_image: "image_edit",
    generate_voice: "text_to_speech",
    generate_music: "text_to_music",
    generate_sound_effects: "sound_effects",
    render_template: "scene_orchestration"
  };
  const jobs = [];
  for (const step of Array.isArray(plan.steps) ? plan.steps : []) {
    const capability = mapping[step.operation];
    if (!capability) continue;
    jobs.push({
      capability,
      provider_key: "auto",
      status: "planned",
      parameters: step.config || {},
      requires_approval: true
    });
  }
  return jobs;
}

module.exports = { OPERATIONS, buildGenerationJobs, planMediaWorkflow, workflowTemplates };

"use strict";

const { createHash, randomUUID } = require("node:crypto");
const {
  getProvider,
  getProviderReadiness,
  getCreatorGenerationCatalog,
  chooseProvider
} = require("../lib/creator-generation-provider-registry.cjs");

const JOB_TABLE = "creator_generation_jobs";
const ASSET_TABLE = "creator_generation_assets";
const CONSENT_TABLE = "creator_voice_consents";
const ANALYSIS_TABLE = "creator_reference_analyses";
const EVENT_TABLE = "creator_generation_events";
const VOICE_CAPABILITIES = new Set(["speech_to_speech"]);
const MAX_PROMPT_LENGTH = 5000;
const IMITATION_PATTERNS = [
  /\bin the style of\b/i,
  /\bsound exactly like\b/i,
  /\bclone (?:the )?voice of\b/i,
  /\buse (?:the )?voice of\b/i,
  /\bidentical to (?:the )?(?:song|voice|artist)\b/i,
  /\bcopy (?:this|that|the) (?:song|recording|artist|voice)\b/i
];

module.exports = function registerCreatorGenerationRoutes(app, deps = {}) {
  const requireWorkspaceAccess = typeof deps.requireWorkspaceAccess === "function" ? deps.requireWorkspaceAccess : () => pass;
  const access = requireWorkspaceAccess("creator_studio");
  const ui = buildUi(deps);

  app.get("/api/creator/generation/providers", access, (req, res) => {
    return res.status(200).json({ ok: true, providers: getCreatorGenerationCatalog() });
  });

  app.get("/api/creator/generation/readiness", access, async (req, res) => {
    const config = getConfig(deps);
    const providers = getCreatorGenerationCatalog();
    return res.status(200).json({
      ok: true,
      database: config.ok ? "configured" : "setup_required",
      storage: config.ok ? "private_supabase_storage" : "setup_required",
      configuredProviders: providers.filter((item) => item.readiness.configured).map((item) => item.key),
      providers,
      safeguards: {
        rightsAttestationRequired: true,
        voiceConsentRequired: true,
        directIdentityImitation: "review_required",
        credentials: "server_only",
        outputStorage: "private"
      }
    });
  });

  app.get("/api/creator/generation/jobs", access, async (req, res) => {
    const context = await resolveContext(req, deps);
    if (!context.ok) return res.status(context.status).json(context);
    const config = getConfig(deps);
    if (!config.ok) return res.status(503).json({ ok: false, code: "supabase_setup_required" });
    const result = await rest(config, JOB_TABLE, `select=*&organization_id=eq.${encodeURIComponent(context.organizationId)}&user_id=eq.${encodeURIComponent(context.userId)}&order=created_at.desc&limit=${clamp(req.query.limit, 1, 100, 50)}`);
    return res.status(result.ok ? 200 : 502).json({ ok: result.ok, jobs: result.rows, code: result.code });
  });

  app.get("/api/creator/generation/jobs/:jobId", access, async (req, res) => {
    const context = await resolveContext(req, deps);
    if (!context.ok) return res.status(context.status).json(context);
    const config = getConfig(deps);
    if (!config.ok) return res.status(503).json({ ok: false, code: "supabase_setup_required" });
    const job = await loadJob(config, context, req.params.jobId);
    if (!job.ok) return res.status(job.status).json(job);
    const assets = await rest(config, ASSET_TABLE, `select=*&job_id=eq.${encodeURIComponent(job.job.id)}&organization_id=eq.${encodeURIComponent(context.organizationId)}&order=created_at.asc`);
    return res.status(200).json({ ok: true, job: job.job, assets: assets.ok ? assets.rows : [] });
  });

  app.post("/api/creator/generation/jobs", access, async (req, res) => {
    const context = await resolveContext(req, deps);
    if (!context.ok) return send(req, res, context, "/creator-studio/generation");
    const config = getConfig(deps);
    if (!config.ok) return send(req, res, { ok: false, status: 503, code: "supabase_setup_required" }, "/creator-studio/generation");

    const capability = clean(req.body.capability, 80);
    const prompt = clean(req.body.prompt, MAX_PROMPT_LENGTH + 1);
    const requestedProvider = clean(req.body.provider_key || req.body.providerKey || "auto", 80) || "auto";
    const parameters = parseObject(req.body.parameters, {});
    const inputAssets = parseArray(req.body.input_assets || req.body.inputAssets, []);
    const rightsAttested = truthy(req.body.rights_attested || req.body.rightsAttested);
    const consentAttested = truthy(req.body.consent_attested || req.body.consentAttested);
    const voiceConsentId = clean(req.body.voice_consent_id || req.body.voiceConsentId, 80) || null;

    const policy = await evaluatePolicy({
      config,
      context,
      capability,
      prompt,
      rightsAttested,
      consentAttested,
      voiceConsentId
    });
    if (!policy.ok && policy.status !== "review_required") {
      return send(req, res, { ok: false, status: policy.httpStatus, code: policy.code, reasons: policy.reasons }, "/creator-studio/generation");
    }

    const selected = chooseProvider(capability, requestedProvider);
    if (!selected.ok) return send(req, res, { ok: false, status: 400, code: selected.code }, "/creator-studio/generation");

    const initialStatus = policy.status === "review_required"
      ? "review_required"
      : selected.readiness.configured
        ? "queued"
        : selected.provider.adapterMode === "external_mcp"
          ? "manual_required"
          : "setup_required";

    const created = await insert(config, JOB_TABLE, {
      organization_id: context.organizationId,
      user_id: context.userId,
      project_id: validUuid(req.body.project_id || req.body.projectId) ? String(req.body.project_id || req.body.projectId) : null,
      capability,
      provider_key: selected.provider.key,
      title: nullable(req.body.title, 200),
      prompt,
      negative_prompt: nullable(req.body.negative_prompt || req.body.negativePrompt, 2000),
      input_assets: inputAssets,
      parameters,
      status: initialStatus,
      rights_attested: rightsAttested,
      consent_attested: consentAttested,
      voice_consent_id: validUuid(voiceConsentId) ? voiceConsentId : null,
      policy_status: policy.status,
      policy_reasons: policy.reasons,
      provider_response: initialStatus === "manual_required" ? { connector: "external_mcp", endpoint: selected.provider.integrationEndpoint || null } : {}
    });
    if (!created.ok) return send(req, res, { ok: false, status: 502, code: created.code }, "/creator-studio/generation");

    let job = created.rows[0];
    await event(config, context, job.id, "generation.job_created", "recorded", { capability, provider_key: selected.provider.key, policy_status: policy.status });

    if (job.status === "queued") {
      const dispatched = await dispatchJob(config, context, job, selected.provider);
      job = dispatched.job || job;
    }

    return send(req, res, { ok: true, status: 201, job }, `/api/creator/generation/jobs/${job.id}`);
  });

  app.post("/api/creator/generation/jobs/:jobId/refresh", access, async (req, res) => {
    const context = await resolveContext(req, deps);
    if (!context.ok) return res.status(context.status).json(context);
    const config = getConfig(deps);
    if (!config.ok) return res.status(503).json({ ok: false, code: "supabase_setup_required" });
    const loaded = await loadJob(config, context, req.params.jobId);
    if (!loaded.ok) return res.status(loaded.status).json(loaded);
    const provider = getProvider(loaded.job.provider_key);
    if (!provider) return res.status(409).json({ ok: false, code: "provider_not_found" });
    const refreshed = await refreshJob(config, context, loaded.job, provider);
    return res.status(refreshed.ok ? 200 : refreshed.status || 502).json(refreshed);
  });

  app.post("/api/creator/generation/jobs/:jobId/cancel", access, async (req, res) => {
    const context = await resolveContext(req, deps);
    if (!context.ok) return res.status(context.status).json(context);
    const config = getConfig(deps);
    if (!config.ok) return res.status(503).json({ ok: false, code: "supabase_setup_required" });
    const loaded = await loadJob(config, context, req.params.jobId);
    if (!loaded.ok) return res.status(loaded.status).json(loaded);
    if (["completed", "failed", "cancelled"].includes(loaded.job.status)) return res.status(409).json({ ok: false, code: "job_not_cancellable" });
    const updated = await updateJob(config, context, loaded.job.id, { status: "cancelled", cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    await event(config, context, loaded.job.id, "generation.job_cancelled", "success", { provider_key: loaded.job.provider_key });
    return res.status(updated.ok ? 200 : 502).json({ ok: updated.ok, job: updated.rows[0], code: updated.code });
  });

  app.get("/api/creator/generation/voice-consents", access, async (req, res) => {
    const context = await resolveContext(req, deps);
    if (!context.ok) return res.status(context.status).json(context);
    const config = getConfig(deps);
    if (!config.ok) return res.status(503).json({ ok: false, code: "supabase_setup_required" });
    const result = await rest(config, CONSENT_TABLE, `select=*&organization_id=eq.${encodeURIComponent(context.organizationId)}&user_id=eq.${encodeURIComponent(context.userId)}&order=created_at.desc&limit=100`);
    return res.status(result.ok ? 200 : 502).json({ ok: result.ok, consents: result.rows, code: result.code });
  });

  app.post("/api/creator/generation/voice-consents", access, async (req, res) => {
    const context = await resolveContext(req, deps);
    if (!context.ok) return res.status(context.status).json(context);
    const config = getConfig(deps);
    if (!config.ok) return res.status(503).json({ ok: false, code: "supabase_setup_required" });
    if (!truthy(req.body.consent_attested || req.body.consentAttested)) return res.status(400).json({ ok: false, code: "voice_consent_attestation_required" });
    const subjectType = oneOf(req.body.subject_type || req.body.subjectType, ["self","authorized_person","synthetic_voice","licensed_voice"], null);
    const consentScope = oneOf(req.body.consent_scope || req.body.consentScope, ["text_to_speech","speech_to_speech","voice_clone","singing_voice","all_voice_generation"], null);
    const evidenceType = oneOf(req.body.evidence_type || req.body.evidenceType, ["self_attestation","signed_release","provider_voice_id","license_record","other"], null);
    if (!subjectType || !consentScope || !evidenceType) return res.status(400).json({ ok: false, code: "voice_consent_fields_required" });
    const created = await insert(config, CONSENT_TABLE, {
      organization_id: context.organizationId,
      user_id: context.userId,
      subject_type: subjectType,
      subject_name: nullable(req.body.subject_name || req.body.subjectName, 200),
      consent_scope: consentScope,
      evidence_type: evidenceType,
      evidence_reference: nullable(req.body.evidence_reference || req.body.evidenceReference, 1000),
      consent_attested: true,
      expires_at: validDate(req.body.expires_at || req.body.expiresAt),
      metadata: parseObject(req.body.metadata, {})
    });
    return res.status(created.ok ? 201 : 502).json({ ok: created.ok, consent: created.rows[0], code: created.code });
  });

  app.post("/api/creator/reference-analyses", access, async (req, res) => {
    const context = await resolveContext(req, deps);
    if (!context.ok) return res.status(context.status).json(context);
    const config = getConfig(deps);
    if (!config.ok) return res.status(503).json({ ok: false, code: "supabase_setup_required" });
    if (!truthy(req.body.source_rights_attested || req.body.sourceRightsAttested)) return res.status(400).json({ ok: false, code: "source_rights_attestation_required" });
    const analysisType = oneOf(req.body.analysis_type || req.body.analysisType, ["audio_structure","music_theory","voice_characteristics","video_structure","shot_language","visual_style","mixed_media"], null);
    if (!analysisType) return res.status(400).json({ ok: false, code: "analysis_type_required" });
    const constraints = parseObject(req.body.originality_constraints || req.body.originalityConstraints, { create_original_output_only: true, identity_imitation_prohibited: true });
    const created = await insert(config, ANALYSIS_TABLE, {
      organization_id: context.organizationId,
      user_id: context.userId,
      source_asset_id: validUuid(req.body.source_asset_id || req.body.sourceAssetId) ? String(req.body.source_asset_id || req.body.sourceAssetId) : null,
      source_rights_attested: true,
      analysis_type: analysisType,
      structural_features: {},
      originality_constraints: { ...constraints, create_original_output_only: true, identity_imitation_prohibited: true },
      prohibited_identity_targets: parseArray(req.body.prohibited_identity_targets || req.body.prohibitedIdentityTargets, []),
      status: "queued"
    });
    return res.status(created.ok ? 201 : 502).json({ ok: created.ok, analysis: created.rows[0], code: created.code });
  });

  app.get("/creator-studio/generation", access, async (req, res) => {
    const context = await resolveContext(req, deps);
    const config = getConfig(deps);
    let jobs = [];
    if (context.ok && config.ok) {
      const listed = await rest(config, JOB_TABLE, `select=id,title,capability,provider_key,status,progress_percent,created_at&organization_id=eq.${encodeURIComponent(context.organizationId)}&user_id=eq.${encodeURIComponent(context.userId)}&order=created_at.desc&limit=20`);
      jobs = listed.ok ? listed.rows : [];
    }
    const providers = getCreatorGenerationCatalog();
    const sections = [
      generationForm(providers, ui.escape),
      ui.card("Rights and consent boundary", "Only upload or generate from material you own or are authorized to use. Voice conversion requires an active consent record. Direct celebrity, artist, or identity imitation is held for review."),
      ui.card("Provider execution", "ElevenLabs and Google Veo use server-side adapters when configured. Suno requires the exact account API contract. Higgsfield uses its official external MCP connector. Open-source models run only on an isolated GPU worker."),
      jobTable(jobs, ui.escape),
      ...providers.map((item) => ui.card(`${item.label}: ${display(item.readiness.status)}`, `${item.capabilities.join(", ")}. ${item.license}`))
    ];
    return res.status(200).type("html").send(ui.layout({
      title: "Generation Studio",
      eyebrow: "Creator Studio",
      heading: "Video, audio, music, and voice generation",
      body: "Create governed media jobs, route them to configured providers, retain private outputs, and preserve rights, consent, provenance, and audit evidence.",
      sections,
      actions: [ui.link("/api/creator/generation/readiness", "Readiness JSON"), ui.link("/api/creator/generation/jobs", "Jobs JSON"), ui.link("/creator-studio/music-system", "Music System"), ui.link("/creator-studio/dashboard", "Dashboard")]
    }));
  });

  for (const [path, title, capability] of [
    ["/creator-studio/generation/voice", "Voice Generation", "text_to_speech"],
    ["/creator-studio/generation/music", "Music Generation", "text_to_music"],
    ["/creator-studio/generation/audio", "Audio and Sound Effects", "sound_effects"],
    ["/creator-studio/generation/video", "Video Generation", "text_to_video"],
    ["/creator-studio/generation/reference-analysis", "Reference Analysis", "reference_analysis"]
  ]) {
    app.get(path, access, (req, res) => res.redirect(302, `/creator-studio/generation?capability=${encodeURIComponent(capability)}&title=${encodeURIComponent(title)}`));
  }
};

async function dispatchJob(config, context, job, provider) {
  const readiness = getProviderReadiness(provider);
  if (!readiness.configured) return { ok: false, job };
  await updateJob(config, context, job.id, { status: "submitted", submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  await event(config, context, job.id, "generation.dispatch_started", "recorded", { provider_key: provider.key, capability: job.capability });
  try {
    if (provider.key === "elevenlabs") return await dispatchElevenLabs(config, context, job, provider);
    if (provider.key === "google_veo") return await dispatchGoogleVeo(config, context, job, provider);
    if (provider.key === "suno") return await dispatchSuno(config, context, job, provider);
    if (provider.key === "open_source_media_worker") return await dispatchWorker(config, context, job, provider);
    const updated = await updateJob(config, context, job.id, { status: "manual_required", provider_response: { connector: provider.adapterMode }, updated_at: new Date().toISOString() });
    return { ok: true, job: updated.rows[0] };
  } catch (error) {
    const failed = await failJob(config, context, job.id, "provider_dispatch_failed", safeError(error));
    return { ok: false, job: failed.rows[0], status: 502 };
  }
}

async function dispatchElevenLabs(config, context, job, provider) {
  const base = String(process.env[provider.baseUrlEnv] || provider.defaultBaseUrl).replace(/\/$/, "");
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const headers = { "xi-api-key": apiKey, Accept: "application/json" };
  let endpoint;
  let body;
  let expectsBinary = false;

  if (job.capability === "text_to_speech") {
    const voiceId = clean(job.parameters?.voice_id || job.parameters?.voiceId, 200);
    if (!voiceId) return failedValidation(config, context, job, "voice_id_required");
    const outputFormat = encodeURIComponent(clean(job.parameters?.output_format, 80) || "mp3_44100_128");
    endpoint = `${base}/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${outputFormat}`;
    body = { text: job.prompt, model_id: clean(job.parameters?.model_id, 120) || "eleven_multilingual_v2", voice_settings: job.parameters?.voice_settings || undefined };
    expectsBinary = true;
  } else if (job.capability === "sound_effects") {
    endpoint = `${base}/v1/sound-generation`;
    body = { text: job.prompt, duration_seconds: numberOrUndefined(job.parameters?.duration_seconds), prompt_influence: numberOrUndefined(job.parameters?.prompt_influence) };
    expectsBinary = true;
  } else if (job.capability === "text_to_music") {
    endpoint = `${base}/v1/music`;
    body = { prompt: job.prompt, music_length_ms: integerOr(job.parameters?.music_length_ms, 30000), model_id: clean(job.parameters?.model_id, 100) || "music_v2", force_instrumental: truthy(job.parameters?.force_instrumental) };
    expectsBinary = true;
  } else if (job.capability === "music_plan") {
    endpoint = `${base}/v1/music/plan`;
    body = { prompt: job.prompt, music_length_ms: integerOr(job.parameters?.music_length_ms, 30000), model_id: clean(job.parameters?.model_id, 100) || "music_v2" };
  } else {
    return failedValidation(config, context, job, "elevenlabs_capability_requires_private_asset_pipeline");
  }

  const response = await fetch(endpoint, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(compact(body)) });
  if (!response.ok) return failProviderResponse(config, context, job, response, "elevenlabs_request_failed");

  if (!expectsBinary) {
    const payload = await response.json().catch(() => ({}));
    const completed = await updateJob(config, context, job.id, { status: "completed", progress_percent: 100, provider_response: sanitizeProviderPayload(payload), completed_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    await event(config, context, job.id, "generation.completed", "success", { provider_key: provider.key, output: "json" });
    return { ok: true, job: completed.rows[0] };
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  const mime = normalizeMime(response.headers.get("content-type") || (job.capability === "text_to_music" ? "audio/mpeg" : "audio/mpeg"));
  const stored = await storeOutput(config, context, job, bytes, mime, provider.key);
  if (!stored.ok) return failJobResult(config, context, job, "output_storage_failed", stored.code);
  const completed = await updateJob(config, context, job.id, { status: "completed", progress_percent: 100, provider_response: { asset_id: stored.asset.id, mime_type: mime, byte_size: bytes.length }, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  await event(config, context, job.id, "generation.completed", "success", { provider_key: provider.key, asset_id: stored.asset.id });
  return { ok: true, job: completed.rows[0], asset: stored.asset };
}

async function dispatchGoogleVeo(config, context, job, provider) {
  const base = String(process.env[provider.baseUrlEnv] || provider.defaultBaseUrl).replace(/\/$/, "");
  const model = String(process.env[provider.modelEnv] || provider.defaultModel);
  const body = {
    instances: [{ prompt: job.prompt, ...(job.parameters?.instance || {}) }],
    parameters: compact({
      aspectRatio: job.parameters?.aspect_ratio || "16:9",
      resolution: job.parameters?.resolution || "720p",
      durationSeconds: integerOr(job.parameters?.duration_seconds, undefined),
      negativePrompt: job.negative_prompt || undefined,
      sampleCount: integerOr(job.parameters?.sample_count, 1),
      ...(job.parameters?.provider_parameters || {})
    })
  };
  const response = await fetch(`${base}/models/${encodeURIComponent(model)}:predictLongRunning`, {
    method: "POST",
    headers: { "x-goog-api-key": process.env.GEMINI_API_KEY, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) return failProviderResponse(config, context, job, response, "google_veo_submission_failed");
  const payload = await response.json().catch(() => ({}));
  const operationName = clean(payload.name, 500);
  if (!operationName) return failJobResult(config, context, job, "google_veo_operation_missing", "Provider did not return an operation name.");
  const updated = await updateJob(config, context, job.id, { status: "running", progress_percent: 5, provider_job_id: operationName, provider_response: sanitizeProviderPayload(payload), started_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  await event(config, context, job.id, "generation.provider_submitted", "success", { provider_key: provider.key, operation_name: operationName });
  return { ok: true, job: updated.rows[0] };
}

async function dispatchSuno(config, context, job, provider) {
  const base = String(process.env.SUNO_API_BASE_URL || "").replace(/\/$/, "");
  const path = normalizePath(process.env.SUNO_GENERATE_PATH);
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.SUNO_API_KEY}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ capability: job.capability, prompt: job.prompt, negative_prompt: job.negative_prompt, parameters: job.parameters })
  });
  if (!response.ok) return failProviderResponse(config, context, job, response, "suno_submission_failed");
  const payload = await response.json().catch(() => ({}));
  const providerJobId = clean(payload.id || payload.job_id || payload.task_id, 500);
  const status = providerJobId ? "running" : payload.output_url || payload.audio_url ? "running" : "failed";
  const updated = await updateJob(config, context, job.id, { status, progress_percent: status === "running" ? 5 : 0, provider_job_id: providerJobId || null, provider_response: sanitizeProviderPayload(payload), started_at: new Date().toISOString(), error_code: status === "failed" ? "suno_job_id_missing" : null, updated_at: new Date().toISOString() });
  return { ok: status !== "failed", job: updated.rows[0] };
}

async function dispatchWorker(config, context, job, provider) {
  const base = String(process.env.CREATOR_MEDIA_WORKER_URL || "").replace(/\/$/, "");
  const response = await fetch(`${base}/v1/jobs`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.CREATOR_MEDIA_WORKER_TOKEN}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ idempotency_key: job.id, organization_id: context.organizationId, user_id: context.userId, capability: job.capability, prompt: job.prompt, negative_prompt: job.negative_prompt, input_assets: job.input_assets, parameters: job.parameters })
  });
  if (!response.ok) return failProviderResponse(config, context, job, response, "media_worker_submission_failed");
  const payload = await response.json().catch(() => ({}));
  const providerJobId = clean(payload.id || payload.job_id, 500);
  if (!providerJobId) return failJobResult(config, context, job, "media_worker_job_id_missing", "Worker did not return a job id.");
  const updated = await updateJob(config, context, job.id, { status: "running", progress_percent: integerOr(payload.progress_percent, 1), provider_job_id: providerJobId, provider_response: sanitizeProviderPayload(payload), started_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  return { ok: true, job: updated.rows[0] };
}

async function refreshJob(config, context, job, provider) {
  if (["completed", "failed", "cancelled", "review_required", "manual_required", "setup_required"].includes(job.status)) return { ok: true, job, unchanged: true };
  try {
    if (provider.key === "google_veo") return refreshGoogleVeo(config, context, job, provider);
    if (provider.key === "suno") return refreshSuno(config, context, job);
    if (provider.key === "open_source_media_worker") return refreshWorker(config, context, job);
    return { ok: true, job, unchanged: true };
  } catch (error) {
    const failed = await failJob(config, context, job.id, "provider_refresh_failed", safeError(error));
    return { ok: false, status: 502, job: failed.rows[0], code: "provider_refresh_failed" };
  }
}

async function refreshGoogleVeo(config, context, job, provider) {
  if (!job.provider_job_id) return { ok: false, status: 409, code: "provider_job_id_missing" };
  const base = String(process.env[provider.baseUrlEnv] || provider.defaultBaseUrl).replace(/\/$/, "");
  const response = await fetch(`${base}/${String(job.provider_job_id).replace(/^\//, "")}`, { headers: { "x-goog-api-key": process.env.GEMINI_API_KEY, Accept: "application/json" } });
  if (!response.ok) return failProviderResponse(config, context, job, response, "google_veo_refresh_failed");
  const payload = await response.json().catch(() => ({}));
  if (!payload.done) {
    const updated = await updateJob(config, context, job.id, { status: "running", progress_percent: Math.max(Number(job.progress_percent || 5), 10), provider_response: sanitizeProviderPayload(payload), updated_at: new Date().toISOString() });
    return { ok: true, job: updated.rows[0] };
  }
  if (payload.error) return failJobResult(config, context, job, "google_veo_generation_failed", clean(payload.error.message || JSON.stringify(payload.error), 2000));
  const uri = findOutputUrl(payload);
  if (!uri) return failJobResult(config, context, job, "google_veo_output_missing", "Completed operation did not include a downloadable video URI.");
  const download = await fetch(uri, { headers: { "x-goog-api-key": process.env.GEMINI_API_KEY } });
  if (!download.ok) return failProviderResponse(config, context, job, download, "google_veo_download_failed");
  const bytes = Buffer.from(await download.arrayBuffer());
  const mime = normalizeMime(download.headers.get("content-type") || "video/mp4");
  const stored = await storeOutput(config, context, job, bytes, mime, provider.key);
  if (!stored.ok) return failJobResult(config, context, job, "output_storage_failed", stored.code);
  const completed = await updateJob(config, context, job.id, { status: "completed", progress_percent: 100, provider_response: { operation: sanitizeProviderPayload(payload), asset_id: stored.asset.id }, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  await event(config, context, job.id, "generation.completed", "success", { provider_key: provider.key, asset_id: stored.asset.id });
  return { ok: true, job: completed.rows[0], asset: stored.asset };
}

async function refreshSuno(config, context, job) {
  if (!job.provider_job_id) return { ok: false, status: 409, code: "provider_job_id_missing" };
  const base = String(process.env.SUNO_API_BASE_URL || "").replace(/\/$/, "");
  const path = normalizePath(String(process.env.SUNO_STATUS_PATH_TEMPLATE || "").replace("{id}", encodeURIComponent(job.provider_job_id)));
  const response = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${process.env.SUNO_API_KEY}`, Accept: "application/json" } });
  if (!response.ok) return failProviderResponse(config, context, job, response, "suno_refresh_failed");
  const payload = await response.json().catch(() => ({}));
  return completeFromProviderPayload(config, context, job, payload, "suno");
}

async function refreshWorker(config, context, job) {
  if (!job.provider_job_id) return { ok: false, status: 409, code: "provider_job_id_missing" };
  const base = String(process.env.CREATOR_MEDIA_WORKER_URL || "").replace(/\/$/, "");
  const response = await fetch(`${base}/v1/jobs/${encodeURIComponent(job.provider_job_id)}`, { headers: { Authorization: `Bearer ${process.env.CREATOR_MEDIA_WORKER_TOKEN}`, Accept: "application/json" } });
  if (!response.ok) return failProviderResponse(config, context, job, response, "media_worker_refresh_failed");
  const payload = await response.json().catch(() => ({}));
  return completeFromProviderPayload(config, context, job, payload, "open_source_media_worker");
}

async function completeFromProviderPayload(config, context, job, payload, providerKey) {
  const providerStatus = String(payload.status || "").toLowerCase();
  if (["failed", "error"].includes(providerStatus)) return failJobResult(config, context, job, `${providerKey}_generation_failed`, clean(payload.error || payload.message, 2000));
  const outputUrl = findOutputUrl(payload);
  if (["completed", "succeeded", "done"].includes(providerStatus) && outputUrl) {
    const downloaded = await fetchSafeOutput(outputUrl);
    if (!downloaded.ok) return failJobResult(config, context, job, "provider_output_download_failed", downloaded.code);
    const stored = await storeOutput(config, context, job, downloaded.bytes, downloaded.mime, providerKey);
    if (!stored.ok) return failJobResult(config, context, job, "output_storage_failed", stored.code);
    const completed = await updateJob(config, context, job.id, { status: "completed", progress_percent: 100, provider_response: { payload: sanitizeProviderPayload(payload), asset_id: stored.asset.id }, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    return { ok: true, job: completed.rows[0], asset: stored.asset };
  }
  const updated = await updateJob(config, context, job.id, { status: "running", progress_percent: clamp(payload.progress_percent, 1, 99, Math.max(Number(job.progress_percent || 1), 5)), provider_response: sanitizeProviderPayload(payload), updated_at: new Date().toISOString() });
  return { ok: true, job: updated.rows[0] };
}

async function evaluatePolicy({ config, context, capability, prompt, rightsAttested, consentAttested, voiceConsentId }) {
  const reasons = [];
  if (!capability) return { ok: false, httpStatus: 400, code: "capability_required", reasons };
  if (!prompt && capability !== "reference_analysis") return { ok: false, httpStatus: 400, code: "prompt_required", reasons };
  if (prompt.length > MAX_PROMPT_LENGTH) return { ok: false, httpStatus: 400, code: "prompt_too_long", reasons: [`Maximum ${MAX_PROMPT_LENGTH} characters.`] };
  if (!rightsAttested) return { ok: false, httpStatus: 400, code: "rights_attestation_required", reasons };
  for (const pattern of IMITATION_PATTERNS) if (pattern.test(prompt)) reasons.push("direct_identity_or_work_imitation_language");
  if (reasons.length) return { ok: false, status: "review_required", httpStatus: 202, code: "human_review_required", reasons };
  if (VOICE_CAPABILITIES.has(capability)) {
    if (!consentAttested || !validUuid(voiceConsentId)) return { ok: false, httpStatus: 400, code: "active_voice_consent_required", reasons };
    const consent = await rest(config, CONSENT_TABLE, `select=id,consent_attested,consent_scope,expires_at,revoked_at&organization_id=eq.${encodeURIComponent(context.organizationId)}&user_id=eq.${encodeURIComponent(context.userId)}&id=eq.${encodeURIComponent(voiceConsentId)}&limit=1`);
    const row = consent.rows[0];
    if (!consent.ok || !row || !row.consent_attested || row.revoked_at || (row.expires_at && Date.parse(row.expires_at) <= Date.now())) return { ok: false, httpStatus: 400, code: "active_voice_consent_required", reasons };
  }
  return { ok: true, status: "approved", reasons };
}

async function storeOutput(config, context, job, bytes, mime, providerKey) {
  const bucket = job.capability === "text_to_music" || job.capability === "music_plan" || job.capability === "video_to_music" ? "music-stems" : "creator-assets";
  const extension = extensionForMime(mime);
  const objectPath = `${context.organizationId}/${context.userId}/${job.id}/${randomUUID()}.${extension}`;
  const storageResponse = await fetch(`${config.url}/storage/v1/object/${bucket}/${objectPath.split("/").map(encodeURIComponent).join("/")}`, {
    method: "POST",
    headers: { apikey: config.serviceRoleKey, Authorization: `Bearer ${config.serviceRoleKey}`, "Content-Type": mime, "x-upsert": "false" },
    body: bytes
  }).catch(() => undefined);
  if (!storageResponse?.ok) return { ok: false, code: `storage_upload_failed_${storageResponse?.status || "unreachable"}` };
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const inserted = await insert(config, ASSET_TABLE, {
    organization_id: context.organizationId,
    user_id: context.userId,
    job_id: job.id,
    asset_role: "output",
    media_type: mediaTypeFor(job.capability, mime),
    bucket_id: bucket,
    object_path: objectPath,
    mime_type: mime,
    byte_size: bytes.length,
    checksum_sha256: checksum,
    provenance: { provider_key: providerKey, generated: true, rights_attested: job.rights_attested, consent_attested: job.consent_attested },
    metadata: {}
  });
  if (!inserted.ok) return { ok: false, code: inserted.code };
  return { ok: true, asset: inserted.rows[0] };
}

async function loadJob(config, context, jobId) {
  if (!validUuid(jobId)) return { ok: false, status: 400, code: "invalid_job_id" };
  const result = await rest(config, JOB_TABLE, `select=*&id=eq.${encodeURIComponent(jobId)}&organization_id=eq.${encodeURIComponent(context.organizationId)}&user_id=eq.${encodeURIComponent(context.userId)}&limit=1`);
  if (!result.ok) return { ok: false, status: 502, code: result.code };
  if (!result.rows[0]) return { ok: false, status: 404, code: "generation_job_not_found" };
  return { ok: true, job: result.rows[0] };
}

async function resolveContext(req, deps) {
  const user = req.sonaraUser || req.sonaraCustomer?.user || req.sonaraAccess?.user || null;
  if (!user?.id) return { ok: false, status: 401, code: "creator_auth_required" };
  if (typeof deps.getCustomerPrimaryOrganization !== "function") return { ok: false, status: 503, code: "organization_resolver_unavailable" };
  const organization = await deps.getCustomerPrimaryOrganization(user);
  if (!organization?.ok) return { ok: false, status: 409, code: organization?.code || "organization_setup_required" };
  return { ok: true, organizationId: organization.organizationId, userId: user.id };
}

function getConfig(deps) {
  if (typeof deps.getSupabaseServerConfig === "function") return deps.getSupabaseServerConfig();
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && serviceRoleKey ? { ok: true, url: String(url).replace(/\/$/, ""), serviceRoleKey } : { ok: false };
}

async function rest(config, table, query = "", options = {}) {
  const response = await fetch(`${config.url}/rest/v1/${table}${query ? `?${query}` : ""}`, {
    method: options.method || "GET",
    headers: { apikey: config.serviceRoleKey, Authorization: `Bearer ${config.serviceRoleKey}`, "Content-Type": "application/json", ...(options.prefer ? { Prefer: options.prefer } : {}) },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  }).catch(() => undefined);
  if (!response) return { ok: false, status: 503, code: "database_unreachable", rows: [] };
  const rows = response.status === 204 ? [] : await response.json().catch(() => []);
  return { ok: response.ok, status: response.status, code: response.ok ? "ok" : "database_operation_failed", rows: Array.isArray(rows) ? rows : [] };
}

function insert(config, table, body) { return rest(config, table, "", { method: "POST", prefer: "return=representation", body }); }
function updateJob(config, context, jobId, patch) { return rest(config, JOB_TABLE, `id=eq.${encodeURIComponent(jobId)}&organization_id=eq.${encodeURIComponent(context.organizationId)}&user_id=eq.${encodeURIComponent(context.userId)}`, { method: "PATCH", prefer: "return=representation", body: patch }); }
async function event(config, context, jobId, type, status, details) { return insert(config, EVENT_TABLE, { organization_id: context.organizationId, user_id: context.userId, job_id: jobId, event_type: type, event_status: status, details }); }

async function failedValidation(config, context, job, code) { return failJobResult(config, context, job, code, code.replaceAll("_", " ")); }
async function failJobResult(config, context, job, code, message) { const result = await failJob(config, context, job.id, code, message); return { ok: false, status: 400, code, job: result.rows[0] }; }
async function failJob(config, context, jobId, code, message) {
  await event(config, context, jobId, "generation.failed", "failed", { code, message: clean(message, 500) });
  return updateJob(config, context, jobId, { status: "failed", error_code: code, error_message: clean(message, 2000), updated_at: new Date().toISOString() });
}
async function failProviderResponse(config, context, job, response, code) {
  const message = clean(await response.text().catch(() => ""), 1500) || `Provider returned HTTP ${response.status}`;
  const failed = await failJob(config, context, job.id, code, message);
  return { ok: false, status: 502, code, job: failed.rows[0] };
}

async function fetchSafeOutput(value) {
  let url;
  try { url = new URL(String(value)); } catch { return { ok: false, code: "invalid_output_url" }; }
  if (url.protocol !== "https:") return { ok: false, code: "insecure_output_url" };
  const response = await fetch(url, { redirect: "error" }).catch(() => undefined);
  if (!response?.ok) return { ok: false, code: `output_download_failed_${response?.status || "unreachable"}` };
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > 160 * 1024 * 1024) return { ok: false, code: "output_too_large" };
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 160 * 1024 * 1024) return { ok: false, code: "output_too_large" };
  return { ok: true, bytes, mime: normalizeMime(response.headers.get("content-type") || "application/octet-stream") };
}

function findOutputUrl(payload) {
  const candidates = [
    payload?.output_url, payload?.audio_url, payload?.video_url, payload?.url,
    payload?.output?.url, payload?.result?.url,
    payload?.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri,
    payload?.response?.generatedVideos?.[0]?.video?.uri,
    payload?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri
  ];
  return candidates.find((value) => /^https:\/\//i.test(String(value || ""))) || null;
}

function generationForm(providers, escape) {
  const options = providers.filter((item) => item.adapterMode !== "reference_only").map((item) => `<option value="${escape(item.key)}">${escape(item.label)} · ${escape(display(item.readiness.status))}</option>`).join("");
  return `<article class="card"><h2>Create generation job</h2><form method="post" action="/api/creator/generation/jobs"><label>Title<input name="title" maxlength="200"></label><label>Capability<select name="capability"><option value="text_to_speech">Text to speech</option><option value="sound_effects">Sound effects</option><option value="text_to_music">Music</option><option value="music_plan">Music plan</option><option value="text_to_video">Text to video</option><option value="image_to_video">Image to video</option><option value="video_extend">Extend video</option></select></label><label>Provider<select name="provider_key"><option value="auto">Automatic configured provider</option>${options}</select></label><label>Prompt<textarea name="prompt" rows="7" maxlength="5000" required></textarea></label><label>Negative prompt<textarea name="negative_prompt" rows="3" maxlength="2000"></textarea></label><label>Provider parameters (JSON)<textarea name="parameters" rows="4" placeholder='{"duration_seconds":8}'></textarea></label><label><input type="checkbox" name="rights_attested" value="true" required> I own or am authorized to use every prompt, reference, likeness, voice, and source asset.</label><button type="submit">Create and dispatch job</button></form></article>`;
}

function jobTable(jobs, escape) {
  const rows = jobs.map((job) => `<tr><td><a href="/api/creator/generation/jobs/${encodeURIComponent(job.id)}">${escape(job.title || job.id)}</a></td><td>${escape(job.capability)}</td><td>${escape(job.provider_key)}</td><td>${escape(job.status)}</td><td>${escape(String(job.progress_percent || 0))}%</td></tr>`).join("") || '<tr><td colspan="5">No generation jobs yet.</td></tr>';
  return `<article class="card"><h2>Recent jobs</h2><table><thead><tr><th>Job</th><th>Capability</th><th>Provider</th><th>Status</th><th>Progress</th></tr></thead><tbody>${rows}</tbody></table></article>`;
}

function buildUi(deps) {
  const escape = deps.escapeHtml || esc;
  return { layout: deps.layout || basicLayout, card: deps.brandCard || card, link: deps.linkAction || link, escape };
}
function send(req, res, result, redirectTo) { const status = Number(result.status || (result.ok ? 200 : 400)); return acceptsHtml(req) ? (result.ok ? res.redirect(303, redirectTo) : res.status(status).type("html").send(`<h1>Generation action not completed</h1><p>${esc(result.code || "request_failed")}</p><p><a href="${esc(redirectTo)}">Return</a></p>`)) : res.status(status).json(result); }
function acceptsHtml(req) { return String(req.get("accept") || "").includes("text/html") || String(req.get("content-type") || "").includes("application/x-www-form-urlencoded"); }
function pass(req, res, next) { next(); }
function esc(value) { return String(value || "").replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char])); }
function card(title, body) { return `<article class="card"><h2>${esc(title)}</h2><p>${esc(body)}</p></article>`; }
function link(href, label) { return `<a class="action" href="${esc(href)}">${esc(label)}</a>`; }
function basicLayout(data) { return `<!doctype html><html><head><title>${esc(data.title)}</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main><p>${esc(data.eyebrow)}</p><h1>${esc(data.heading)}</h1><p>${esc(data.body)}</p><nav>${(data.actions || []).join("")}</nav><section>${(data.sections || []).join("")}</section></main></body></html>`; }
function display(value) { return String(value || "unknown").replaceAll("_", " "); }
function clean(value, max = 500) { return String(value || "").trim().slice(0, max); }
function nullable(value, max = 500) { const text = clean(value, max); return text || null; }
function validUuid(value) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || "")); }
function validDate(value) { if (!value) return null; const parsed = new Date(String(value)); return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString(); }
function truthy(value) { return [true, 1, "1", "true", "yes", "on", "attested"].includes(typeof value === "string" ? value.toLowerCase() : value); }
function parseObject(value, fallback) { if (value && typeof value === "object" && !Array.isArray(value)) return value; if (!String(value || "").trim()) return fallback; try { const parsed = JSON.parse(String(value)); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback; } catch { return fallback; } }
function parseArray(value, fallback) { if (Array.isArray(value)) return value; if (!String(value || "").trim()) return fallback; try { const parsed = JSON.parse(String(value)); return Array.isArray(parsed) ? parsed : fallback; } catch { return fallback; } }
function oneOf(value, allowed, fallback) { const normalized = String(value || "").trim().toLowerCase(); return allowed.includes(normalized) ? normalized : fallback; }
function integerOr(value, fallback) { const parsed = Number.parseInt(String(value ?? ""), 10); return Number.isFinite(parsed) ? parsed : fallback; }
function numberOrUndefined(value) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : undefined; }
function clamp(value, min, max, fallback) { const parsed = Number.parseInt(String(value ?? ""), 10); return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback; }
function compact(object) { return Object.fromEntries(Object.entries(object || {}).filter(([, value]) => value !== undefined && value !== null && value !== "")); }
function normalizePath(value) { const path = String(value || "").trim(); return path.startsWith("/") ? path : `/${path}`; }
function normalizeMime(value) { return String(value || "application/octet-stream").split(";")[0].trim().toLowerCase(); }
function extensionForMime(mime) { return ({ "audio/mpeg": "mp3", "audio/wav": "wav", "audio/x-wav": "wav", "audio/flac": "flac", "video/mp4": "mp4", "application/json": "json" })[mime] || "bin"; }
function mediaTypeFor(capability, mime) { if (mime.startsWith("video/")) return "video"; if (capability === "text_to_music" || capability === "video_to_music") return "music"; if (capability.includes("speech")) return "voice"; if (mime.startsWith("audio/")) return "audio"; return "other"; }
function sanitizeProviderPayload(value) { if (!value || typeof value !== "object") return {}; const copy = JSON.parse(JSON.stringify(value)); for (const key of ["api_key","token","authorization","credential","secret"]) removeSensitive(copy, key); return copy; }
function removeSensitive(value, target) { if (!value || typeof value !== "object") return; for (const key of Object.keys(value)) { if (key.toLowerCase().includes(target)) value[key] = "[redacted]"; else removeSensitive(value[key], target); } }
function safeError(error) { return clean(error?.message || error || "Unknown provider error", 1000); }

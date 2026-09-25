Warning: truncated output (original token count: 24448)
Total output lines: 1501

// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { createHash, randomUUID } = require("node:crypto");
const { finiteNumber } = require("../lib/sonara-owner-record-pages.cjs");
const {
  getProvider,
  getProviderReadiness,
  getCreatorGenerationCatalog,
  chooseProvider
} = require("../lib/creator-generation-provider-registry.cjs");
const {
  generationStatus,
  generationStatusLabel,
  generationCapabilityLabel,
  generationAvailability,
  generationAvailabilityLabel,
  generationFailureText,
  voiceSubjectLabel,
  voiceScopeLabel,
  voiceEvidenceLabel
} = require("../lib/sonara-plain-language.cjs");

const JOB_TABLE = "creator_generation_jobs";
const ASSET_TABLE = "creator_generation_assets";
const provenanceOf = require("../lib/sonara-generation-provenance.cjs");
const {
  preflight: generationPreflight,
  gpuSecondsFor: generationGpuSecondsFor,
  BILLED_CAPABILITY: BILLED_GENERATION_CAPABILITY
} = require("../lib/creator-generation-billing.cjs");
const {
  authoriseUsage,
  drawEntry,
  createBalanceReader,
  createLedgerAppender,
  DEFAULT_STARTING_ALLOWANCE_MINOR
} = require("../lib/sonara-usage-meter.cjs");
const { redactSensitiveText } = require("../lib/sonara-redaction.cjs");
const studioPlatform = require("../data/sonara-studio-platform-2026-09-22.json");
const {
  renderFailureCard,
  renderSetupStateCard,
  setupStateFor
} = require("../lib/sonara-setup-state.cjs");
const CONSENT_TABLE = "creator_voice_consents";
const ANALYSIS_TABLE = "creator_reference_analyses";
const EVENT_TABLE = "creator_generation_events";
const VOICE_CAPABILITIES = new Set(["speech_to_speech", "voice_clone", "singing_voice", "music_voice_profile", "talking_avatar"]);

// Which permission covers which capability.
//
// `consent_scope` was selected on every voice job and never compared to
// anything. So a permission granted for text-to-speech authorised a voice
// clone: the column was read, which is what made it look checked, and the one
// field that says *what the person agreed to* decided nothing. AGENTS.md is
// explicit -- "Enforce provenance, consent, and anti-clone safety" -- and a
// consent record whose scope is ignored is a record of the wrong agreement.
//
// `all_voice_generation` covers everything, because that is what it says.
// text_to_speech is a scope somebody can grant and is not a gated capability:
// synthesising a voice that is nobody's needs no permission from anyone, so it
// never reaches this map.
//
// music_voice_profile and talking_avatar have no scope of their own in
// migration 20260723080000's check constraint, so only the blanket permission
// covers them. That is deliberate and stated rather than quietly widened: the
// alternative is deciding on somebody's behalf that "singing voice" included
// their face.
const CONSENT_SCOPE_FOR_CAPABILITY = Object.freeze({
  speech_to_speech: ["speech_to_speech"],
  voice_clone: ["voice_clone"],
  singing_voice: ["singing_voice"],
  music_voice_profile: [],
  talking_avatar: []
});
const BLANKET_CONSENT_SCOPE = "all_voice_generation";

// What the create form offers, in the order it offers it.
//
// This list is the intent -- which capabilities belong on this form -- and it
// is filtered by what a provider can actually do before anything is rendered.
// The hand-written option list it replaces offered `voice_clone` and
// `singing_voice`, and **no provider in
// lib/creator-generation-provider-registry.cjs declares either**. So the two
// most sensitive things on the menu were the two that could not run: a customer
// picked "Voice copy", was told voice work needs a permission on file, went and
// recorded one naming a real person, came back, pressed the button and got
// capability_not_supported.
//
// Both come back on their own the moment a provider declares them, which is the
// property a hand-written list cannot have.
//
// `reference_analysis` is deliberately absent, and that is an open question
// rather than an oversight -- see the note on the reference-analysis redirect.
const FORM_CAPABILITY_ORDER = Object.freeze([
  "text_to_speech",
  "sound_effects",
  "text_to_music",
  "music_plan",
  "text_to_video",
  "image_to_video",
  "video_extend",
  "speech_to_speech",
  "voice_clone",
  "singing_voice",
  "music_voice_profile",
  "talking_avatar"
]);

function offeredCapabilities(env = process.env) {
  const supported = new Set();
  for (const provider of getCreatorGenerationCatalog(env)) {
    for (const capability of provider.capabilities || []) supported.add(capability);
  }
  return FORM_CAPABILITY_ORDER.filter((capability) => supported.has(capability));
}
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

  app.get("/api/creator/studio/capabilities", access, (req, res) => {
    return res.status(200).json({
      ok: true,
      product: studioPlatform.productDecision,
      capabilities: studioPlatform.capabilities,
      technologyPatterns: studioPlatform.technologyPatterns,
      industryPackOrder: studioPlatform.industryPackOrder,
      executionEnabledByThisSurface: false
    });
  });

  app.get("/creator-studio/studio", access, (req, res) => {
    const grouped = new Map();
    for (const capability of studioPlatform.capabilities) {
      const domain = String(capability.domain || "other");
      const capabilities = grouped.get(domain) || [];
      capabilities.push(capability);
      grouped.set(domain, capabilities);
    }

    const sections = [
      ui.card(
        "What this Studio is",
        "A governed workspace for projects, media, documents, generation, review, publishing preparation, analytics, rights, and agent workflows. This page is a capability map: planned or research-only items do not execute from this surface."
      ),
      ui.card(
        "Production boundary",
        "Heavy media, GPU, 3D, CAD, game-engine, transcription, and long-running jobs stay in isolated workers or approved companion tools. Publishing, payments, destructive actions, regulated workflows, voice cloning, and likeness-sensitive work remain approval-gated."
      ),
      ...Array.from(grouped.entries(), ([domain, capabilities]) => ui.card(
        studioDomainLabel(domain),
        capabilities.map((capability) =>
          `${capability.surface}: ${studioCapabilityState(capability.adoptionState)} — ${capability.purpose}`
        ).join(" ")
      ))
    ];

    return res.status(200).type("html").send(ui.layout({
      title: "SONARA Studio",
      eyebrow: "Creator Studio",
      heading: "SONARA Studio",
      body: "Create, organize, review, govern, and prepare media and creative work from one project-centered workspace while keeping execution boundaries explicit.",
      sections,
      actions: [
        ui.link("/creator-studio/generation", "Generation Studio"),
        ui.link("/creator-studio/assets", "Assets"),
        ui.link("/creator-studio/rights", "Rights"),
        ui.link("/creator-studio/music-system", "Music System"),
        ui.link("/creator-studio/dashboard", "Dashboard")
      ]
    }));
  });

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
    const result = await rest(config, JOB_TABLE, `select=id,title,capability,provider_key,provider_job_id,status,progress_percent,prompt,negative_prompt,parameters,input_assets,policy_status,policy_reasons,rights_attested,consent_attested,error_code,error_message,created_at,completed_at&organization_id=eq.${encodeURIComponent(context.organizationId)}&user_id=eq.${encodeURIComponent(context.userId)}&order=created_at.desc&limit=${clamp(req.query.limit, 1, 100, 50)}`);
    return res.status(result.ok ? 200 : 502).json({ ok: result.ok, jobs: result.rows, code: result.code });
  });

  app.get("/api/creator/generation/jobs/:jobId", access, async (req, res) => {
    const context = await resolveContext(req, deps);
    if (!context.ok) return res.status(context.status).json(context);
    const config = getConfig(deps);
    if (!config.ok) return res.status(503).json({ ok: false, code: "supabase_setup_required" });
    const job = await loadJob(config, context, req.params.jobId);
    if (!job.ok) return res.status(job.status).json(job);
    // The same seven columns the HTML page names, and for the same reason --
    // plus one this endpoint was returning and nothing asked for: `bucket_id`
    // and `object_path` are the file's location inside a private bucket. No
    // caller uses them (checked across public/, tests/ and docs/), and the
    // download route reads them itself in its own scoped query before signing
    // a 300-second URL. Handing the storage path to the client as well is
    // exposure that buys nothing.
    const assets = await rest(config, ASSET_TABLE, `select=id,asset_role,media_type,byte_size,created_at,provenance,checksum_sha256&job_id=eq.${encodeURIComponent(job.job.id)}&organization_id=eq.${encodeURIComponent(context.organizationId)}&order=created_at.asc`);
    // `assets.ok ? assets.rows : []` reported a failed read as a job with no
    // files, and a caller cannot tell those apart from an empty array. The job
    // read succeeded and the asset read did not, so this endpoint cannot answer
    // the question it was asked -- which is a 502, not an empty success.
    if (!assets.ok) return res.status(502).json({ ok: false, code: "generation_assets_unreadable" });
    return res.status(200).json({ ok: true, job: job.job, assets: assets.rows });
  });

  app.post("/api/creator/generation/jobs", access, async (req, res) => {
    const context = await resolveContext(req, deps);
    if (!context.ok) return send(req, res, context, "/creator-studio/generation", ui);
    const config = getConfig(deps);
    if (!config.ok) return send(req, res, { ok: false, status: 503, code: "supabase_setup_required" }, "/creator-studio/generation", ui);

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
      return send(req, res, { ok: false, status: policy.httpStatus, code: policy.code, reasons: policy.reasons }, "/creator-studio/generation", ui);
    }

    const selected = chooseProvider(capability, requestedProvider);
    if (!selected.ok) return send(req, res, { ok: false, status: 400, code: selected.code }, "/creator-studio/generation", ui);

    const initialStatus = policy.status === "review_required"
      ? "review_required"
      : selected.readiness.configured
        ? "queued"
        : selected.provider.adapterMode === "external_mcp"
          ? "manual_required"
          : "setup_required";

    // Credit, checked before a provider is called and only for jobs that will
    // actually consume compute.
    //
    // `initialStatus === "queued"` is the whole condition. A job that lands
    // `review_required`, `setup_required` or `manual_required` calls no provider
    // and burns no GPU second, so refusing it for credit would charge a customer
    // -- in refusals -- for work nobody was going to do. The three statuses that
    // do nothing are the three that must not be gated.
    //
    // Refused BEFORE the row is written, not after. A job row that exists in
    // `insufficient_credit` is a customer looking at a failure they cannot
    // clear, and the `/creator-studio/generation` list would fill with them.
    if (initialStatus === "queued") {
      const authorised = await authoriseGenerationCredit({ config, context, capability, parameters, deps });
      if (!authorised.allowed) {
        return send(req, res, {
          ok: false,
          status: authorised.httpStatus,
          code: authorised.code,
          reasons: [authorised.reason]
        }, "/creator-studio/generation", ui);
      }
    }

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
    if (!created.ok) return send(req, res, { ok: false, status: 502, code: created.code }, "/creator-studio/generation", ui);

    let job = created.rows[0];
    await event(config, context, job.id, "generation.job_created", "recorded", { capability, provider_key: selected.provider.key, policy_status: policy.status });

    if (job.status === "queued") {
      const dispatched = await dispatchJob(config, context, job, selected.provider, deps);
      job = dispatched.job || job;
    }

    return send(req, res, { ok: true, status: 201, job }, jobPath(job.id), ui);
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
    const refreshed = await refreshJob(config, context, loaded.job, provider, deps);
    return send(req, res, { ...refreshed, status: refreshed.ok ? 200 : refreshed.status || 502 }, jobPath(loaded.job.id), ui);
  });

  app.post("/api/creator/generation/jobs/:jobId/cancel", access, async (req, res) => {
    const context = await resolveContext(req, deps);
    if (!context.ok) return res.status(context.status).json(context);
    const config = getConfig(deps);
    if (!config.ok) return res.status(503).json({ ok: false, code: "supabase_setup_required" });
    const loaded = await loadJob(config, context, req.params.jobId);
    if (!loaded.ok) return res.status(loaded.status).json(loaded);
    if (["completed", "failed", "cancelled"].includes(loaded.job.status)) return send(req, res, { ok: false, status: 409, code: "job_not_cancellable" }, jobPath(loaded.job.id), ui);
    const updated = await updateJob(config, context, loaded.job.id, { status: "cancelled", cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    await event(config, context, loaded.job.id, "generation.job_cancelled", "success", { provider_key: loaded.job.provider_key });
    return send(req, res, { ok: updated.ok, status: updated.ok ? 200 : 502, job: updated.rows[0], code: updated.code }, jobPath(loaded.job.id), ui);
  });

  app.get("/api/creator/generation/voice-consents", access, async (req, res) => {
    const context = await resolveContext(req, deps);
    if (!context.ok) return res.status(context.status).json(context);
    const config = getConfig(deps);
    if (!config.ok) return res.status(503).json({ ok: false, code: "supabase_setup_required" });
    // The eight columns the consent page names, plus created_at. Left out:
    // `evidence_reference`, which points at where a signed release lives, and
    // `metadata`. The HTML page decided not to render either; an endpoint over
    // the same records should not quietly return more than the page that was
    // designed.
    const result = await rest(config, CONSENT_TABLE, `select=id,subject_name,subject_type,consent_scope,evidence_type,consent_attested,expires_at,revoked_at,created_at&organization_id=eq.${encodeURIComponent(context.organizationId)}&user_id=eq.${encodeURIComponent(context.userId)}&order=created_at.desc&limit=100`);
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

  // Withdrawing a permission.
  //
  // evaluatePolicy reads revoked_at on every voice job and nothing ever wrote
  // it, so a permission could be given and never taken back. For a consent
  // record that is the wrong way round: the person whose voice it is has the
  // strongest claim on being able to change their mind, and until now the only
  // way out was waiting for an expiry date that is optional.
  app.post("/api/creator/generation/voice-consents/:consentId/revoke", access, async (req, res) => {
    const back = "/creator-studio/voice-permissions";
    const respond = (status, payload) => {
      if (!acceptsHtml(req)) return res.status(status).json(payload);
      return res.redirect(303, payload.ok ? `${back}?revoked=1` : `${back}?problem=${encodeURIComponent(payload.code || "not_revoked")}`);
    };
    const context = await resolveContext(req, deps);
    if (!context.ok) return respond(context.status, context);
    const config = getConfig(deps);
    if (!config.ok) return respond(503, { ok: false, code: "supabase_setup_required" });
    if (!validUuid(req.params.consentId)) return respond(400, { ok: false, code: "invalid_consent_id" });

    // Scoped to the organization and the user, like every other read here, so
    // an id from another workspace matches nothing rather than matching a row.
    const updated = await rest(
      config,
      CONSENT_TABLE,
      `id=eq.${encodeURIComponent(req.params.consentId)}&organization_id=eq.${encodeURIComponent(context.organizationId)}&user_id=eq.${encodeURIComponent(context.userId)}&revoked_at=is.null`,
      { method: "PATCH", prefer: "return=representation", body: { revoked_at: new Date().toISOString() } }
    );
    if (!updated.ok) return respond(502, { ok: false, code: "not_revoked" });
    // Nothing matched: already revoked, or not theirs. Both are "there is
    // nothing here to revoke" and neither should read as success.
    if (!updated.rows.length) return respond(404, { ok: false, code: "consent_not_found" });
    return respond(200, { ok: true, revoked: true });
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
      // "queued" was the default and nothing consumes this table: grep finds
      // the constant, this insert, and no runner, no status transition, and no
      // reader. Every row written here claimed work was waiting to be picked
      // up, and none ever was -- the same shape as accounting_exports, which
      // reported "whether each one finished" about a file nothing produced, and
      // integration_jobs, whose rows claimed a worker that does not exist.
      //
      // review_required is in the schema's check constraint and is true twice
      // over. Nothing automated will touch it, and analysing reference material
      // is exactly the kind of thing AGENTS.md puts in front of a person:
      // provenance, consent and anti-clone safety are judgements, not jobs.
      status: "review_required"
    });
    return res.status(created.ok ? 201 : 502).json({ ok: created.ok, analysis: created.rows[0], code: created.code });
  });

  // Voice permissions, which five capabilities could not run without.
  //
  // evaluatePolicy refuses speech_to_speech, voice_clone, singing_voice,
  // music_voice_profile and talking_avatar unless an active consent row exists
  // -- and the only endpoint that creates one had no form anywhere in the
  // product, while the generation form did not offer those capabilities at all.
  // **So the gate was built, advertised on the page, and had no key.** Five of
  // Creator Studio's capabilities were unreachable rather than unfinished.
  //
  // This is the key, not a way around the gate: the attestation is still
  // required, the scope is still recorded, and a job still fails without a live
  // consent id.
  app.get("/creator-studio/voice-permissions", access, async (req, res) => {
    const context = await resolveContext(req, deps);
    const config = getConfig(deps);
    let consents = null;
    let unavailable = null;
    if (!context.ok) unavailable = "We could not confirm your workspace. Sign in and try again.";
    else if (!config.ok) unavailable = "Your account database is not connected yet, so permissions cannot be listed.";
    else {
      // Named rather than `select=*`, and written out literally so
      // report-unused-selected-columns.mjs can read it. A star select is a read
      // that script cannot audit, which is how the provenance on the outputs
      // table sat loaded and unrendered for months.
      //
      // These eight are what voicePermissionsCard renders. `evidence_type` is
      // the kind of evidence held, not the evidence: this page has never
      // fetched the document itself and must not start.
      const listed = await rest(config, CONSENT_TABLE, `select=id,subject_name,subject_type,consent_scope,evidence_type,consent_attested,expires_at,revoked_at&organization_id=eq.${encodeURIComponent(context.organizationId)}&user_id=eq.${encodeURIComponent(context.userId)}&order=created_at.desc&limit=100`);
      if (!listed.ok) unavailable = "We could not load your permissions just now. They are still there; try again shortly.";
      else consents = listed.rows;
    }

    const sections = unavailable
      ? [ui.card("Not available right now", unavailable)]
      : [voicePermissionsCard(consents, ui.escape), voicePermissionForm(ui.escape)];

    return res.status(200).type("html").send(ui.layout({
      title: "Voice permissions",
      eyebrow: "Creator Studio",
      heading: "Voice permissions",
      body: "Voice work needs a permission on file before it runs. Record one here, and withdraw it whenever you want.",
      sections,
      actions: [ui.link("/creator-studio/generation", "Make something"), ui.link("/creator-studio/dashboard", "Dashboard")]
    }));
  });

  app.get("/creator-studio/generation", access, async (req, res) => {
    const context = await resolveContext(req, deps);
    const config = getConfig(deps);
    let jobs = [];
    let consents = [];
    if (context.ok && config.ok) {
      // Both reads at once. Written sequentially first, under a comment
      // claiming they were not -- which is the defect this branch keeps
      // finding, committed by me, in a comment about avoiding it.
      const [listed, permissions] = await Promise.all([
        rest(config, JOB_TABLE, `select=id,title,capability,provider_key,status,progress_percent,created_at&organization_id=eq.${encodeURIComponent(context.organizationId)}&user_id=eq.${encodeURIComponent(context.userId)}&order=created_at.desc&limit=20`),
        rest(config, CONSENT_TABLE, `select=id,subject_name,subject_type,consent_scope,expires_at,revoked_at&organization_id=eq.${encodeURIComponent(context.organizationId)}&user_id=eq.${encodeURIComponent(context.userId)}&order=created_at.desc&limit=100`)
      ]);
      // An unreadable permission list becomes an empty picker, which the form
      // renders as "record one first" -- wrong, but it fails towards asking
      // rather than towards running voice work without a live permission.
      consents = permissions.ok ? permissions.rows : [];
      // null, not []. The empty state below reads "Nothing yet. Use the form
      // above to make your first one" -- so a read that failed told a creator
      // their generated work had never existed, and invited them to start over.
      jobs = listed.ok ? listed.rows : null;
    }
    const providers = getCreatorGenerationCatalog();
    const sections = [
      generationForm(providers, ui.escape, consents),
      ui.card("Rights and consent boundary", "Only upload or generate from material you own or are authorized to use. Voice conversion requires an active consent rec…9448 tokens truncated…t organization = await deps.getCustomerPrimaryOrganization(user);
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

function generationForm(providers, escape, consents = []) {
  const options = providers.filter((item) => item.adapterMode !== "reference_only").map((item) => `<option value="${escape(item.key)}">${escape(item.label)} · ${escape(generationAvailabilityLabel(item.readiness.status))}</option>`).join("");

  // The five voice capabilities were missing from this list entirely, so the
  // only way to ask for voice work was to post to the API by hand. They are
  // offered now, and the permission picker below is what makes them runnable --
  // evaluatePolicy still refuses any of them without a live consent id, which
  // is the point rather than an obstacle.
  const active = consents.filter((row) => row && !row.revoked_at && (!row.expires_at || Date.parse(row.expires_at) > Date.now()));
  const voiceOptions = active.map((row) => `<option value="${escape(String(row.id))}">${escape(clean(row.subject_name, 200) || voiceSubjectLabel(row.subject_type))} — ${escape(voiceScopeLabel(row.consent_scope))}</option>`).join("");
  // With nothing on file the picker would be an empty dropdown next to a
  // required checkbox, which reads as broken. Say what to do instead.
  const voiceBlock = active.length
    ? `<label>Whose permission covers this<select name="voice_consent_id"><option value="">Not voice work</option>${voiceOptions}</select></label>` +
      `<label><input type="checkbox" name="consent_attested" value="true"> The permission above covers this request.</label>`
    : `<p>Voice work needs a permission on file first. <a href="/creator-studio/voice-permissions">Record one</a> and it will appear here.</p>`;

  // Labelled from the same map the job pages read, so a capability is called
  // the same thing on the form that created it and on the record it produced.
  const capabilityOptions = offeredCapabilities()
    .map((capability) => `<option value="${escape(capability)}">${escape(generationCapabilityLabel(capability))}${VOICE_CAPABILITIES.has(capability) ? " (needs permission)" : ""}</option>`)
    .join("");

  return `<article class="card"><h2>Create generation job</h2><form method="post" action="/api/creator/generation/jobs"><label>Title<input name="title" maxlength="200"></label><label>Capability<select name="capability">${capabilityOptions}</select></label>${voiceBlock}<label>Provider<select name="provider_key"><option value="auto">Automatic configured provider</option>${options}</select></label><label>Prompt<textarea name="prompt" rows="7" maxlength="5000" required></textarea></label><label>Negative prompt<textarea name="negative_prompt" rows="3" maxlength="2000"></textarea></label><label>Provider parameters (JSON)<textarea name="parameters" rows="4" placeholder='{"duration_seconds":8}'></textarea></label><label><input type="checkbox" name="rights_attested" value="true" required> I own or am authorized to use every prompt, reference, likeness, voice, and source asset.</label><button type="submit">Create and dispatch job</button></form></article>`;
}

function jobPath(jobId) { return `/creator-studio/generation/jobs/${encodeURIComponent(jobId)}`; }
function jobTitle(job) { return clean(job?.title, 200) || `${generationCapabilityLabel(job?.capability)} request`; }

function jobRows(jobs, escape) {
  return jobs.map((job) => `<tr><td><a href="${escape(jobPath(job.id))}">${escape(jobTitle(job))}</a></td><td>${escape(generationCapabilityLabel(job.capability))}</td><td>${escape(generationStatusLabel(job.status))}</td><td>${escape(String(job.progress_percent || 0))}%</td><td>${escape(whenText(job.created_at))}</td></tr>`).join("");
}

function jobsTable(jobs, escape, emptyText) {
  // A list nobody could read is not a list with nothing in it, and the two must
  // not share a sentence -- one is a fact about the creator's account and the
  // other is a fact about ours.
  if (jobs === null || jobs === undefined) {
    return `<table><tbody><tr><td>We could not load your work just now. It is still there; try again shortly.</td></tr></tbody></table>`;
  }
  const rows = jobRows(jobs, escape) || `<tr><td colspan="5">${escape(emptyText)}</td></tr>`;
  return `<table><thead><tr><th>What</th><th>Kind</th><th>Where it is</th><th>Progress</th><th>Started</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function jobTable(jobs, escape) {
  return `<article class="card"><h2>Recent work</h2>${jobsTable(jobs, escape, "Nothing yet. Use the form above to make your first one.")}<p><a class="action" href="/creator-studio/generation/jobs">See all your work</a></p></article>`;
}

function jobListCard(jobs, escape) {
  return `<article class="card"><h2>Everything you have made</h2>${jobsTable(jobs, escape, "You have not asked for anything yet.")}</article>`;
}

function jobSummaryCard(job, escape) {
  const status = generationStatus(job.status);
  const rows = [
    ["Where it is", `${status.label} — ${status.detail}`],
    // `Number(job.progress_percent || 0)%` reported "0%" for a job that has not
    // recorded any progress, which reads as "started and got nowhere" rather
    // than "nothing has said yet". Same fault as the segments page and the menu
    // margin; this was the third copy.
    ["Progress", finiteNumber(job.progress_percent) === null ? "Not reported yet" : `${finiteNumber(job.progress_percent)}%`],
    ["Kind", generationCapabilityLabel(job.capability)],
    ["Started", whenText(job.created_at)],
    ["Finished", job.completed_at ? whenText(job.completed_at) : "Not yet"]
  ];
  if (job.policy_status === "review_required" || job.policy_status === "rejected") {
    rows.push(["Why it is held", reasonText(job.policy_reasons)]);
  }
  if (job.status === "failed") {
    // error_code is the machine value and stays in the record; this is the
    // sentence. Before, the code itself was printed, so a customer whose audio
    // was too large to save read "storage_upload_failed_413".
    rows.push(["What went wrong", generationFailureText(job.error_code, job.error_message)]);
  }
  const body = rows.map(([label, value]) => `<tr><th scope="row">${escape(label)}</th><td>${escape(value)}</td></tr>`).join("");
  return `<article class="card"><h2>Where this is up to</h2><table><tbody>${body}</tbody></table></article>`;
}

function jobOutputsCard(job, assets, escape) {
  // "Nothing was produced for this one" on a completed job is the worst
  // sentence in this file to get wrong: the creator concludes the generation
  // they waited for failed, when the outputs are sitting in a table we could
  // not read.
  if (assets === null || assets === undefined) {
    return `<article class="card"><h2>Outputs</h2><p>We could not load the outputs for this one just now. Try again shortly.</p></article>`;
  }
  const outputs = assets.filter((asset) => asset.asset_role === "output" || asset.asset_role === "preview" || asset.asset_role === "stem");
  if (!outputs.length) {
    const waiting = ["completed", "failed", "cancelled"].includes(String(job.status))
      ? "Nothing was produced for this one."
      : "Nothing to collect yet. Files appear here as soon as they are made.";
    return `<article class="card"><h2>Your files</h2><p>${escape(waiting)}</p></article>`;
  }
  // Where each file came from, which the row has always carried and this table
  // has never shown. The page selects `*`, so none of this is a new read -- it
  // was loaded and dropped. AGENTS.md asks for provenance to be enforced, and a
  // record only the database can see enforces nothing.
  const rows = outputs.map((asset) => {
    const from = provenanceOf.describeAsset(asset);
    const madeBy = from.madeBy || "Not recorded";
    // Three columns rather than one sentence, because a creator scanning a list
    // of files is comparing them against each other.
    return `<tr><td><a href="${escape(`${jobPath(job.id)}/outputs/${encodeURIComponent(asset.id)}`)}">Download</a></td><td>${escape(fileKind(asset))}</td><td>${escape(sizeText(asset.byte_size))}</td><td>${escape(whenText(asset.created_at))}</td><td>${escape(madeBy)}</td><td>${escape(from.rightsLabel)}</td><td>${escape(from.consentLabel)}</td><td>${from.checksumShort ? `<code title="${escape(from.checksum)}">${escape(from.checksumShort)}</code>` : escape("Not recorded")}</td></tr>`;
  }).join("");
  return `<article class="card"><h2>Your files</h2><div class="table-scroll"><table><thead><tr><th>File</th><th>Type</th><th>Size</th><th>Made</th><th>Made by</th><th>Rights confirmed</th><th>Consent confirmed</th><th>Fingerprint</th></tr></thead><tbody>${rows}</tbody></table></div><p>Download links are private to your workspace and expire after a few minutes.</p><p>The fingerprint is a SHA-256 of the file as we stored it. Hover it for the full value; a copy that still matches it is the copy we made.</p></article>`;
}

function jobControlsCard(job, escape) {
  const finished = ["completed", "failed", "cancelled"].includes(String(job.status));
  const controls = [];
  if (!finished) {
    // Where these come back to is derived from the job, never posted, so the
    // form cannot be used to bounce somebody off the site.
    controls.push(`<form method="post" action="${escape(`/api/creator/generation/jobs/${encodeURIComponent(job.id)}/refresh`)}"><button type="submit">Check for an update</button></form>`);
    controls.push(`<form method="post" action="${escape(`/api/creator/generation/jobs/${encodeURIComponent(job.id)}/cancel`)}"><button type="submit">Stop this</button></form>`);
  }
  if (!controls.length) return `<article class="card"><h2>What you can do</h2><p>This one is finished, so there is nothing left to change. Start a new request whenever you need another.</p></article>`;
  return `<article class="card"><h2>What you can do</h2>${controls.join("")}</article>`;
}

function jobRequestCard(job, escape) {
  const prompt = clean(job.prompt, 5000);
  const negative = clean(job.negative_prompt, 2000);
  return `<article class="card"><h2>What you asked for</h2><p>${escape(prompt || "No description was given.")}</p>${negative ? `<p><strong>Asked to avoid:</strong> ${escape(negative)}</p>` : ""}<p><strong>Rights confirmed:</strong> ${escape(provenanceOf.attestationLabel(job.rights_attested))}</p><p><strong>Consent confirmed:</strong> ${escape(provenanceOf.attestationLabel(job.consent_attested))}</p></article>`;
}

function jobHistoryCard(events, escape) {
  if (events === null || events === undefined) {
    return `<article class="card"><h2>History</h2><p>We could not load the history just now.</p></article>`;
  }
  if (!events.length) return `<article class="card"><h2>History</h2><p>Nothing has happened yet.</p></article>`;
  const rows = events.map((entry) => `<tr><td>${escape(whenText(entry.created_at))}</td><td>${escape(eventText(entry))}</td></tr>`).join("");
  return `<article class="card"><h2>History</h2><table><tbody>${rows}</tbody></table></article>`;
}

// Event types are written for the audit record ("generation.dispatch_started"),
// so they are translated rather than printed.
const EVENT_TEXT = Object.freeze({
  "generation.job_created": "You asked for this.",
  "generation.dispatch_started": "Sent off to be made.",
  "generation.dispatch_failed": "We could not send it off.",
  "generation.job_cancelled": "You stopped this.",
  "generation.completed": "Finished.",
  "generation.failed": "It did not finish.",
  "generation.output_stored": "A file was saved for you.",
  "generation.output_downloaded": "A file was downloaded.",
  "generation.status_checked": "We checked for an update."
});

function eventText(entry) {
  const known = EVENT_TEXT[String(entry?.event_type)];
  if (known) return known;
  return String(entry?.event_type || "Something happened").replace(/^generation\./, "").replaceAll("_", " ");
}

function reasonText(reasons) {
  const list = Array.isArray(reasons) ? reasons.map((reason) => String(reason).replaceAll("_", " ")).filter(Boolean) : [];
  return list.length ? list.join("; ") : "We check this kind of request by hand.";
}

function fileKind(asset) {
  const media = String(asset?.media_type || "").trim();
  if (media && media !== "other") return media[0].toUpperCase() + media.slice(1);
  return "File";
}

function sizeText(bytes) {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size <= 0) return "Unknown";
  if (size < 1024) return `${size} bytes`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function whenText(value) {
  if (!value) return "Unknown";
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return "Unknown";
  return parsed.toISOString().replace("T", " ").slice(0, 16);
}

// Supabase storage returns a relative signed path; it is only useful joined
// back onto the project URL.
async function signAsset(config, asset) {
  const objectPath = String(asset.object_path || "").split("/").map(encodeURIComponent).join("/");
  const response = await fetch(`${config.url}/storage/v1/object/sign/${encodeURIComponent(asset.bucket_id)}/${objectPath}`, {
    method: "POST",
    headers: { apikey: config.serviceRoleKey, Authorization: `Bearer ${config.serviceRoleKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: 300 })
  }).catch(() => undefined);
  if (!response?.ok) return { ok: false };
  const payload = await response.json().catch(() => undefined);
  const signedPath = payload?.signedURL || payload?.signedUrl;
  if (!signedPath) return { ok: false };
  return { ok: true, url: `${config.url}/storage/v1${String(signedPath).startsWith("/") ? "" : "/"}${signedPath}` };
}

function buildUi(deps) {
  const escape = deps.escapeHtml || esc;
  return { layout: deps.layout || basicLayout, card: deps.brandCard || card, link: deps.linkAction || link, escape };
}
function studioCapabilityState(value) {
  const labels = {
    existing_foundation_expand: "Foundation exists; expand behind normal release gates",
    planned: "Planned",
    future_candidate: "Future candidate",
    research_candidate: "Research candidate",
    review_required: "Review required",
    reference_only: "Reference only",
    blocked_until_qualified_review: "Blocked until qualified review"
  };
  return labels[String(value || "")] || "Not enabled";
}

function studioDomainLabel(value) {
  return String(value || "other")
    .split("-")
    .map((part) => part ? part[0].toUpperCase() + part.slice(1) : part)
    .join(" ");
}

function generationFailureFor(code) {
  const state = setupStateFor({ code });
  if (state) return { state, heading: state.heading, message: state.body, retryable: state.key === "TEMPORARY_PROVIDER_FAILURE" };
  const messages = {
    rights_attestation_required: "Confirm that you have the right to use the material before starting.",
    active_voice_consent_required: "A current voice permission is required before this can run.",
    voice_consent_scope_mismatch: "The permission on file does not cover this kind of voice work.",
    source_rights_attestation_required: "Confirm that you have the right to use the source before starting.",
    analysis_type_required: "Choose the kind of reference analysis you want to create.",
    prompt_required: "Add a description for the work you want to create.",
    capability_required: "Choose the kind of work you want to create.",
    invalid_provider: "Choose one of the available provider options.",
    job_not_cancellable: "This piece of work has already finished, so it cannot be stopped now."
  };
  const message = messages[String(code || "")] || "We could not complete that generation action safely.";
  return { state: null, heading: "Generation could not start", message, retryable: false };
}

function send(req, res, result, redirectTo, ui) {
  const status = Number(result.status || (result.ok ? 200 : 400));
  if (!acceptsHtml(req)) return res.status(status).json(result);
  if (result.ok) return res.redirect(303, redirectTo);

  const owner = Boolean(req.sonaraAccess?.ownerOverride || req.sonaraAccess?.mode === "owner");
  const presentation = generationFailureFor(result.code);
  const state = presentation.state ? setupStateFor({ code: result.code, owner }) : null;
  const referenceId = String(result.referenceId || randomUUID());
  const sections = state
    ? [renderSetupStateCard(state, ui.escape), `<p class="fine"><strong>Reference:</strong> ${ui.escape(referenceId)}</p>`]
    : [renderFailureCard({ message: presentation.message, referenceId, retryable: presentation.retryable }, ui.escape)];
  const actions = [];
  if (state) actions.push(ui.link(state.primaryHref, state.primaryLabel));
  actions.push(ui.link(redirectTo, "Return to Creator Studio"), ui.link("/contact", "Contact support"));
  return res.status(status).type("html").send(ui.layout({
    title: presentation.heading,
    eyebrow: "Creator Studio",
    heading: presentation.heading,
    body: presentation.message,
    sections,
    actions
  }));
}

function acceptsHtml(req) { return String(req.get("accept") || "").includes("text/html") || String(req.get("content-type") || "").includes("application/x-www-form-urlencoded"); }
function pass(req, res, next) { next(); }
function esc(value) { return String(value || "").replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char])); }
function card(title, body) { return `<article class="card"><h2>${esc(title)}</h2><p>${esc(body)}</p></article>`; }
function link(href, label) { return `<a class="action" href="${esc(href)}">${esc(label)}</a>`; }
function basicLayout(data) { return `<!doctype html><html><head><title>${esc(data.title)}</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main><p>${esc(data.eyebrow)}</p><h1>${esc(data.heading)}</h1><p>${esc(data.body)}</p><nav>${(data.actions || []).join("")}</nav><section>${(data.sections || []).join("")}</section></main></body></html>`; }
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

// The permissions on file, and what each one still allows.
function voicePermissionsCard(consents, escape) {
  if (consents === null || consents === undefined) {
    return `<article class="card"><h2>Permissions on file</h2><p>We could not load these just now.</p></article>`;
  }
  if (!consents.length) {
    return `<article class="card"><h2>Permissions on file</h2><p>None yet. Record one below and voice work can run.</p></article>`;
  }
  const rows = consents.map((row) => {
    const expired = row.expires_at && Date.parse(row.expires_at) <= Date.now();
    // Three ways a permission stops counting, and they are not the same event:
    // withdrawn is a decision, expired is a date passing, and active is
    // neither. Collapsing them would hide which one a customer needs to fix.
    const state = row.revoked_at ? "Withdrawn" : expired ? "Expired" : "Active";
    const action = state === "Active"
      ? `<form method="post" action="/api/creator/generation/voice-consents/${escape(String(row.id))}/revoke"><button type="submit">Withdraw</button></form>`
      : escape(state === "Withdrawn" ? whenText(row.revoked_at) : whenText(row.expires_at));
    return `<tr><td>${escape(clean(row.subject_name, 200) || voiceSubjectLabel(row.subject_type))}</td><td>${escape(voiceScopeLabel(row.consent_scope))}</td><td>${escape(voiceEvidenceLabel(row.evidence_type))}</td><td>${escape(state)}</td><td>${action}</td></tr>`;
  }).join("");
  return `<article class="card"><h2>Permissions on file</h2><table><thead><tr><th>Whose voice</th><th>What it covers</th><th>Evidence</th><th>State</th><th>Withdraw</th></tr></thead><tbody>${rows}</tbody></table></article>`;
}

function voicePermissionForm(escape) {
  const options = (list) => list.map(([value, label]) => `<option value="${escape(value)}">${escape(label)}</option>`).join("");
  return `<article class="card"><h2>Record a permission</h2>` +
    `<p>This is a record that you have permission, not a substitute for having it. Recording one does not make a voice yours to use.</p>` +
    `<form method="post" action="/api/creator/generation/voice-consents">` +
    `<label>Whose voice is it<select name="subject_type">${options([["self", "Mine"], ["authorized_person", "Someone who gave me permission"], ["licensed_voice", "A licensed voice"], ["synthetic_voice", "A synthetic voice"]])}</select></label>` +
    `<label>Their name<input name="subject_name" maxlength="200" placeholder="Optional, and useful later"></label>` +
    `<label>What it covers<select name="consent_scope">${options([["all_voice_generation", "All voice work"], ["text_to_speech", "Spoken audio only"], ["speech_to_speech", "Voice conversion only"], ["voice_clone", "Voice copying only"], ["singing_voice", "Singing only"]])}</select></label>` +
    `<label>What proof you hold<select name="evidence_type">${options([["signed_release", "A signed release"], ["license_record", "A licence record"], ["provider_voice_id", "A provider voice id"], ["self_attestation", "My own word (it is my voice)"], ["other", "Something else"]])}</select></label>` +
    `<label>Where that proof is<input name="evidence_reference" maxlength="1000" placeholder="A file name, contract reference, or link"></label>` +
    `<label>Expires<input name="expires_at" type="date"></label>` +
    `<label><input type="checkbox" name="consent_attested" value="true" required> I have permission for this voice to be used this way, and I can produce the evidence above if asked.</label>` +
    `<button type="submit">Record permission</button></form></article>`;
}




// Exported for the tests, on the precedent set by RESOURCE_MAP in
// routes/sonara-last9-routes.cjs. The pair is what makes the scope check
// checkable: a capability added to VOICE_CAPABILITIES with no entry in the map
// is refused at runtime and fails the build, rather than quietly relying on
// somebody holding a blanket permission.
module.exports.VOICE_CAPABILITIES = VOICE_CAPABILITIES;
module.exports.CONSENT_SCOPE_FOR_CAPABILITY = CONSENT_SCOPE_FOR_CAPABILITY;
module.exports.BLANKET_CONSENT_SCOPE = BLANKET_CONSENT_SCOPE;
module.exports.FORM_CAPABILITY_ORDER = FORM_CAPABILITY_ORDER;
module.exports.offeredCapabilities = offeredCapabilities;

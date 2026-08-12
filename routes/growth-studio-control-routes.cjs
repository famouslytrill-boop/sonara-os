"use strict";

const { randomUUID } = require("node:crypto");
const {
  getGrowthProvider,
  getGrowthProviderReadiness,
  getGrowthProviderCatalog,
  chooseGrowthProvider
} = require("../lib/growth-studio-provider-registry.cjs");
const { GROWTH_RECORD_PAGES } = require("../lib/sonara-growth-record-pages.cjs");
const { GROWTH_CREATE_SPECS, getGrowthCreateSpec } = require("../lib/sonara-growth-create-specs.cjs");
const leadConversion = require("../lib/sonara-lead-conversion.cjs");

const TABLES = Object.freeze({
  campaigns: "growth_campaigns",
  leads: "growth_leads",
  // Business Builder's table, named here because a won lead becomes one. Every
  // other call in this file goes through TABLES, and passing a literal name
  // instead hides the table from the member-policy scan -- which is what the
  // "no read helper hides from the policy check" test caught.
  customers: "customers",
  experiments: "growth_experiments",
  automations: "automation_rules",
  connections: "growth_provider_connections",
  segments: "growth_audience_segments",
  consents: "growth_contact_consents",
  touchpoints: "growth_touchpoints",
  conversions: "growth_conversions",
  content: "growth_content_queue",
  jobs: "growth_provider_jobs",
  metrics: "growth_metric_snapshots",
  variants: "growth_experiment_variants",
  events: "growth_control_events"
});

const OUTBOUND_CHANNELS = new Set(["email", "sms", "push", "whatsapp"]);
const AUTOMATION_TRIGGERS = new Set(["lead_created", "lead_qualified", "form_submitted", "campaign_started", "conversion_recorded", "consent_granted", "content_ready"]);
const AUTOMATION_ACTIONS = new Set(["create_task", "notify_owner", "add_to_segment", "enqueue_email", "sync_provider", "send_webhook"]);
const APPROVAL_OPERATIONS = new Set(["direct_post", "draft_upload", "content_publish", "campaign_mutation", "budget_change", "ad_mutation", "campaign_send"]);

module.exports = function registerGrowthStudioControlRoutes(app, deps = {}) {
  const requireWorkspaceAccess = typeof deps.requireWorkspaceAccess === "function" ? deps.requireWorkspaceAccess : () => pass;
  const requirePaidOrOwnerAccess = typeof deps.requirePaidOrOwnerAccess === "function" ? deps.requirePaidOrOwnerAccess : requireWorkspaceAccess;
  const access = requireWorkspaceAccess("growth_studio");
  const paidAccess = requirePaidOrOwnerAccess("growth_studio");
  const ui = buildUi(deps);

  app.get("/api/growth/providers", access, (req, res) => {
    return res.status(200).json({ ok: true, providers: getGrowthProviderCatalog() });
  });

  app.get("/api/growth/readiness", access, async (req, res) => {
    const config = getConfig(deps);
    const providers = getGrowthProviderCatalog();
    return res.status(200).json({
      ok: true,
      database: config.ok ? "configured" : "setup_required",
      providers,
      configuredProviders: providers.filter((provider) => provider.readiness.configured).map((provider) => provider.key),
      controls: {
        credentials: "server_only",
        directBrowserWrites: "revoked",
        publicPublishing: "human_approval_required",
        paidMediaMutation: "human_approval_required",
        lifecycleMessaging: "purpose_specific_consent_required",
        attribution: "model_and_confidence_recorded",
        sampledReports: "sampling_and_freshness_preserved",
        revenueGuarantees: false,
        autonomousBudgetIncreases: false,
        arbitraryAutomationCode: false
      }
    });
  });

  // Turning a won lead into a customer.
  //
  // growth_leads and customers hold the same four fields and nothing joined
  // them, so a lead that closed had to be retyped before it could be quoted or
  // invoiced. That seam is what the "one system" claim is about: Growth Studio
  // finds the work, Business Builder bills it.
  //
  // Both tables belong to the same organization, so this crosses a product
  // boundary and not a tenancy one -- and every read and write below still
  // carries the organization rather than trusting that.
  //
  // The owner acting, not an agent, for the same reason as the quote step: a
  // person pressing a button they can see is the person.
  app.post("/api/growth-studio/leads/:leadId/customer", access, async (req, res) => {
    // The button on /growth-studio/enquiries posts here from a plain form, so
    // the reply has to be a page. Handing a browser the JSON body shows the
    // owner a wall of punctuation and loses the customer they just created --
    // a working endpoint that reads as a crash.
    const back = "/growth-studio/enquiries";
    const respond = (status, payload) => {
      if (!acceptsHtml(req)) return res.status(status).json(payload);
      // Somewhere useful on success: the customer now exists, so show it.
      if (payload.ok) return res.redirect(303, "/business-builder/owner/customers");
      return res.redirect(303, `${back}?problem=${encodeURIComponent(payload.code || "not_converted")}`);
    };

    const context = await resolveContext(req, deps);
    if (!context.ok) return respond(context.status, context);
    if (!validUuid(req.params.leadId)) return respond(400, { ok: false, code: "invalid_lead_id" });
    const config = getConfig(deps);
    if (!config.ok) return respond(503, { ok: false, code: "supabase_setup_required" });

    const found = await loadOne(config, TABLES.leads, context, req.params.leadId);
    if (!found.ok) return respond(found.status, { ok: false, code: found.code });
    const lead = found.row;

    // Existing customers are read before deciding. An unreadable list is not an
    // empty one -- treating a failed read as "no duplicates" is how the same
    // person ends up in the customer list twice with half the invoices on each.
    const customers = await list(config, TABLES.customers, context, 1000);
    if (!customers.ok) return respond(503, { ok: false, code: "cannot_check_existing_customers" });

    const refusal = leadConversion.reasonNotConvertible(lead, customers.rows);
    if (refusal) return respond(409, { ok: false, code: "not_convertible", reason: refusal });

    const created = await insert(config, TABLES.customers, leadConversion.customerFromLead(lead, {
      organizationId: context.organizationId,
      userId: context.userId
    }));
    if (!created.ok) return respond(502, { ok: false, code: created.code });

    const customerId = created.rows[0]?.id || null;
    if (!customerId) return respond(502, { ok: false, code: "customer_id_missing" });

    // Best-effort, and deliberately after the customer exists. If this fails
    // the customer is real and the lead simply does not know about it yet,
    // which an owner can see and fix. Failing the whole thing here would leave
    // the customer created and the caller told it was not.
    const linked = await patchRows(config, TABLES.leads, context, lead.id, { customer_id: customerId });
    if (created.ok) await controlEvent(config, context, "lead.converted", "success", { lead_id: lead.id, customer_id: customerId, linked: linked.ok });

    return respond(201, { ok: true, customerId, leadLinked: linked.ok });
  });

  app.get("/api/growth/campaigns", access, listHandler(TABLES.campaigns, deps, "campaigns"));
  app.post("/api/growth/campaigns", access, async (req, res) => {
    const context = await resolveContext(req, deps);
    if (!context.ok) return res.status(context.status).json(context);
    const config = getConfig(deps);
    if (!config.ok) return res.status(503).json({ ok: false, code: "supabase_setup_required" });
    const name = clean(req.body.name, 240);
    if (!name) return res.status(400).json({ ok: false, code: "campaign_name_required" });
    const created = await insert(config, TABLES.campaigns, {
      organization_id: context.organizationId,
      user_id: context.userId,
      platform_id: validUuid(req.body.platform_id || req.body.platformId) ? String(req.body.platform_id || req.body.platformId) : null,
      name,
      goal: nullable(req.body.goal, 1000),
      channel: nullable(req.body.channel, 120),
      status: oneOf(req.body.status, ["draft", "active", "paused", "completed", "archived"], "draft"),
      metadata: parseObject(req.body.metadata, {})
    });
    if (created.ok) await controlEvent(config, context, "campaign.created", "success", { campaign_id: created.rows[0]?.id, name });
    return res.status(created.ok ? 201 : 502).json({ ok: created.ok, campaign: created.rows[0], code: created.code });
  });

  app.get("/api/growth/campaigns/:campaignId", access, getOneHandler(TABLES.campaigns, "campaignId", deps, "campaign"));
  app.patch("/api/growth/campaigns/:campaignId", access, async (req, res) => {
    const context = await resolveContext(req, deps);
    if (!context.ok) return res.status(context.status).json(context);
    if (!validUuid(req.params.campaignId)) return res.status(400).json({ ok: false, code: "invalid_campaign_id" });
    const config = getConfig(deps);
    if (!config.ok) return res.status(503).json({ ok: false, code: "supabase_setup_required" });
    const patch = compact({
      name: req.body.name === undefined ? undefined : clean(req.body.name, 240),
      goal: req.body.goal === undefined ? undefined : nullable(req.body.goal, 1000),
      channel: req.body.channel === undefined ? undefined : nullable(req.body.channel, 120),
      status: req.body.status === undefined ? undefined : oneOf(req.body.status, ["draft", "active", "paused", "completed", "archived"], null),
      metadata: req.body.metadata === undefined ? undefined : parseObject(req.body.metadata, {}),
      updated_at: new Date().toISOString()
    });
    if (!Object.keys(patch).length) return res.status(400).json({ ok: false, code: "campaign_patch_required" });
    const updated = await patchRows(config, TABLES.campaigns, context, req.params.campaignId, patch);
    if (updated.ok) await controlEvent(config, context, "campaign.updated", "success", { campaign_id: req.params.campaignId, fields: Object.keys(patch) }, req.params.campaignId);
    return res.status(updated.ok ? 200 : 502).json({ ok: updated.ok, campaign: updated.rows[0], code: updated.code });
  });

  app.get("/api/growth/leads", access, listHandler(TABLES.leads, deps, "leads"));
  app.post("/api/growth/leads", access, async (req, res) => {
    const context = await resolveContext(req, deps);
    if (!context.ok) return res.status(context.status).json(context);
    const config = getConfig(deps);
    if (!config.ok) return res.status(503).json({ ok: false, code: "supabase_setup_required" });
    const email = normalizeEmail(req.body.email);
    const phone = clean(req.body.phone, 80) || null;
    const name = clean(req.body.name, 240) || null;
    if (!email && !phone && !name) return res.status(400).json({ ok: false, code: "lead_identity_required" });
    const created = await insert(config, TABLES.leads, {
      organization_id: context.organizationId,
      user_id: context.userId,
      platform_id: validUuid(req.body.platform_id || req.body.platformId) ? String(req.body.platform_id || req.body.platformId) : null,
      campaign_id: validUuid(req.body.campaign_id || req.body.campaignId) ? String(req.body.campaign_id || req.body.campaignId) : null,
      name,
      email,
      phone,
      source: nullable(req.body.source, 200),
      status: oneOf(req.body.status, ["new", "contacted", "qualified", "won", "lost", "archived"], "new"),
      metadata: parseObject(req.body.metadata, {})
    });
    if (created.ok) await controlEvent(config, context, "lead.created", "success", { lead_id: created.rows[0]?.id, source: req.body.source || null }, created.rows[0]?.campaign_id);
    return res.status(created.ok ? 201 : 502).json({ ok: created.ok, lead: created.rows[0], code: created.code });
  });

  app.patch("/api/growth/leads/:leadId", access, async (req, res) => {
    const context = await resolveContext(req, deps);
    if (!context.ok) return res.status(context.status).json(context);
    if (!validUuid(req.params.leadId)) return res.status(400).json({ ok: false, code: "invalid_lead_id" });
    const config = getConfig(deps);
    const patch = compact({
      name: req.body.name === undefined ? undefined : nullable(req.body.name, 240),
      email: req.body.email === undefined ? undefined : normalizeEmail(req.body.email),
      phone: req.body.phone === undefined ? undefined : nullable(req.body.phone, 80),
      source: req.body.source === undefined ? undefined : nullable(req.body.source, 200),
      status: req.body.status === undefined ? undefined : oneOf(req.body.status, ["new", "contacted", "qualified", "won", "lost", "archived"], null),
      metadata: req.body.metadata === undefined ? undefined : parseObject(req.body.metadata, {}),
      updated_at: new Date().toISOString()
    });
    const updated = await patchRows(config, TABLES.leads, context, req.params.leadId, patch);
    if (updated.ok) await controlEvent(config, context, "lead.updated", "success", { lead_id: req.params.leadId, fields: Object.keys(patch) }, updated.rows[0]?.campaign_id);
    return res.status(updated.ok ? 200 : 502).json({ ok: updated.ok, lead: updated.rows[0], code: updated.code });
  });

  app.get("/api/growth/segments", access, listHandler(TABLES.segments, deps, "segments"));
  app.post("/api/growth/segments", access, async (req, res) => {
    const context = await resolveContext(req, deps);
    if (!context.ok) return res.status(context.status).json(context);
    const config = getConfig(deps);
    const name = clean(req.body.name, 240);
    const definition = parseObject(req.body.segment_definition || req.body.segmentDefinition, null);
    if (!name || !definition) return res.status(400).json({ ok: false, code: "segment_name_and_definition_required" });
    if (containsUnsafeExpression(definition)) return res.status(400).json({ ok: false, code: "segment_definition_not_allowed" });
    const created = await insert(config, TABLES.segments, {
      organization_id: context.organizationId,
      user_id: context.userId,
      name,
      description: nullable(req.body.description, 1000),
      segment_definition: definition,
      status: oneOf(req.body.status, ["draft", "active", "paused", "archived"], "draft")
    });
    return res.status(created.ok ? 201 : 502).json({ ok: created.ok, segment: created.rows[0], code: created.code });
  });

  app.get("/api/growth/consents", access, listHandler(TABLES.consents, deps, "consents"));
  app.post("/api/growth/consents", access, async (req, res) => {
    const context = await resolveContext(req, deps);
    if (!context.ok) return res.status(context.status).json(context);
    const config = getConfig(deps);
    const channel = oneOf(req.body.channel, ["email", "sms", "push", "whatsapp", "phone", "personalization", "analytics"], null);
    const status = oneOf(req.body.consent_status || req.body.consentStatus, ["granted", "denied", "withdrawn", "expired", "unknown"], null);
    const purpose = clean(req.body.purpose, 300);
    const source = clean(req.body.source, 300);
    if (!channel || !status || !purpose || !source) return res.status(400).json({ ok: false, code: "consent_fields_required" });
    const created = await insert(config, TABLES.consents, {
      organization_id: context.organizationId,
      user_id: context.userId,
      lead_id: validUuid(req.body.lead_id || req.body.leadId) ? String(req.body.lead_id || req.body.leadId) : null,
      channel,
      purpose,
      consent_status: status,
      source,
      evidence_reference: nullable(req.body.evidence_reference || req.body.evidenceReference, 1000),
      granted_at: status === "granted" ? validDate(req.body.granted_at || req.body.grantedAt) || new Date().toISOString() : null,
      expires_at: validDate(req.body.expires_at || req.body.expiresAt),
      withdrawn_at: status === "withdrawn" ? validDate(req.body.withdrawn_at || req.body.withdrawnAt) || new Date().toISOString() : null,
      metadata: parseObject(req.body.metadata, {})
    });
    if (created.ok) await controlEvent(config, context, "consent.recorded", "success", { consent_id: created.rows[0]?.id, lead_id: created.rows[0]?.lead_id, channel, status });
    return res.status(created.ok ? 201 : 502).json({ ok: created.ok, consent: created.rows[0], code: created.code });
  });

  app.get("/api/growth/touchpoints", access, listHandler(TABLES.touchpoints, deps, "touchpoints"));
  app.post("/api/growth/touchpoints", access, async (req, res) => {
    const context = await resolveContext(req, deps);
    if (!context.ok) return res.status(context.status).json(context);
    if (!truthy(req.body.tracking_basis_attested || req.body.trackingBasisAttested)) return res.status(400).json({ ok: false, code: "tracking_basis_attestation_required" });
    const config = getConfig(deps);
    const eventName = clean(req.body.event_name || req.body.eventName, 200);
    if (!eventName) return res.status(400).json({ ok: false, code: "event_name_required" });
    const deduplicationKey = clean(req.body.deduplication_key || req.body.deduplicationKey, 300) || randomUUID();
    const created = await insert(config, TABLES.touchpoints, {
      organization_id: context.organizationId,
      user_id: context.userId,
      campaign_id: validUuid(req.body.campaign_id || req.body.campaignId) ? String(req.body.campaign_id || req.body.campaignId) : null,
      lead_id: validUuid(req.body.lead_id || req.body.leadId) ? String(req.body.lead_id || req.body.leadId) : null,
      provider_key: nullable(req.body.provider_key || req.body.providerKey, 100),
      event_name: eventName,
      channel: nullable(req.body.channel, 100),
      source: nullable(req.body.source, 200),
      medium: nullable(req.body.medium, 200),
      campaign_key: nullable(req.body.campaign_key || req.body.campaignKey, 300),
      content_key: nullable(req.body.content_key || req.body.contentKey, 300),
      anonymous_id: nullable(req.body.anonymous_id || req.body.anonymousId, 300),
      external_event_id: nullable(req.body.external_event_id || req.body.externalEventId, 300),
      deduplication_key: deduplicationKey,
      value: numberOrNull(req.body.value),
      currency: nullable(req.body.currency, 20),
      occurred_at: validDate(req.body.occurred_at || req.body.occurredAt) || new Date().toISOString(),
      metadata: parseObject(req.body.metadata, {})
    });
    if (created.ok) await controlEvent(config, context, "touchpoint.recorded", "success", { touchpoint_id: created.rows[0]?.id, event_name: eventName, deduplication_key: deduplicationKey }, created.rows[0]?.campaign_id);
    return res.status(created.ok ? 201 : created.status === 409 ? 409 : 502).json({ ok: created.ok, touchpoint: created.rows[0], code: created.ok ? "ok" : "touchpoint_duplicate_or_invalid" });
  });

  app.get("/api/growth/conversions", access, listHandler(TABLES.conversions, deps, "conversions"));
  app.post("/api/growth/conversions", access, async (req, res) => {
    const context = await resolveContext(req, deps);
    if (!context.ok) return res.status(context.status).json(context);
    const config = getConfig(deps);
    const conversionType = clean(req.body.conversion_type || req.body.conversionType, 200);
    if (!conversionType) return res.status(400).json({ ok: false, code: "conversion_type_required" });
    const model = oneOf(req.body.attribution_model || req.body.attributionModel, ["unattributed", "first_touch", "last_touch", "linear", "position_based", "data_driven", "provider_reported", "custom"], "unattributed");
    const confidence = oneOf(req.body.attribution_confidence || req.body.attributionConfidence, ["unknown", "low", "medium", "high", "provider_reported"], "unknown");
    const created = await insert(config, TABLES.conversions, {
      organization_id: context.organizationId,
      user_id: context.userId,
      campaign_id: validUuid(req.body.campaign_id || req.body.campaignId) ? String(req.body.campaign_id || req.body.campaignId) : null,
      lead_id: validUuid(req.body.lead_id || req.body.leadId) ? String(req.body.lead_id || req.body.leadId) : null,
      touchpoint_id: validUuid(req.body.touchpoint_id || req.body.touchpointId) ? String(req.body.touchpoint_id || req.body.touchpointId) : null,
      conversion_type: conversionType,
      external_conversion_id: nullable(req.body.external_conversion_id || req.body.externalConversionId, 300),
      value: numberOrNull(req.body.value),
      currency: clean(req.body.currency, 20) || "usd",
      attribution_model: model,
      attribution_confidence: confidence,
      source: nullable(req.body.source, 200),
      medium: nullable(req.body.medium, 200),
      campaign_key: nullable(req.body.campaign_key || req.body.campaignKey, 300),
      occurred_at: validDate(req.body.occurred_at || req.body.occurredAt) || new Date().toISOString(),
      metadata: parseObject(req.body.metadata, {})
    });
    if (created.ok) await controlEvent(config, context, "conversion.recorded", "success", { conversion_id: created.rows[0]?.id, conversion_type: conversionType, attribution_model: model, attribution_confidence: confidence }, created.rows[0]?.campaign_id);
    return res.status(created.ok ? 201 : 502).json({ ok: created.ok, conversion: created.rows[0], code: created.code });
  });

  app.get("/api/growth/content", access, listHandler(TABLES.content, deps, "content"));
  app.post("/api/growth/content", access, async (req, res) => {
    const context = await resolveContext(req, deps);
    if (!context.ok) return res.status(context.status).json(context);
    const channel = clean(req.body.channel, 100).toLowerCase();
    const contentType = oneOf(req.body.content_type || req.body.contentType, ["social_post", "email", "sms", "push", "ad", "landing_page", "blog", "video", "other"], null);
    if (!channel || !contentType) return res.status(400).json({ ok: false, code: "content_channel_and_type_required" });
    if (OUTBOUND_CHANNELS.has(channel) && !truthy(req.body.consent_basis_attested || req.body.consentBasisAttested)) return res.status(400).json({ ok: false, code: "audience_consent_basis_required" });
    const config = getConfig(deps);
    const created = await insert(config, TABLES.content, {
      organization_id: context.organizationId,
      user_id: context.userId,
      campaign_id: validUuid(req.body.campaign_id || req.body.campaignId) ? String(req.body.campaign_id || req.body.campaignId) : null,
      provider_connection_id: validUuid(req.body.provider_connection_id || req.body.providerConnectionId) ? String(req.body.provider_connection_id || req.body.providerConnectionId) : null,
      channel,
      content_type: contentType,
      title: nullable(req.body.title, 300),
      body: nullable(req.body.body, 20000),
      media_references: parseArray(req.body.media_references || req.body.mediaReferences, []),
      audience_segment_id: validUuid(req.body.audience_segment_id || req.body.audienceSegmentId) ? String(req.body.audience_segment_id || req.body.audienceSegmentId) : null,
      scheduled_for: validDate(req.body.scheduled_for || req.body.scheduledFor),
      approval_status: "draft",
      publish_status: "not_scheduled",
      provider_response: { consent_basis_attested: truthy(req.body.consent_basis_attested || req.body.consentBasisAttested) }
    });
    return res.status(created.ok ? 201 : 502).json({ ok: created.ok, content: created.rows[0], code: created.code });
  });

  app.post("/api/growth/content/:contentId/publish", access, async (req, res) => {
    const context = await resolveContext(req, deps);
    if (!context.ok) return res.status(context.status).json(context);
    if (!validUuid(req.params.contentId)) return res.status(400).json({ ok: false, code: "invalid_content_id" });
    if (!truthy(req.body.approved || req.body.approval_attested || req.body.approvalAttested)) return res.status(400).json({ ok: false, code: "explicit_publish_approval_required" });
    const config = getConfig(deps);
    const loaded = await loadOne(config, TABLES.content, context, req.params.contentId);
    if (!loaded.ok) return res.status(loaded.status).json(loaded);
    const providerKey = clean(req.body.provider_key || req.body.providerKey, 100);
    const operation = clean(req.body.operation, 100) || "direct_post";
    const jobResult = await createProviderJob(config, context, {
      providerKey,
      capability: operation,
      operation,
      campaignId: loaded.row.campaign_id,
      contentId: loaded.row.id,
      requestPayload: { content: loaded.row, provider_parameters: parseObject(req.body.provider_parameters || req.body.providerParameters, {}) },
      idempotencyKey: clean(req.body.idempotency_key || req.body.idempotencyKey, 300) || `content:${loaded.row.id}:${operation}`,
      approved: true
    });
    const publishStatus = jobResult.job?.status === "completed" ? "published" : jobResult.job?.status === "failed" ? "failed" : jobResult.job?.status === "manual_required" ? "manual_required" : "queued";
    await patchRows(config, TABLES.content, context, loaded.row.id, {
      approval_status: "approved",
      publish_status: publishStatus,
      provider_response: { job_id: jobResult.job?.id || null, provider_key: providerKey, operation },
      published_at: publishStatus === "published" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    });
    return res.status(jobResult.ok ? 202 : jobResult.status || 409).json(jobResult);
  });

  app.get("/api/growth/experiments", access, listHandler(TABLES.experiments, deps, "experiments"));
  app.post("/api/growth/experiments", access, async (req, res) => {
    const context = await resolveContext(req, deps);
    if (!context.ok) return res.status(context.status).json(context);
    const config = getConfig(deps);
    const name = clean(req.body.name, 240);
    const hypothesis = clean(req.body.hypothesis, 2000);
    const variants = parseArray(req.body.variants, []);
    if (!name || !hypothesis || variants.length < 2) return res.status(400).json({ ok: false, code: "experiment_name_hypothesis_and_two_variants_required" });
    const totalWeight = variants.reduce((sum, variant) => sum + Number(variant.allocation_weight ?? variant.allocationWeight ?? 0), 0);
    if (Math.abs(totalWeight - 1) > 0.0001) return res.status(400).json({ ok: false, code: "variant_weights_must_equal_one" });
    const created = await insert(config, TABLES.experiments, {
      organization_id: context.organizationId,
      user_id: context.userId,
      platform_id: validUuid(req.body.platform_id || req.body.platformId) ? String(req.body.platform_id || req.body.platformId) : null,
      campaign_id: validUuid(req.body.campaign_id || req.body.campaignId) ? String(req.body.campaign_id || req.body.campaignId) : null,
      name,
      hypothesis,
      result: null,
      status: "planned",
      metadata: { primary_metric: clean(req.body.primary_metric || req.body.primaryMetric, 200), guardrail_metrics: parseArray(req.body.guardrail_metrics || req.body.guardrailMetrics, []), assignment_unit: clean(req.body.assignment_unit || req.body.assignmentUnit, 100) || "user" }
    });
    if (!created.ok) return res.status(502).json({ ok: false, code: created.code });
    const experiment = created.rows[0];
    const variantRows = [];
    for (const [index, variant] of variants.entries()) {
      const inserted = await insert(config, TABLES.variants, {
        organization_id: context.organizationId,
        user_id: context.userId,
        experiment_id: experiment.id,
        variant_key: clean(variant.variant_key || variant.variantKey, 100) || `variant_${index + 1}`,
        name: clean(variant.name, 240) || `Variant ${index + 1}`,
        allocation_weight: Number(variant.allocation_weight ?? variant.allocationWeight),
        configuration: parseObject(variant.configuration, {}),
        status: "draft"
      });
      if (inserted.ok) variantRows.push(inserted.rows[0]);
    }
    await controlEvent(config, context, "experiment.created", "success", { experiment_id: experiment.id, variant_count: variantRows.length }, experiment.campaign_id);
    return res.status(201).json({ ok: true, experiment, variants: variantRows });
  });

  app.get("/api/growth/automations", access, listHandler(TABLES.automations, deps, "automations"));
  app.post("/api/growth/automations", access, async (req, res) => {
    const context = await resolveContext(req, deps);
    if (!context.ok) return res.status(context.status).json(context);
    const trigger = clean(req.body.trigger_key || req.body.triggerKey, 100);
    const action = clean(req.body.action_key || req.body.actionKey, 100);
    if (!AUTOMATION_TRIGGERS.has(trigger) || !AUTOMATION_ACTIONS.has(action)) return res.status(400).json({ ok: false, code: "automation_template_not_allowed" });
    const configData = parseObject(req.body.config, {});
    if (containsUnsafeExpression(configData)) return res.status(400).json({ ok: false, code: "arbitrary_automation_code_prohibited" });
    const config = getConfig(deps);
    const created = await insert(config, TABLES.automations, {
      organization_id: context.organizationId,
      user_id: context.userId,
      platform_id: validUuid(req.body.platform_id || req.body.platformId) ? String(req.body.platform_id || req.body.platformId) : null,
      name: clean(req.body.name, 240) || `${trigger} → ${action}`,
      trigger_key: trigger,
      action_key: action,
      status: "disabled",
      config: { ...configData, human_approval_required: action !== "create_task" && action !== "notify_owner" }
    });
    return res.status(created.ok ? 201 : 502).json({ ok: created.ok, automation: created.rows[0], code: created.code });
  });

  app.get("/api/growth/provider-jobs", access, listHandler(TABLES.jobs, deps, "jobs"));
  app.post("/api/growth/provider-jobs", access, async (req, res) => {
    const context = await resolveContext(req, deps);
    if (!context.ok) return res.status(context.status).json(context);
    const config = getConfig(deps);
    const result = await createProviderJob(config, context, {
      providerKey: clean(req.body.provider_key || req.body.providerKey, 100),
      capability: clean(req.body.capability, 100),
      operation: clean(req.body.operation, 100),
      campaignId: validUuid(req.body.campaign_id || req.body.campaignId) ? String(req.body.campaign_id || req.body.campaignId) : null,
      contentId: validUuid(req.body.content_id || req.body.contentId) ? String(req.body.content_id || req.body.contentId) : null,
      requestPayload: parseObject(req.body.request_payload || req.body.requestPayload, {}),
      idempotencyKey: clean(req.body.idempotency_key || req.body.idempotencyKey, 300) || randomUUID(),
      approved: truthy(req.body.approved || req.body.approval_attested || req.body.approvalAttested)
    });
    return res.status(result.ok ? 201 : result.status || 400).json(result);
  });

  app.post("/api/growth/provider-jobs/:jobId/refresh", access, async (req, res) => {
    const context = await resolveContext(req, deps);
    if (!context.ok) return res.status(context.status).json(context);
    if (!validUuid(req.params.jobId)) return res.status(400).json({ ok: false, code: "invalid_job_id" });
    const config = getConfig(deps);
    const loaded = await loadOne(config, TABLES.jobs, context, req.params.jobId);
    if (!loaded.ok) return res.status(loaded.status).json(loaded);
    const provider = getGrowthProvider(loaded.row.provider_key);
    const refreshed = await refreshProviderJob(config, context, loaded.row, provider);
    return res.status(refreshed.ok ? 200 : refreshed.status || 502).json(refreshed);
  });

  app.get("/api/growth/metrics", access, async (req, res) => {
    const context = await resolveContext(req, deps);
    if (!context.ok) return res.status(context.status).json(context);
    const config = getConfig(deps);
    if (!config.ok) return res.status(503).json({ ok: false, code: "supabase_setup_required" });
    const campaignId = validUuid(req.query.campaign_id || req.query.campaignId) ? String(req.query.campaign_id || req.query.campaignId) : null;
    const [campaigns, leads, touchpoints, conversions, content, experiments, snapshots] = await Promise.all([
      list(config, TABLES.campaigns, context, 500, campaignId ? `&id=eq.${encodeURIComponent(campaignId)}` : ""),
      list(config, TABLES.leads, context, 1000, campaignId ? `&campaign_id=eq.${encodeURIComponent(campaignId)}` : ""),
      list(config, TABLES.touchpoints, context, 1000, campaignId ? `&campaign_id=eq.${encodeURIComponent(campaignId)}` : ""),
      list(config, TABLES.conversions, context, 1000, campaignId ? `&campaign_id=eq.${encodeURIComponent(campaignId)}` : ""),
      list(config, TABLES.content, context, 500, campaignId ? `&campaign_id=eq.${encodeURIComponent(campaignId)}` : ""),
      list(config, TABLES.experiments, context, 500, campaignId ? `&campaign_id=eq.${encodeURIComponent(campaignId)}` : ""),
      list(config, TABLES.metrics, context, 100, campaignId ? `&campaign_id=eq.${encodeURIComponent(campaignId)}` : "")
    ]);
    const conversionValue = conversions.rows.reduce((sum, row) => sum + Number(row.value || 0), 0);
    return res.status(200).json({
      ok: true,
      scope: { organizationId: context.organizationId, campaignId },
      totals: {
        campaigns: campaigns.rows.length,
        activeCampaigns: campaigns.rows.filter((row) => row.status === "active").length,
        leads: leads.rows.length,
        qualifiedLeads: leads.rows.filter((row) => ["qualified", "won"].includes(row.status)).length,
        touchpoints: touchpoints.rows.length,
        conversions: conversions.rows.length,
        conversionValue,
        contentItems: content.rows.length,
        publishedItems: content.rows.filter((row) => row.publish_status === "published").length,
        experiments: experiments.rows.length
      },
      attribution: {
        reportedModels: countBy(conversions.rows, "attribution_model"),
        confidence: countBy(conversions.rows, "attribution_confidence"),
        warning: "Stored attribution is evidence with an explicit model and confidence; it is not guaranteed causal proof."
      },
      providerSnapshots: snapshots.rows,
      sampledSnapshots: snapshots.rows.filter((row) => row.sampled).length
    });
  });

  app.get("/growth-studio/control-center", access, async (req, res) => {
    const context = await resolveContext(req, deps);
    const config = getConfig(deps);
    let dashboard = { campaigns: [], leads: [], content: [], jobs: [] };
    if (context.ok && config.ok) {
      const [campaigns, leads, content, jobs] = await Promise.all([
        list(config, TABLES.campaigns, context, 10),
        list(config, TABLES.leads, context, 10),
        list(config, TABLES.content, context, 10),
        list(config, TABLES.jobs, context, 10)
      ]);
      dashboard = { campaigns: campaigns.rows, leads: leads.rows, content: content.rows, jobs: jobs.rows };
    }
    const providers = getGrowthProviderCatalog();
    const sections = [
      ui.card("Growth operating system", "Run your campaigns, leads, audience lists, permissions, content approvals, contacts, sales, experiments, numbers, and connected services from one place."),
      summaryTable(dashboard, ui.escape),
      ui.card("Approval boundary", "Public posts, campaign sends, ad changes, budget changes, and high-volume follow-up messaging require explicit human approval. Automation rules are created disabled and cannot contain arbitrary code."),
      ui.card("Attribution boundary", "Every conversion records an attribution model and confidence level. Provider sampling and data freshness are preserved instead of presenting estimates as exact causal truth."),
      ...providers.slice(0, 9).map((provider) => ui.card(`${provider.label}: ${display(provider.readiness.status)}`, `${provider.capabilities.join(", ")}. ${(provider.notes || []).join(" ")}`))
    ];
    return res.status(200).type("html").send(ui.layout({
      title: "Growth Studio Control Center",
      eyebrow: "Growth Studio",
      heading: "Campaigns, customers, results, experiments, and follow-up",
      body: "Operate a measurable growth system without fake publishing, fabricated attribution, purchased lists, or autonomous ad spend.",
      sections,
      // Point a customer at pages, not at JSON. The last two here used to be
      // the exceptions: /growth-studio/analytics is behind a paid plan, and
      // /growth-studio/provider-jobs was a redirect to raw data, so linking
      // either was worse than linking the API. Both now have pages.
      actions: [
        ui.link("/growth-studio/launch-readiness", "Setup status"),
        ui.link("/growth-studio/attribution", "Where results came from"),
        ui.link("/growth-studio/campaigns", "Campaigns"),
        ui.link("/growth-studio/leads", "Leads"),
        ui.link("/growth-studio/enquiries", "People who got in touch"),
        ui.link("/growth-studio/provider-jobs", "Work sent to services")
      ]
    }));
  });

  // These six were 302s to /api/ URLs. See lib/sonara-growth-record-pages.cjs
  // for why that survived so long without a test objecting.
  for (const page of GROWTH_RECORD_PAGES) {
    // Four of these replaced paid placeholder pages. Handing them the
    // signed-in-only gate would have turned "this unlocks with a plan" into a
    // free workspace as a side effect of building the real page.
    const pageAccess = page.paid ? paidAccess : access;
    app.get(page.path, pageAccess, async (req, res) => {
      const context = await resolveContext(req, deps);
      const config = getConfig(deps);
      let rows = [];
      let unavailable = null;
      if (!context.ok) unavailable = "We could not confirm your workspace. Sign in and try again.";
      else if (!config.ok) unavailable = "Your account database is not connected yet, so these records cannot be listed.";
      else {
        const result = await rest(config, TABLES[page.tableKey], `select=${page.select}&organization_id=eq.${encodeURIComponent(context.organizationId)}&order=${page.order}&limit=${clamp(req.query.limit, 1, 200, 100)}`);
        if (!result.ok) unavailable = "We could not load these records just now. Try again shortly.";
        else rows = result.rows;
      }
      const sections = unavailable ? [ui.card("Not available right now", unavailable)] : [];
      if (!unavailable && page.includesTotals) sections.push(await growthTotalsCard(config, context, ui));
      // The refusal rules for a row action can need records this page does not
      // list. A failed read is left as null rather than an empty array so the
      // action reports "could not check" instead of quietly deciding there are
      // no duplicates.
      let actionContext = null;
      if (!unavailable && page.needsCustomers) {
        const existing = await list(config, TABLES.customers, context, 1000);
        actionContext = { customers: existing.ok ? existing.rows : null };
      }
      if (!unavailable) sections.push(recordTableCard(page, rows, ui.escape, actionContext));
      // The form goes on the page that lists the records, so the way to add one
      // is where somebody looking at an empty list already is. A create route
      // reachable only by knowing its URL is the same as not having one.
      const createSpec = getGrowthCreateSpec(page.tableKey);
      if (!unavailable && createSpec) sections.push(createFormCard(createSpec, ui.escape));

      return res.status(200).type("html").send(ui.layout({
        title: page.title,
        eyebrow: "Growth Studio",
        heading: page.heading,
        body: page.body,
        sections,
        actions: [ui.link("/growth-studio/control-center", "Growth Control Center"), ui.link("/growth-studio/dashboard", "Dashboard")]
      }));
    });
  }
};

// The totals, counted by the database rather than by whatever fitted on a page.
//
// This card used to read up to 500 or 1000 rows and report `rows.length` as the
// total, under a heading saying "counted from your own records". A business with
// 1,200 enquiries was told it had 1,000. **The worst of them was money**: the
// value of sales summed the capped read, so a real revenue figure was quietly
// short by however many conversions did not fit -- and the home page now claims
// every figure comes from the owner's own records and that the product says when
// it does not know.
//
// Counts come from `count=exact` now, which is one row of transfer whatever the
// size. The value is the one thing PostgREST cannot total without an RPC, so it
// is labelled for exactly the rows it covers rather than presented as a total it
// is not.
const VALUE_SAMPLE = 1000;

async function growthTotalsCard(config, context, ui) {
  const [
    campaigns, campaignsActive, leads, leadsWorthFollowing,
    conversionCount, content, contentPublished, recentConversions
  ] = await Promise.all([
    countRows(config, TABLES.campaigns, context),
    countRows(config, TABLES.campaigns, context, "&status=eq.active"),
    countRows(config, TABLES.leads, context),
    countRows(config, TABLES.leads, context, "&status=in.(qualified,won)"),
    countRows(config, TABLES.conversions, context),
    countRows(config, TABLES.content, context),
    countRows(config, TABLES.content, context, "&publish_status=eq.published"),
    list(config, TABLES.conversions, context, VALUE_SAMPLE)
  ]);

  const counts = [campaigns, campaignsActive, leads, leadsWorthFollowing, conversionCount, content, contentPublished];
  if (counts.every((result) => !result.ok)) {
    return ui.card("Your totals", "We could not count these just now. Try again shortly.");
  }

  // A count that failed says so in its own row. The previous version only
  // reported a problem when *every* read failed, so one unreadable table left a
  // real 0 sitting beside six real numbers, indistinguishable from a business
  // that had none of that thing.
  const shown = (result) => (result.ok && typeof result.count === "number" ? String(result.count) : "Not available just now");

  const totals = [
    ["Campaigns", shown(campaigns)],
    ["Campaigns running", shown(campaignsActive)],
    ["People who got in touch", shown(leads)],
    ["Worth following up", shown(leadsWorthFollowing)],
    ["Sales recorded", shown(conversionCount)],
    ["Pieces of content", shown(content)],
    ["Published", shown(contentPublished)]
  ];

  // The money row, labelled for what it actually covers.
  if (!recentConversions.ok) {
    totals.push(["Value of those sales", "Not available just now"]);
  } else {
    const value = recentConversions.rows.reduce((sum, row) => sum + Number(row.value || 0), 0);
    const covered = recentConversions.rows.length;
    const partial = conversionCount.ok && typeof conversionCount.count === "number" && conversionCount.count > covered;
    totals.push([
      partial ? `Value of the ${covered} most recent sales` : "Value of those sales",
      String(value)
    ]);
  }

  const rows = totals.map(([label, value]) => `<tr><th scope="row">${ui.escape(label)}</th><td>${ui.escape(String(value))}</td></tr>`).join("");
  // Kept from the API response, because it is the honest part: attribution is
  // what a source reported, not proof that it caused the sale.
  return `<article class="card"><h2>Your totals</h2><table><tbody>${rows}</tbody></table><p>These are counted from your own records. Where a figure says a campaign brought in a sale, that is what the source reported, not proof it caused it.</p></article>`;
}

function recordTableCard(page, rows, escape, context = null) {
  // A row can act on itself. The same shape as the owner record pages in
  // routes/sonara-last9-routes.cjs, and here for the same reason: an endpoint
  // that takes a path parameter is skipped by the form-reachability scan, so
  // "the button does not exist" is a defect no check reports. Declaring the
  // action beside the page means the row that can take it renders it, and the
  // row that cannot says why in the same column instead of showing a button
  // that will refuse.
  const action = page.rowAction || null;
  const heads = [...page.columns.map((column) => `<th>${escape(column.label)}</th>`)];
  if (action) heads.push(`<th>${escape(action.columnLabel || "Action")}</th>`);
  const width = heads.length;
  const body = rows.length
    ? rows.map((row) => {
      const cells = page.columns.map((column) => `<td>${escape(safeValue(column, row))}</td>`);
      if (action) cells.push(`<td>${actionCell(action, row, escape, context)}</td>`);
      return `<tr>${cells.join("")}</tr>`;
    }).join("")
    : `<tr><td colspan="${width}">${escape(page.empty)}</td></tr>`;
  return `<article class="card"><h2>${escape(page.heading)}</h2><table><thead><tr>${heads.join("")}</tr></thead><tbody>${body}</tbody></table></article>`;
}

// Either a button or the reason there is not one. A spec that throws on an odd
// row must not take the page down, and it must not fall through to a button
// either -- an unanswerable question is not a yes.
function actionCell(action, row, escape, context) {
  let reason;
  try {
    reason = action.reasonUnavailable ? action.reasonUnavailable(row, context) : null;
  } catch {
    reason = "This cannot be checked right now.";
  }
  if (reason) return escape(reason);
  const id = encodeURIComponent(String(row.id || ""));
  return `<form method="post" action="${escape(action.api.replace(":id", id))}"><button type="submit">${escape(action.label)}</button></form>`;
}

// A column reads fields off a record that a provider may have left in an
// unexpected shape. One bad row should cost that cell, not the whole page.
function safeValue(column, row) {
  try {
    return column.value(row);
  } catch {
    return "Not recorded";
  }
}

async function createProviderJob(config, context, input) {
  if (!config.ok) return { ok: false, status: 503, code: "supabase_setup_required" };
  if (!input.capability || !input.operation) return { ok: false, status: 400, code: "provider_capability_and_operation_required" };
  const selected = chooseGrowthProvider(input.capability, input.providerKey || "auto");
  if (!selected.ok) return { ok: false, status: 400, code: selected.code };
  const provider = selected.provider;
  const requiresApproval = provider.adapterMode === "approval_gated" || APPROVAL_OPERATIONS.has(input.operation);
  let status = "queued";
  if (requiresApproval && !input.approved) status = "approval_required";
  else if (provider.adapterMode === "approval_gated") status = "manual_required";
  else if (!selected.readiness.configured) status = "setup_required";
  const created = await insert(config, TABLES.jobs, {
    organization_id: context.organizationId,
    user_id: context.userId,
    campaign_id: input.campaignId || null,
    content_id: input.contentId || null,
    provider_key: provider.key,
    capability: input.capability,
    operation: input.operation,
    idempotency_key: input.idempotencyKey,
    request_payload: input.requestPayload || {},
    status,
    approval_required: requiresApproval,
    approved_by: requiresApproval && input.approved ? context.userId : null,
    approved_at: requiresApproval && input.approved ? new Date().toISOString() : null,
    provider_response: status === "manual_required" ? { reason: "approved_connector_or_platform_action_requires_operator_authorization" } : {}
  });
  if (!created.ok) return { ok: false, status: created.status === 409 ? 409 : 502, code: created.status === 409 ? "duplicate_idempotency_key" : created.code };
  let job = created.rows[0];
  await controlEvent(config, context, "provider_job.created", status === "approval_required" ? "approval_required" : status === "manual_required" ? "manual_required" : "recorded", { job_id: job.id, provider_key: provider.key, operation: input.operation }, input.campaignId, job.id);
  if (job.status === "queued") {
    const dispatched = await dispatchProviderJob(config, context, job, provider);
    job = dispatched.job || job;
    return { ...dispatched, job };
  }
  return { ok: true, job };
}

async function dispatchProviderJob(config, context, job, provider) {
  await updateJob(config, context, job.id, { status: "submitted", submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  await controlEvent(config, context, "provider_job.dispatch_started", "recorded", { provider_key: provider.key, operation: job.operation }, job.campaign_id, job.id);
  try {
    if (provider.key === "hubspot") return dispatchHubSpot(config, context, job, provider);
    if (provider.key === "klaviyo") return dispatchKlaviyo(config, context, job, provider);
    if (provider.key === "posthog") return dispatchPostHog(config, context, job, provider);
    if (provider.key === "google_analytics") return dispatchGoogleAnalytics(config, context, job, provider);
    const manual = await updateJob(config, context, job.id, { status: "manual_required", provider_response: { provider_key: provider.key, adapter_mode: provider.adapterMode }, updated_at: new Date().toISOString() });
    return { ok: true, job: manual.rows[0] };
  } catch (error) {
    return failProviderJob(config, context, job, "provider_dispatch_failed", safeError(error));
  }
}

async function dispatchHubSpot(config, context, job, provider) {
  const base = String(process.env[provider.baseUrlEnv] || provider.defaultBaseUrl).replace(/\/$/, "");
  const headers = { Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`, Accept: "application/json", "Content-Type": "application/json" };
  let response;
  if (job.operation === "campaign_create") {
    const properties = parseObject(job.request_payload?.properties, null) || {
      hs_name: clean(job.request_payload?.name, 240),
      hs_start_date: clean(job.request_payload?.start_date || job.request_payload?.startDate, 30) || undefined,
      hs_end_date: clean(job.request_payload?.end_date || job.request_payload?.endDate, 30) || undefined,
      hs_notes: clean(job.request_payload?.notes, 1000) || undefined
    };
    if (!properties.hs_name) return failProviderJob(config, context, job, "hubspot_campaign_name_required", "HubSpot campaign properties must include hs_name.", 400);
    response = await fetch(`${base}/marketing/campaigns/2026-03`, { method: "POST", headers, body: JSON.stringify({ properties: compact(properties) }) });
  } else if (job.operation === "campaign_list") {
    const limit = clamp(job.request_payload?.limit, 1, 100, 20);
    response = await fetch(`${base}/marketing/campaigns/2026-03?limit=${limit}`, { headers });
  } else {
    return failProviderJob(config, context, job, "hubspot_operation_not_implemented", "Only campaign_create and campaign_list are enabled.", 400);
  }
  if (!response.ok) return failProviderResponse(config, context, job, response, "hubspot_request_failed");
  const payload = await response.json().catch(() => ({}));
  const completed = await updateJob(config, context, job.id, { status: "completed", progress_percent: 100, provider_job_id: clean(payload.id, 300) || null, provider_response: sanitizeProviderPayload(payload), completed_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  await controlEvent(config, context, "provider_job.completed", "success", { provider_key: provider.key, operation: job.operation, provider_job_id: payload.id || null }, job.campaign_id, job.id);
  return { ok: true, job: completed.rows[0] };
}

async function dispatchKlaviyo(config, context, job, provider) {
  if (job.operation !== "event_create") return failProviderJob(config, context, job, "klaviyo_operation_not_implemented", "Only event_create is enabled.", 400);
  const payload = job.request_payload || {};
  const email = normalizeEmail(payload.email);
  const phone = clean(payload.phone_number || payload.phoneNumber, 80) || null;
  const profileId = clean(payload.profile_id || payload.profileId, 300) || null;
  const metricName = clean(payload.metric_name || payload.metricName || payload.event_name || payload.eventName, 200);
  if ((!email && !phone && !profileId) || !metricName) return failProviderJob(config, context, job, "klaviyo_profile_and_metric_required", "Klaviyo requires a profile identifier and metric name.", 400);
  if (OUTBOUND_CHANNELS.has(String(payload.channel || "").toLowerCase()) && validUuid(payload.lead_id || payload.leadId)) {
    const consent = await hasActiveConsent(config, context, String(payload.lead_id || payload.leadId), String(payload.channel).toLowerCase(), clean(payload.purpose, 300) || "lifecycle_marketing");
    if (!consent) return failProviderJob(config, context, job, "active_contact_consent_required", "No active purpose-specific consent was found.", 400);
  }
  const base = String(process.env[provider.baseUrlEnv] || provider.defaultBaseUrl).replace(/\/$/, "");
  const attributes = compact({
    properties: parseObject(payload.properties, {}),
    metric: { data: { type: "metric", attributes: { name: metricName } } },
    profile: { data: { type: "profile", attributes: compact({ email, phone_number: phone, external_id: profileId }) } },
    time: validDate(payload.time) || new Date().toISOString(),
    value: numberOrUndefined(payload.value),
    unique_id: clean(payload.unique_id || payload.uniqueId, 300) || job.idempotency_key
  });
  const response = await fetch(`${base}/api/events`, {
    method: "POST",
    headers: { Authorization: `Klaviyo-API-Key ${process.env.KLAVIYO_PRIVATE_API_KEY}`, revision: process.env[provider.revisionEnv] || provider.defaultRevision, Accept: "application/vnd.api+json", "Content-Type": "application/vnd.api+json" },
    body: JSON.stringify({ data: { type: "event", attributes } })
  });
  if (!response.ok) return failProviderResponse(config, context, job, response, "klaviyo_event_failed");
  const payloadResponse = response.status === 204 || response.status === 202 ? {} : await response.json().catch(() => ({}));
  const completed = await updateJob(config, context, job.id, { status: "completed", progress_percent: 100, provider_response: { accepted: true, response: sanitizeProviderPayload(payloadResponse), unique_id: attributes.unique_id }, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  return { ok: true, job: completed.rows[0] };
}

async function dispatchPostHog(config, context, job, provider) {
  if (job.operation !== "event_capture") return failProviderJob(config, context, job, "posthog_operation_not_implemented", "Only event_capture is enabled.", 400);
  const payload = job.request_payload || {};
  const eventName = clean(payload.event, 200);
  const distinctId = clean(payload.distinct_id || payload.distinctId, 300);
  if (!eventName || !distinctId) return failProviderJob(config, context, job, "posthog_event_and_distinct_id_required", "PostHog requires event and distinct_id.", 400);
  const base = String(process.env[provider.baseUrlEnv] || provider.defaultBaseUrl).replace(/\/$/, "");
  const response = await fetch(`${base}/capture/`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: process.env.POSTHOG_PROJECT_API_KEY, event: eventName, properties: { ...parseObject(payload.properties, {}), distinct_id: distinctId, sonara_organization_id: context.organizationId, sonara_campaign_id: job.campaign_id || undefined }, timestamp: validDate(payload.timestamp) || undefined, uuid: job.idempotency_key })
  });
  if (!response.ok) return failProviderResponse(config, context, job, response, "posthog_capture_failed");
  const providerPayload = await response.json().catch(() => ({}));
  const completed = await updateJob(config, context, job.id, { status: "completed", progress_percent: 100, provider_response: sanitizeProviderPayload(providerPayload), completed_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  return { ok: true, job: completed.rows[0] };
}

async function dispatchGoogleAnalytics(config, context, job, provider) {
  if (job.operation !== "run_report") return failProviderJob(config, context, job, "ga4_operation_not_implemented", "Only run_report is enabled.", 400);
  const body = parseObject(job.request_payload?.report, null) || parseObject(job.request_payload, {});
  if (!Array.isArray(body.dateRanges) || !Array.isArray(body.metrics)) return failProviderJob(config, context, job, "ga4_date_ranges_and_metrics_required", "GA4 runReport requires dateRanges and metrics arrays.", 400);
  const propertyId = clean(process.env.GA4_PROPERTY_ID, 100).replace(/^properties\//, "");
  const base = String(process.env[provider.baseUrlEnv] || provider.defaultBaseUrl).replace(/\/$/, "");
  const response = await fetch(`${base}/properties/${encodeURIComponent(propertyId)}:runReport`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GA4_ACCESS_TOKEN}`, Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) return failProviderResponse(config, context, job, response, "ga4_report_failed");
  const payload = await response.json().catch(() => ({}));
  const sampled = Boolean(payload.metadata?.samplingMetadatas?.length || payload.samplingMetadata || payload.metadata?.subjectToThresholding);
  const snapshot = await insert(config, TABLES.metrics, {
    organization_id: context.organizationId,
    user_id: context.userId,
    campaign_id: job.campaign_id || null,
    provider_key: "google_analytics",
    report_type: "run_report",
    date_start: normalizeDateOnly(body.dateRanges?.[0]?.startDate),
    date_end: normalizeDateOnly(body.dateRanges?.[0]?.endDate),
    metrics: { metricHeaders: payload.metricHeaders || [], rows: payload.rows || [], rowCount: payload.rowCount || 0, totals: payload.totals || [] },
    dimensions: payload.dimensionHeaders || [],
    sampled,
    data_freshness: clean(payload.metadata?.dataLossFromOtherRow ? "other_row_data_loss" : payload.metadata?.currencyCode || "provider_reported", 100),
    provider_metadata: sanitizeProviderPayload(payload.metadata || {})
  });
  const completed = await updateJob(config, context, job.id, { status: "completed", progress_percent: 100, provider_response: { snapshot_id: snapshot.rows[0]?.id || null, row_count: payload.rowCount || 0, sampled }, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  return { ok: true, job: completed.rows[0], snapshot: snapshot.rows[0] };
}

async function refreshProviderJob(config, context, job, provider) {
  if (!provider) return { ok: false, status: 409, code: "provider_not_found" };
  if (["completed", "failed", "cancelled", "approval_required", "manual_required", "setup_required"].includes(job.status)) return { ok: true, job, unchanged: true };
  return { ok: true, job, unchanged: true, note: "Configured Growth Studio adapters in this release are synchronous; external asynchronous connectors remain manual or approval-gated." };
}

async function failProviderResponse(config, context, job, response, code) {
  const text = clean(await response.text().catch(() => ""), 1500) || `Provider returned HTTP ${response.status}`;
  return failProviderJob(config, context, job, code, text, 502);
}

async function failProviderJob(config, context, job, code, message, status = 502) {
  const updated = await updateJob(config, context, job.id, { status: "failed", error_code: code, error_message: clean(message, 2000), updated_at: new Date().toISOString() });
  await controlEvent(config, context, "provider_job.failed", "failed", { code, message: clean(message, 500), provider_key: job.provider_key }, job.campaign_id, job.id);
  return { ok: false, status, code, job: updated.rows[0] };
}

async function hasActiveConsent(config, context, leadId, channel, purpose) {
  const query = `select=id,consent_status,expires_at,withdrawn_at,purpose&organization_id=eq.${encodeURIComponent(context.organizationId)}&lead_id=eq.${encodeURIComponent(leadId)}&channel=eq.${encodeURIComponent(channel)}&consent_status=eq.granted&order=created_at.desc&limit=10`;
  const result = await rest(config, TABLES.consents, query);
  return result.ok && result.rows.some((row) => !row.withdrawn_at && (!row.expires_at || Date.parse(row.expires_at) > Date.now()) && row.purpose === purpose);
}

function listHandler(table, deps, key) {
  return async (req, res) => {
    const context = await resolveContext(req, deps);
    if (!context.ok) return res.status(context.status).json(context);
    const config = getConfig(deps);
    if (!config.ok) return res.status(503).json({ ok: false, code: "supabase_setup_required" });
    const result = await list(config, table, context, clamp(req.query.limit, 1, 500, 100));
    return res.status(result.ok ? 200 : 502).json({ ok: result.ok, [key]: result.rows, code: result.code });
  };
}

function getOneHandler(table, paramName, deps, key) {
  return async (req, res) => {
    const context = await resolveContext(req, deps);
    if (!context.ok) return res.status(context.status).json(context);
    const id = req.params[paramName];
    if (!validUuid(id)) return res.status(400).json({ ok: false, code: `invalid_${paramName.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`)}` });
    const config = getConfig(deps);
    const loaded = await loadOne(config, table, context, id);
    return res.status(loaded.ok ? 200 : loaded.status).json(loaded.ok ? { ok: true, [key]: loaded.row } : loaded);
  };
}

async function resolveContext(req, deps) {
  const user = req.sonaraUser || req.sonaraCustomer?.user || req.sonaraAccess?.user || null;
  if (!user?.id) return { ok: false, status: 401, code: "growth_auth_required" };
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

// How many rows there are, asked of the database.
//
// PostgREST returns the total in Content-Range when Prefer: count=exact is set,
// so this costs one row of transfer regardless of how many exist. rest() throws
// the headers away, which is why this does its own fetch rather than passing a
// prefer through.
//
// A failed count returns null rather than 0. Nothing here may turn "we could not
// ask" into "there are none" -- that is the substitution the totals card was
// making four times over.
async function countRows(config, table, context, filter = "") {
  if (!config?.ok && (!config?.url || !config?.serviceRoleKey)) return { ok: false, count: null };
  const query = `select=id&organization_id=eq.${encodeURIComponent(context.organizationId)}${filter}&limit=1`;
  const response = await fetch(`${config.url}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      Prefer: "count=exact"
    }
  }).catch(() => undefined);
  if (!response?.ok) return { ok: false, count: null };
  const range = response.headers?.get?.("content-range") || "";
  const match = range.match(/\/(\d+)$/);
  if (!match) return { ok: false, count: null };
  return { ok: true, count: Number(match[1]) };
}

async function rest(config, table, query = "", options = {}) {
  if (!config?.ok && (!config?.url || !config?.serviceRoleKey)) return { ok: false, status: 503, code: "supabase_setup_required", rows: [] };
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
function list(config, table, context, limit = 100, extra = "") { return rest(config, table, `select=*&organization_id=eq.${encodeURIComponent(context.organizationId)}${extra}&order=created_at.desc&limit=${limit}`); }
function patchRows(config, table, context, id, body) { return rest(config, table, `id=eq.${encodeURIComponent(id)}&organization_id=eq.${encodeURIComponent(context.organizationId)}`, { method: "PATCH", prefer: "return=representation", body }); }
function updateJob(config, context, jobId, body) { return patchRows(config, TABLES.jobs, context, jobId, body); }
async function loadOne(config, table, context, id) {
  const result = await rest(config, table, `select=*&id=eq.${encodeURIComponent(id)}&organization_id=eq.${encodeURIComponent(context.organizationId)}&limit=1`);
  if (!result.ok) return { ok: false, status: 502, code: result.code };
  if (!result.rows[0]) return { ok: false, status: 404, code: "resource_not_found" };
  return { ok: true, row: result.rows[0] };
}
async function controlEvent(config, context, type, status, details, campaignId = null, jobId = null) {
  return insert(config, TABLES.events, { organization_id: context.organizationId, user_id: context.userId, campaign_id: validUuid(campaignId) ? campaignId : null, job_id: validUuid(jobId) ? jobId : null, event_type: type, event_status: status, details: sanitizeProviderPayload(details) });
}

// The form for a spec, rendered onto the record page the customer already
// reaches. Values are not carried back on a rejection here because this posts
// as JSON from the page; the server-side refusal names the fields it wants.
function createFormCard(spec, escape) {
  const fields = spec.fields.map(([column, kind, options = {}]) => {
    const label = escape(options.label || column);
    const required = options.required ? " required" : "";
    if (kind === "choice") {
      const opts = (options.values || [])
        .map((value) => `<option value="${escape(value)}"${value === options.fallback ? " selected" : ""}>${escape(value.replace(/_/g, " "))}</option>`)
        .join("");
      return `<label>${label}<select name="${escape(column)}"${required}>${opts}</select></label>`;
    }
    // An unticked box submits nothing at all, and truthy(undefined) is false --
    // so the handler refuses exactly when the customer did not tick it, which
    // is the behaviour an attestation needs. "on" is what a ticked box sends
    // and is already in truthy()'s list.
    if (kind === "checkbox") return `<label class="choice"><input name="${escape(column)}" type="checkbox" value="on"${required}> ${label}</label>`;
    if (kind === "longText") return `<label>${label}<textarea name="${escape(column)}" rows="4" maxlength="${options.max || 4000}"${required}></textarea></label>`;
    if (kind === "date") return `<label>${label}<input name="${escape(column)}" type="date"${required}></label>`;
    if (kind === "number") return `<label>${label}<input name="${escape(column)}" type="number" step="0.01"${required}></label>`;
    return `<label>${label}<input name="${escape(column)}" type="text" maxlength="${options.max || 240}"${required}></label>`;
  }).join("");
  const note = spec.safetyNote ? `<p class="fine">${escape(spec.safetyNote)}</p>` : "";
  return `<article class="card"><h2>Add a ${escape(spec.noun)}</h2><p>${escape(spec.intro)}</p>${note}<form method="post" action="/api/growth/${escape(spec.key)}">${fields}<button type="submit">Save ${escape(spec.noun)}</button></form></article>`;
}

function buildUi(deps) {
  const escape = deps.escapeHtml || esc;
  return { layout: deps.layout || basicLayout, card: deps.brandCard || card, link: deps.linkAction || link, escape };
}
function summaryTable(data, escape) {
  const cells = [
    ["Campaigns", data.campaigns.length],
    ["Leads", data.leads.length],
    ["Content queue", data.content.length],
    ["Provider jobs", data.jobs.length]
  ].map(([label, value]) => `<tr><th>${escape(label)}</th><td>${escape(String(value))}</td></tr>`).join("");
  return `<article class="card"><h2>Current workspace</h2><table><tbody>${cells}</tbody></table></article>`;
}
function basicLayout(data) { return `<!doctype html><html><head><title>${esc(data.title)}</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main><p>${esc(data.eyebrow)}</p><h1>${esc(data.heading)}</h1><p>${esc(data.body)}</p><nav>${(data.actions || []).join("")}</nav><section>${(data.sections || []).join("")}</section></main></body></html>`; }
function card(title, body) { return `<article class="card"><h2>${esc(title)}</h2><p>${esc(body)}</p></article>`; }
function link(href, label) { return `<a class="action" href="${esc(href)}">${esc(label)}</a>`; }
function pass(req, res, next) { next(); }
function esc(value) { return String(value || "").replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char])); }
function display(value) { return String(value || "unknown").replaceAll("_", " "); }
function clean(value, max = 500) { return String(value || "").trim().slice(0, max); }
function nullable(value, max = 500) { const text = clean(value, max); return text || null; }
function normalizeEmail(value) { const email = clean(value, 320).toLowerCase(); return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null; }
function validUuid(value) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || "")); }
function validDate(value) { if (!value) return null; const parsed = new Date(String(value)); return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString(); }
function normalizeDateOnly(value) { const text = clean(value, 40); return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null; }
function truthy(value) { return [true, 1, "1", "true", "yes", "on", "approved", "attested"].includes(typeof value === "string" ? value.toLowerCase() : value); }
function parseObject(value, fallback) { if (value && typeof value === "object" && !Array.isArray(value)) return value; if (!String(value || "").trim()) return fallback; try { const parsed = JSON.parse(String(value)); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback; } catch { return fallback; } }
function parseArray(value, fallback) { if (Array.isArray(value)) return value; if (!String(value || "").trim()) return fallback; try { const parsed = JSON.parse(String(value)); return Array.isArray(parsed) ? parsed : fallback; } catch { return fallback; } }
function oneOf(value, allowed, fallback) { const normalized = String(value || "").trim().toLowerCase(); return allowed.includes(normalized) ? normalized : fallback; }
function clamp(value, min, max, fallback) { const parsed = Number.parseInt(String(value ?? ""), 10); return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback; }
function numberOrNull(value) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function numberOrUndefined(value) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : undefined; }
function compact(object) { return Object.fromEntries(Object.entries(object || {}).filter(([, value]) => value !== undefined && value !== null && value !== "")); }
function countBy(rows, field) { return rows.reduce((counts, row) => ({ ...counts, [row[field] || "unknown"]: (counts[row[field] || "unknown"] || 0) + 1 }), {}); }
function safeError(error) { return clean(error?.message || error || "Unknown provider error", 1000); }
function containsUnsafeExpression(value) { const text = JSON.stringify(value || {}).toLowerCase(); return /(?:javascript:|<script|child_process|exec\s*\(|spawn\s*\(|eval\s*\(|require\s*\(|__proto__|constructor\.prototype|file:\/\/|ssh:\/\/)/.test(text); }
function sanitizeProviderPayload(value) { if (!value || typeof value !== "object") return {}; const copy = JSON.parse(JSON.stringify(value)); scrub(copy); return copy; }
function scrub(value) { if (!value || typeof value !== "object") return; for (const key of Object.keys(value)) { if (/api.?key|token|authorization|credential|secret|password/i.test(key)) value[key] = "[redacted]"; else scrub(value[key]); } }

// A browser form post announces itself either by Accept or by content type.
// Same shape as routes/sonara-last9-routes.cjs, which is where the owner record
// pages answer their own row actions.
function acceptsHtml(req) {
  return String(req.get?.("accept") || "").includes("text/html")
    || String(req.get?.("content-type") || "").includes("application/x-www-form-urlencoded");
}

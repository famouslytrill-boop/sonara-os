"use strict";

const TABLES = Object.freeze({
  initiatives: "product_lifecycle_initiatives",
  evidence: "product_lifecycle_evidence",
  requirements: "product_lifecycle_requirements",
  iterations: "product_lifecycle_iterations",
  feedback: "product_lifecycle_feedback",
  reviews: "product_lifecycle_stage_reviews",
  events: "product_lifecycle_events"
});

const STAGES = Object.freeze([
  {
    key: "discover",
    label: "Discover",
    purpose: "Define the broad problem, narrow it to a costly user pain, identify the audience, and map market, competitor, pricing, and regulatory context.",
    evidence: ["problem statement", "target audience", "market or competitor evidence", "initial value proposition"]
  },
  {
    key: "validate",
    label: "Validate",
    purpose: "Test the problem and proposed value with interviews, surveys, behavioral evidence, willingness-to-pay signals, and explicit assumptions.",
    evidence: ["customer conversations", "problem frequency and severity", "pricing or willingness-to-pay evidence", "measurable success hypothesis"]
  },
  {
    key: "plan",
    label: "Plan",
    purpose: "Set the Product Goal, core user stories, non-goals, MoSCoW priorities, wireframe direction, metric plan, budget, risks, and launch target.",
    evidence: ["Product Goal", "Must/Should/Could/Won't scope", "acceptance criteria", "primary metric and target"]
  },
  {
    key: "build",
    label: "Build",
    purpose: "Deliver small increments through goal-led iterations with a Definition of Done, automated verification, security, accessibility, and telemetry.",
    evidence: ["iteration goal", "Definition of Done", "security and accessibility checks", "traces, metrics, and logs"]
  },
  {
    key: "beta",
    label: "Beta",
    purpose: "Recruit representative testers, provide controlled access, collect structured feedback and behavioral data, triage findings, and iterate.",
    evidence: ["beta cohort", "usability and functionality feedback", "performance and satisfaction feedback", "resolved critical findings"]
  },
  {
    key: "launch",
    label: "Launch",
    purpose: "Verify positioning, landing page, pricing, billing, support, legal, analytics, incident response, rollback, and operational ownership.",
    evidence: ["launch checklist", "billing and support readiness", "compliance and security readiness", "rollback and monitoring plan"]
  },
  {
    key: "learn_scale",
    label: "Learn & Scale",
    purpose: "Use activation, retention, churn, revenue, reliability, and customer evidence to choose scale, hold, pivot, or stop.",
    evidence: ["activation and retention", "churn and revenue retention", "reliability and support load", "portfolio decision"]
  }
]);

const STUDIO_KEYS = new Set(["sonara_industries", "business_builder", "creator_studio", "growth_studio"]);
const STAGE_KEYS = new Set(STAGES.map((stage) => stage.key));
const INITIATIVE_STATUSES = new Set(["draft", "active", "on_hold", "pivoting", "launched", "scaled", "stopped", "archived"]);
const DECISIONS = new Set(["advance", "hold", "pivot", "stop", "scale"]);
const EVIDENCE_TYPES = new Set(["interview", "survey", "market_size", "competitor", "pricing", "regulatory", "usability", "analytics", "security", "accessibility", "support", "other"]);
const REQUIREMENT_TYPES = new Set(["user_story", "feature", "non_goal", "risk", "metric", "compliance", "support", "operation"]);
const PRIORITIES = new Set(["must", "should", "could", "wont"]);
const FEEDBACK_CATEGORIES = new Set(["usability", "functionality", "design", "performance", "satisfaction", "accessibility", "security", "reliability", "pricing", "support", "other"]);

module.exports = function registerProductLifecycleRoutes(app, deps = {}) {
  const requireCustomer = typeof deps.requireCustomer === "function" ? deps.requireCustomer : pass;
  const requireWorkspaceAccess = typeof deps.requireWorkspaceAccess === "function" ? deps.requireWorkspaceAccess : () => pass;
  const ui = buildUi(deps);

  app.get("/api/product-lifecycle/framework", requireCustomer, (req, res) => {
    return res.status(200).json({
      ok: true,
      name: "SONARA Product Lifecycle",
      stages: STAGES,
      controls: {
        evidenceBeforeBuild: true,
        stageGateScore: 70,
        customerFeedbackRequired: true,
        arbitraryAutonomy: false,
        directBrowserDatabaseWrites: false,
        securityIntegratedIntoLifecycle: true,
        accessibilityTarget: "WCAG_2_2_AA",
        observabilitySignals: ["traces", "metrics", "logs"],
        portfolioDecisions: ["advance", "hold", "pivot", "stop", "scale"]
      }
    });
  });

  app.get("/api/product-lifecycle/initiatives", requireCustomer, async (req, res) => {
    const context = await resolveContext(req, deps);
    if (!context.ok) return res.status(context.status).json(context);
    const studioKey = STUDIO_KEYS.has(String(req.query.studio_key || req.query.studioKey)) ? String(req.query.studio_key || req.query.studioKey) : null;
    const config = getConfig(deps);
    const result = await list(config, TABLES.initiatives, context, clamp(req.query.limit, 1, 500, 100), studioKey ? `&studio_key=eq.${encodeURIComponent(studioKey)}` : "");
    return res.status(result.ok ? 200 : 502).json({ ok: result.ok, initiatives: result.rows, code: result.code });
  });

  app.post("/api/product-lifecycle/initiatives", requireCustomer, async (req, res) => {
    const result = await createInitiative(req, deps);
    return res.status(result.status).json(result.body);
  });

  app.patch("/api/product-lifecycle/initiatives/:initiativeId", requireCustomer, async (req, res) => {
    const context = await resolveContext(req, deps);
    if (!context.ok) return res.status(context.status).json(context);
    if (!validUuid(req.params.initiativeId)) return res.status(400).json({ ok: false, code: "invalid_initiative_id" });
    const config = getConfig(deps);
    const patch = compact({
      name: req.body.name === undefined ? undefined : clean(req.body.name, 240),
      problem_statement: req.body.problem_statement === undefined && req.body.problemStatement === undefined ? undefined : nullable(req.body.problem_statement || req.body.problemStatement, 5000),
      target_audience: req.body.target_audience === undefined && req.body.targetAudience === undefined ? undefined : nullable(req.body.target_audience || req.body.targetAudience, 3000),
      value_proposition: req.body.value_proposition === undefined && req.body.valueProposition === undefined ? undefined : nullable(req.body.value_proposition || req.body.valueProposition, 3000),
      product_goal: req.body.product_goal === undefined && req.body.productGoal === undefined ? undefined : nullable(req.body.product_goal || req.body.productGoal, 3000),
      lifecycle_stage: req.body.lifecycle_stage === undefined && req.body.lifecycleStage === undefined ? undefined : oneOf(req.body.lifecycle_stage || req.body.lifecycleStage, STAGE_KEYS, null),
      status: req.body.status === undefined ? undefined : oneOf(req.body.status, INITIATIVE_STATUSES, null),
      primary_metric: req.body.primary_metric === undefined && req.body.primaryMetric === undefined ? undefined : nullable(req.body.primary_metric || req.body.primaryMetric, 300),
      target_metric: req.body.target_metric === undefined && req.body.targetMetric === undefined ? undefined : numberOrNull(req.body.target_metric ?? req.body.targetMetric),
      budget_cents: req.body.budget_cents === undefined && req.body.budgetCents === undefined ? undefined : integerOrNull(req.body.budget_cents ?? req.body.budgetCents, 0),
      target_launch_date: req.body.target_launch_date === undefined && req.body.targetLaunchDate === undefined ? undefined : dateOnly(req.body.target_launch_date || req.body.targetLaunchDate),
      metadata: req.body.metadata === undefined ? undefined : parseObject(req.body.metadata, {}),
      updated_at: new Date().toISOString()
    });
    if (!Object.keys(patch).filter((key) => key !== "updated_at").length) return res.status(400).json({ ok: false, code: "initiative_patch_required" });
    const updated = await patchRows(config, TABLES.initiatives, context, req.params.initiativeId, patch);
    if (updated.ok) await recordEvent(config, context, req.params.initiativeId, "initiative.updated", "success", { fields: Object.keys(patch) });
    return res.status(updated.ok ? 200 : 502).json({ ok: updated.ok, initiative: updated.rows[0], code: updated.code });
  });

  app.get("/api/product-lifecycle/initiatives/:initiativeId/summary", requireCustomer, async (req, res) => {
    const loaded = await loadInitiativeBundle(req, deps);
    return res.status(loaded.status).json(loaded.body);
  });

  app.post("/api/product-lifecycle/initiatives/:initiativeId/evidence", requireCustomer, async (req, res) => {
    const result = await addEvidence(req, deps);
    return res.status(result.status).json(result.body);
  });

  app.post("/api/product-lifecycle/initiatives/:initiativeId/requirements", requireCustomer, async (req, res) => {
    const result = await addRequirement(req, deps);
    return res.status(result.status).json(result.body);
  });

  app.post("/api/product-lifecycle/initiatives/:initiativeId/iterations", requireCustomer, async (req, res) => {
    const result = await addIteration(req, deps);
    return res.status(result.status).json(result.body);
  });

  app.post("/api/product-lifecycle/initiatives/:initiativeId/feedback", requireCustomer, async (req, res) => {
    const result = await addFeedback(req, deps);
    return res.status(result.status).json(result.body);
  });

  app.post("/api/product-lifecycle/initiatives/:initiativeId/reviews", requireCustomer, async (req, res) => {
    const result = await addStageReview(req, deps);
    return res.status(result.status).json(result.body);
  });

  app.get("/product-lifecycle", requireCustomer, (req, res) => renderLifecycleDashboard(req, res, deps, ui, "sonara_industries"));
  app.get("/business-builder/product-lifecycle", requireWorkspaceAccess("business_builder"), (req, res) => renderLifecycleDashboard(req, res, deps, ui, "business_builder"));
  app.get("/creator-studio/product-lifecycle", requireWorkspaceAccess("creator_studio"), (req, res) => renderLifecycleDashboard(req, res, deps, ui, "creator_studio"));
  app.get("/growth-studio/product-lifecycle", requireWorkspaceAccess("growth_studio"), (req, res) => renderLifecycleDashboard(req, res, deps, ui, "growth_studio"));

  app.post("/product-lifecycle/initiatives", requireCustomer, async (req, res) => {
    const result = await createInitiative(req, deps);
    if (!result.body.ok) return res.status(result.status).type("html").send(ui.layout({ title: "Initiative not created", eyebrow: "Product lifecycle", heading: "Initiative not created", body: result.body.code, sections: [], actions: [ui.link("/product-lifecycle", "Return")] }));
    return res.redirect(303, `/product-lifecycle/initiatives/${encodeURIComponent(result.body.initiative.id)}`);
  });

  app.get("/product-lifecycle/initiatives/:initiativeId", requireCustomer, async (req, res) => {
    const loaded = await loadInitiativeBundle(req, deps);
    if (!loaded.body.ok) return res.status(loaded.status).type("html").send(ui.layout({ title: "Initiative unavailable", eyebrow: "Product lifecycle", heading: "Initiative unavailable", body: loaded.body.code, sections: [], actions: [ui.link("/product-lifecycle", "Return")] }));
    const data = loaded.body;
    const initiative = data.initiative;
    return res.status(200).type("html").send(ui.layout({
      title: `${initiative.name} | Product Lifecycle`,
      eyebrow: `${studioLabel(initiative.studio_key)} · ${stageLabel(initiative.lifecycle_stage)}`,
      heading: initiative.name,
      body: initiative.product_goal || initiative.problem_statement || "Add a Product Goal and evidence before advancing.",
      sections: [
        scoreCard(data.readiness, ui.escape),
        ui.card("Problem and audience", `${initiative.problem_statement || "Problem not recorded"} Audience: ${initiative.target_audience || "not recorded"}`),
        ui.card("Evidence", `${data.evidence.length} records across ${Object.keys(countBy(data.evidence, "evidence_type")).length} evidence types.`),
        ui.card("MVP scope", `${data.requirements.length} requirements; ${data.requirements.filter((row) => row.priority === "must").length} Must Have items.`),
        ui.card("Iterations", `${data.iterations.length} planned or completed iterations.`),
        ui.card("Beta feedback", `${data.feedback.length} findings; ${data.feedback.filter((row) => row.severity === "critical" && !["resolved", "declined", "duplicate"].includes(row.status)).length} unresolved critical findings.`),
        evidenceForm(initiative.id, ui.escape),
        requirementForm(initiative.id, ui.escape),
        feedbackForm(initiative.id, ui.escape),
        reviewForm(initiative.id, initiative.lifecycle_stage, data.readiness.score, ui.escape)
      ],
      actions: [ui.link("/product-lifecycle", "Portfolio"), ui.link(`/api/product-lifecycle/initiatives/${initiative.id}/summary`, "Summary JSON"), ui.link("/api/product-lifecycle/framework", "Framework JSON")]
    }));
  });

  for (const [suffix, handler] of [["evidence", addEvidence], ["requirements", addRequirement], ["iterations", addIteration], ["feedback", addFeedback], ["reviews", addStageReview]]) {
    app.post(`/product-lifecycle/initiatives/:initiativeId/${suffix}`, requireCustomer, async (req, res) => {
      const result = await handler(req, deps);
      if (!result.body.ok) return res.status(result.status).type("html").send(ui.layout({ title: "Lifecycle update not accepted", eyebrow: "Product lifecycle", heading: "Update not accepted", body: result.body.message || result.body.code, sections: [], actions: [ui.link(`/product-lifecycle/initiatives/${req.params.initiativeId}`, "Return")] }));
      return res.redirect(303, `/product-lifecycle/initiatives/${encodeURIComponent(req.params.initiativeId)}`);
    });
  }
};

async function createInitiative(req, deps) {
  const context = await resolveContext(req, deps);
  if (!context.ok) return { status: context.status, body: context };
  const config = getConfig(deps);
  if (!config.ok) return { status: 503, body: { ok: false, code: "supabase_setup_required" } };
  const name = clean(req.body.name, 240);
  const studioKey = oneOf(req.body.studio_key || req.body.studioKey, STUDIO_KEYS, null);
  if (!name || !studioKey) return { status: 400, body: { ok: false, code: "initiative_name_and_studio_required" } };
  const created = await insert(config, TABLES.initiatives, {
    organization_id: context.organizationId,
    created_by: context.userId,
    owner_id: context.userId,
    studio_key: studioKey,
    name,
    problem_statement: nullable(req.body.problem_statement || req.body.problemStatement, 5000),
    target_audience: nullable(req.body.target_audience || req.body.targetAudience, 3000),
    value_proposition: nullable(req.body.value_proposition || req.body.valueProposition, 3000),
    product_goal: nullable(req.body.product_goal || req.body.productGoal, 3000),
    lifecycle_stage: oneOf(req.body.lifecycle_stage || req.body.lifecycleStage, STAGE_KEYS, "discover"),
    status: oneOf(req.body.status, INITIATIVE_STATUSES, "active"),
    primary_metric: nullable(req.body.primary_metric || req.body.primaryMetric, 300),
    target_metric: numberOrNull(req.body.target_metric ?? req.body.targetMetric),
    budget_cents: integerOrNull(req.body.budget_cents ?? req.body.budgetCents, 0),
    target_launch_date: dateOnly(req.body.target_launch_date || req.body.targetLaunchDate),
    metadata: parseObject(req.body.metadata, {})
  });
  if (created.ok) await recordEvent(config, context, created.rows[0]?.id, "initiative.created", "success", { studio_key: studioKey, stage: created.rows[0]?.lifecycle_stage });
  return { status: created.ok ? 201 : 502, body: { ok: created.ok, initiative: created.rows[0], code: created.code } };
}

async function addEvidence(req, deps) {
  const base = await prepareChildWrite(req, deps);
  if (!base.ok) return { status: base.status, body: base };
  const evidenceType = oneOf(req.body.evidence_type || req.body.evidenceType, EVIDENCE_TYPES, null);
  const source = clean(req.body.source, 500);
  const summary = clean(req.body.summary, 5000);
  if (!evidenceType || !source || !summary) return { status: 400, body: { ok: false, code: "evidence_type_source_and_summary_required" } };
  const created = await insert(base.config, TABLES.evidence, {
    organization_id: base.context.organizationId,
    initiative_id: base.initiative.id,
    created_by: base.context.userId,
    evidence_type: evidenceType,
    source,
    summary,
    confidence: oneOf(req.body.confidence, new Set(["unknown", "low", "medium", "high", "verified"]), "unknown"),
    participant_count: integerOrNull(req.body.participant_count ?? req.body.participantCount, 0),
    evidence_reference: nullable(req.body.evidence_reference || req.body.evidenceReference, 2000),
    collected_at: validDate(req.body.collected_at || req.body.collectedAt) || new Date().toISOString(),
    metadata: parseObject(req.body.metadata, {})
  });
  if (created.ok) await recordEvent(base.config, base.context, base.initiative.id, "evidence.recorded", "success", { evidence_type: evidenceType, confidence: created.rows[0]?.confidence });
  return { status: created.ok ? 201 : 502, body: { ok: created.ok, evidence: created.rows[0], code: created.code } };
}

async function addRequirement(req, deps) {
  const base = await prepareChildWrite(req, deps);
  if (!base.ok) return { status: base.status, body: base };
  const requirementType = oneOf(req.body.requirement_type || req.body.requirementType, REQUIREMENT_TYPES, null);
  const title = clean(req.body.title, 500);
  if (!requirementType || !title) return { status: 400, body: { ok: false, code: "requirement_type_and_title_required" } };
  const created = await insert(base.config, TABLES.requirements, {
    organization_id: base.context.organizationId,
    initiative_id: base.initiative.id,
    created_by: base.context.userId,
    requirement_type: requirementType,
    title,
    detail: nullable(req.body.detail, 5000),
    priority: oneOf(req.body.priority, PRIORITIES, "must"),
    acceptance_criteria: nullable(req.body.acceptance_criteria || req.body.acceptanceCriteria, 5000),
    status: oneOf(req.body.status, new Set(["proposed", "approved", "in_progress", "done", "rejected", "deferred"]), "proposed"),
    metadata: parseObject(req.body.metadata, {})
  });
  if (created.ok) await recordEvent(base.config, base.context, base.initiative.id, "requirement.recorded", "success", { requirement_type: requirementType, priority: created.rows[0]?.priority });
  return { status: created.ok ? 201 : 502, body: { ok: created.ok, requirement: created.rows[0], code: created.code } };
}

async function addIteration(req, deps) {
  const base = await prepareChildWrite(req, deps);
  if (!base.ok) return { status: base.status, body: base };
  const iterationNumber = integerOrNull(req.body.iteration_number ?? req.body.iterationNumber, 1);
  const goal = clean(req.body.goal, 3000);
  if (!iterationNumber || !goal) return { status: 400, body: { ok: false, code: "iteration_number_and_goal_required" } };
  const created = await insert(base.config, TABLES.iterations, {
    organization_id: base.context.organizationId,
    initiative_id: base.initiative.id,
    created_by: base.context.userId,
    iteration_number: iterationNumber,
    goal,
    starts_at: dateOnly(req.body.starts_at || req.body.startsAt),
    ends_at: dateOnly(req.body.ends_at || req.body.endsAt),
    status: oneOf(req.body.status, new Set(["planned", "active", "review", "completed", "cancelled"]), "planned"),
    definition_of_done: nullable(req.body.definition_of_done || req.body.definitionOfDone, 5000),
    review_notes: nullable(req.body.review_notes || req.body.reviewNotes, 5000),
    retrospective_notes: nullable(req.body.retrospective_notes || req.body.retrospectiveNotes, 5000),
    metadata: parseObject(req.body.metadata, {})
  });
  if (created.ok) await recordEvent(base.config, base.context, base.initiative.id, "iteration.created", "success", { iteration_number: iterationNumber, goal });
  return { status: created.ok ? 201 : 502, body: { ok: created.ok, iteration: created.rows[0], code: created.code } };
}

async function addFeedback(req, deps) {
  const base = await prepareChildWrite(req, deps);
  if (!base.ok) return { status: base.status, body: base };
  const category = oneOf(req.body.category, FEEDBACK_CATEGORIES, null);
  const summary = clean(req.body.summary, 5000);
  if (!category || !summary) return { status: 400, body: { ok: false, code: "feedback_category_and_summary_required" } };
  const created = await insert(base.config, TABLES.feedback, {
    organization_id: base.context.organizationId,
    initiative_id: base.initiative.id,
    created_by: base.context.userId,
    beta_cohort: nullable(req.body.beta_cohort || req.body.betaCohort, 500),
    category,
    severity: oneOf(req.body.severity, new Set(["low", "medium", "high", "critical"]), "medium"),
    sentiment: oneOf(req.body.sentiment, new Set(["negative", "neutral", "positive", "mixed"]), "neutral"),
    summary,
    evidence_reference: nullable(req.body.evidence_reference || req.body.evidenceReference, 2000),
    status: oneOf(req.body.status, new Set(["new", "triaged", "planned", "resolved", "declined", "duplicate"]), "new"),
    metadata: parseObject(req.body.metadata, {})
  });
  if (created.ok) await recordEvent(base.config, base.context, base.initiative.id, "feedback.recorded", "success", { category, severity: created.rows[0]?.severity });
  return { status: created.ok ? 201 : 502, body: { ok: created.ok, feedback: created.rows[0], code: created.code } };
}

async function addStageReview(req, deps) {
  const bundle = await loadInitiativeBundle(req, deps);
  if (!bundle.body.ok) return { status: bundle.status, body: bundle.body };
  const { context, config } = bundle.internal;
  const decision = oneOf(req.body.decision, DECISIONS, null);
  const rationale = clean(req.body.rationale, 5000);
  if (!decision || !rationale) return { status: 400, body: { ok: false, code: "review_decision_and_rationale_required" } };
  const readiness = bundle.body.readiness;
  if (["advance", "scale"].includes(decision) && readiness.score < 70) {
    return { status: 409, body: { ok: false, code: "stage_gate_not_ready", message: `Readiness score ${readiness.score} is below the 70-point advance threshold.`, readiness } };
  }
  if (["advance", "scale"].includes(decision) && readiness.blockers.length) {
    return { status: 409, body: { ok: false, code: "stage_gate_blocked", message: readiness.blockers.join(" "), readiness } };
  }
  const created = await insert(config, TABLES.reviews, {
    organization_id: context.organizationId,
    initiative_id: bundle.body.initiative.id,
    created_by: context.userId,
    stage: bundle.body.initiative.lifecycle_stage,
    decision,
    readiness_score: readiness.score,
    checklist: parseObject(req.body.checklist, readiness.criteria),
    metrics: parseObject(req.body.metrics, {}),
    risks: parseArray(req.body.risks, []),
    rationale,
    approved_by: truthy(req.body.approved || req.body.approval_attested || req.body.approvalAttested) ? context.userId : null,
    approved_at: truthy(req.body.approved || req.body.approval_attested || req.body.approvalAttested) ? new Date().toISOString() : null
  });
  if (!created.ok) return { status: 502, body: { ok: false, code: created.code } };
  const nextStage = decision === "advance" ? stageAfter(bundle.body.initiative.lifecycle_stage) : bundle.body.initiative.lifecycle_stage;
  const status = decision === "stop" ? "stopped" : decision === "pivot" ? "pivoting" : decision === "hold" ? "on_hold" : decision === "scale" ? "scaled" : bundle.body.initiative.status;
  const updated = await patchRows(config, TABLES.initiatives, context, bundle.body.initiative.id, {
    lifecycle_stage: nextStage,
    latest_decision: decision,
    status,
    updated_at: new Date().toISOString()
  });
  await recordEvent(config, context, bundle.body.initiative.id, "stage_review.recorded", "success", { stage: bundle.body.initiative.lifecycle_stage, decision, readiness_score: readiness.score, next_stage: nextStage });
  return { status: 201, body: { ok: true, review: created.rows[0], initiative: updated.rows[0], readiness } };
}

async function prepareChildWrite(req, deps) {
  const context = await resolveContext(req, deps);
  if (!context.ok) return context;
  if (!validUuid(req.params.initiativeId)) return { ok: false, status: 400, code: "invalid_initiative_id" };
  const config = getConfig(deps);
  if (!config.ok) return { ok: false, status: 503, code: "supabase_setup_required" };
  const loaded = await loadOne(config, TABLES.initiatives, context, req.params.initiativeId);
  if (!loaded.ok) return loaded;
  return { ok: true, status: 200, context, config, initiative: loaded.row };
}

async function loadInitiativeBundle(req, deps) {
  const context = await resolveContext(req, deps);
  if (!context.ok) return { status: context.status, body: context };
  if (!validUuid(req.params.initiativeId)) return { status: 400, body: { ok: false, code: "invalid_initiative_id" } };
  const config = getConfig(deps);
  if (!config.ok) return { status: 503, body: { ok: false, code: "supabase_setup_required" } };
  const loaded = await loadOne(config, TABLES.initiatives, context, req.params.initiativeId);
  if (!loaded.ok) return { status: loaded.status, body: loaded };
  const idFilter = `&initiative_id=eq.${encodeURIComponent(loaded.row.id)}`;
  const [evidence, requirements, iterations, feedback, reviews] = await Promise.all([
    list(config, TABLES.evidence, context, 500, idFilter),
    list(config, TABLES.requirements, context, 500, idFilter),
    list(config, TABLES.iterations, context, 200, idFilter),
    list(config, TABLES.feedback, context, 500, idFilter),
    list(config, TABLES.reviews, context, 100, idFilter)
  ]);
  const bundle = {
    initiative: loaded.row,
    evidence: evidence.rows,
    requirements: requirements.rows,
    iterations: iterations.rows,
    feedback: feedback.rows,
    reviews: reviews.rows
  };
  const readiness = scoreInitiative(bundle);
  return { status: 200, body: { ok: true, ...bundle, readiness }, internal: { context, config } };
}

async function renderLifecycleDashboard(req, res, deps, ui, studioKey) {
  const context = await resolveContext(req, deps);
  if (!context.ok) return res.status(context.status).json(context);
  const config = getConfig(deps);
  let initiatives = [];
  if (config.ok) {
    const result = await list(config, TABLES.initiatives, context, 100, `&studio_key=eq.${encodeURIComponent(studioKey)}`);
    initiatives = result.rows;
  }
  const sections = [
    ui.card("Evidence before expansion", "Do not build because an idea sounds exciting. Record the problem, audience, market evidence, alternatives, pricing evidence, assumptions, and decision rationale."),
    ui.card("MVP means hypothesis test", "Scope only the smallest coherent experience that tests the riskiest assumptions. Record non-goals and Won't Have items to prevent feature creep."),
    ui.card("Definition of Done", "Every increment includes tests, security, accessibility, privacy, operational ownership, support impact, and traces, metrics, and logs where applicable."),
    ui.card("Stage gates", "Advance only when evidence reaches the readiness threshold and no critical blocker remains. Valid decisions are advance, hold, pivot, stop, or scale."),
    initiativeForm(studioKey, ui.escape),
    ...initiatives.map((initiative) => initiativeCard(initiative, ui))
  ];
  return res.status(200).type("html").send(ui.layout({
    title: `${studioLabel(studioKey)} Product Lifecycle`,
    eyebrow: "SONARA Product Lifecycle",
    heading: `${studioLabel(studioKey)} discovery, MVP, beta, launch, and learning`,
    body: "Turn ideas into evidence-backed products through one tenant-scoped operating model shared across SONARA Industries, Business Builder, Creator Studio, and Growth Studio.",
    sections,
    actions: [ui.link("/api/product-lifecycle/framework", "Framework JSON"), ui.link(`/api/product-lifecycle/initiatives?studio_key=${encodeURIComponent(studioKey)}`, "Initiatives JSON"), ui.link("/dashboard", "Command center")]
  }));
}

function scoreInitiative(bundle) {
  const initiative = bundle.initiative;
  const evidenceTypes = new Set(bundle.evidence.map((row) => row.evidence_type));
  const requirementTypes = new Set(bundle.requirements.map((row) => row.requirement_type));
  const feedbackCategories = new Set(bundle.feedback.map((row) => row.category));
  const unresolvedCritical = bundle.feedback.filter((row) => row.severity === "critical" && !["resolved", "declined", "duplicate"].includes(row.status)).length;
  const hasDoneIteration = bundle.iterations.some((row) => ["active", "review", "completed"].includes(row.status));
  const hasDefinitionOfDone = bundle.iterations.some((row) => clean(row.definition_of_done, 50));
  const criteriaByStage = {
    discover: {
      problem_statement: Boolean(clean(initiative.problem_statement, 20)),
      target_audience: Boolean(clean(initiative.target_audience, 20)),
      market_or_competitor_evidence: evidenceTypes.has("market_size") || evidenceTypes.has("competitor"),
      customer_evidence: evidenceTypes.has("interview") || evidenceTypes.has("survey"),
      value_proposition: Boolean(clean(initiative.value_proposition, 20))
    },
    validate: {
      three_evidence_records: bundle.evidence.length >= 3,
      customer_evidence: evidenceTypes.has("interview") || evidenceTypes.has("survey"),
      economic_evidence: evidenceTypes.has("pricing") || evidenceTypes.has("market_size"),
      value_proposition: Boolean(clean(initiative.value_proposition, 20)),
      primary_metric: Boolean(clean(initiative.primary_metric, 3))
    },
    plan: {
      product_goal: Boolean(clean(initiative.product_goal, 20)),
      must_have_scope: bundle.requirements.some((row) => row.priority === "must"),
      user_story: requirementTypes.has("user_story"),
      non_goals: requirementTypes.has("non_goal") || bundle.requirements.some((row) => row.priority === "wont"),
      metric_and_target: Boolean(clean(initiative.primary_metric, 3)) && initiative.target_metric !== null && initiative.target_metric !== undefined
    },
    build: {
      iteration: bundle.iterations.length > 0,
      active_or_completed_increment: hasDoneIteration,
      definition_of_done: hasDefinitionOfDone,
      security_evidence: evidenceTypes.has("security"),
      accessibility_and_telemetry: evidenceTypes.has("accessibility") && evidenceTypes.has("analytics")
    },
    beta: {
      structured_feedback: bundle.feedback.length >= 3,
      usability_feedback: feedbackCategories.has("usability"),
      functionality_feedback: feedbackCategories.has("functionality"),
      performance_or_reliability: feedbackCategories.has("performance") || feedbackCategories.has("reliability"),
      no_unresolved_critical_feedback: unresolvedCritical === 0
    },
    launch: {
      pricing_evidence: evidenceTypes.has("pricing"),
      support_readiness: requirementTypes.has("support") || evidenceTypes.has("support"),
      compliance_and_security: (requirementTypes.has("compliance") || evidenceTypes.has("regulatory")) && evidenceTypes.has("security"),
      analytics_ready: evidenceTypes.has("analytics"),
      no_unresolved_critical_feedback: unresolvedCritical === 0
    },
    learn_scale: {
      analytics_evidence: evidenceTypes.has("analytics"),
      primary_metric: Boolean(clean(initiative.primary_metric, 3)),
      customer_feedback: bundle.feedback.length > 0,
      stage_review: bundle.reviews.length > 0,
      no_unresolved_critical_feedback: unresolvedCritical === 0
    }
  };
  const criteria = criteriaByStage[initiative.lifecycle_stage] || criteriaByStage.discover;
  const values = Object.values(criteria);
  const score = Math.round((values.filter(Boolean).length / values.length) * 100);
  const missing = Object.entries(criteria).filter(([, passed]) => !passed).map(([key]) => key.replaceAll("_", " "));
  const blockers = unresolvedCritical ? [`Resolve ${unresolvedCritical} critical beta finding(s) before advancing.`] : [];
  return { score, threshold: 70, stage: initiative.lifecycle_stage, criteria, missing, blockers, readyToAdvance: score >= 70 && blockers.length === 0 };
}

function initiativeForm(studioKey, escape) {
  return `<article class="card"><h2>Create lifecycle initiative</h2><form method="post" action="/product-lifecycle/initiatives"><input type="hidden" name="studio_key" value="${escape(studioKey)}"><label>Name<input name="name" required maxlength="240"></label><label>Problem statement<textarea name="problem_statement" required></textarea></label><label>Target audience<textarea name="target_audience" required></textarea></label><label>Initial value proposition<textarea name="value_proposition"></textarea></label><label>Product Goal<textarea name="product_goal"></textarea></label><label>Primary metric<input name="primary_metric"></label><button type="submit">Create initiative</button></form></article>`;
}

function evidenceForm(id, escape) {
  return `<article class="card"><h2>Add evidence</h2><form method="post" action="/product-lifecycle/initiatives/${escape(id)}/evidence"><label>Type<select name="evidence_type">${[...EVIDENCE_TYPES].map((value) => `<option value="${value}">${value.replaceAll("_", " ")}</option>`).join("")}</select></label><label>Source<input name="source" required></label><label>Summary<textarea name="summary" required></textarea></label><label>Confidence<select name="confidence"><option>unknown</option><option>low</option><option>medium</option><option>high</option><option>verified</option></select></label><label>Participant count<input type="number" min="0" name="participant_count"></label><button type="submit">Record evidence</button></form></article>`;
}

function requirementForm(id, escape) {
  return `<article class="card"><h2>Add scope or operating requirement</h2><form method="post" action="/product-lifecycle/initiatives/${escape(id)}/requirements"><label>Type<select name="requirement_type">${[...REQUIREMENT_TYPES].map((value) => `<option value="${value}">${value.replaceAll("_", " ")}</option>`).join("")}</select></label><label>Title<input name="title" required></label><label>Detail<textarea name="detail"></textarea></label><label>Priority<select name="priority"><option value="must">Must Have</option><option value="should">Should Have</option><option>value="could">Could Have</option><option value="wont">Won't Have</option></select></label><label>Acceptance criteria<textarea name="acceptance_criteria"></textarea></label><button type="submit">Add requirement</button></form></article>`;
}

function feedbackForm(id, escape) {
  return `<article class="card"><h2>Record beta or customer feedback</h2><form method="post" action="/product-lifecycle/initiatives/${escape(id)}/feedback"><label>Category<select name="category">${[...FEEDBACK_CATEGORIES].map((value) => `<option value="${value}">${value}</option>`).join("")}</select></label><label>Severity<select name="severity"><option>low</option><option selected>medium</option><option>high</option><option>critical</option></select></label><label>Summary<textarea name="summary" required></textarea></label><label>Beta cohort<input name="beta_cohort"></label><button type="submit">Record feedback</button></form></article>`;
}

function reviewForm(id, stage, score, escape) {
  return `<article class="card"><h2>Stage review</h2><p>Current readiness score: ${escape(String(score))}/100. Advance and scale decisions require at least 70 with no critical blocker.</p><form method="post" action="/product-lifecycle/initiatives/${escape(id)}/reviews"><input type="hidden" name="stage" value="${escape(stage)}"><label>Decision<select name="decision"><option>hold</option><option>advance</option><option>pivot</option><option>stop</option><option>scale</option></select></label><label>Rationale<textarea name="rationale" required></textarea></label><label><input type="checkbox" name="approved" value="true"> Owner approval attested</label><button type="submit">Record review</button></form></article>`;
}

function initiativeCard(initiative, ui) {
  return `<article class="card"><h2>${ui.escape(initiative.name)}</h2><p>${ui.escape(stageLabel(initiative.lifecycle_stage))} · ${ui.escape(String(initiative.status).replaceAll("_", " "))}</p><p>${ui.escape(initiative.product_goal || initiative.problem_statement || "Evidence and Product Goal required.")}</p><div class="card-actions">${ui.link(`/product-lifecycle/initiatives/${initiative.id}`, "Open initiative")}${ui.link(`/api/product-lifecycle/initiatives/${initiative.id}/summary`, "Summary JSON")}</div></article>`;
}

function scoreCard(readiness, escape) {
  return `<article class="card"><h2>Stage readiness: ${escape(String(readiness.score))}/100</h2><p>${readiness.readyToAdvance ? "Gate threshold met." : `Missing: ${escape(readiness.missing.join(", ") || "none")}`}</p>${readiness.blockers.length ? `<p>${escape(readiness.blockers.join(" "))}</p>` : ""}</article>`;
}

function buildUi(deps) {
  return {
    layout: deps.layout || basicLayout,
    card: deps.brandCard || card,
    link: deps.linkAction || link,
    escape: deps.escapeHtml || esc
  };
}

async function resolveContext(req, deps) {
  const user = req.sonaraUser || req.sonaraCustomer?.user || req.sonaraAccess?.user || null;
  if (!user?.id) return { ok: false, status: 401, code: "customer_auth_required" };
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
async function loadOne(config, table, context, id) {
  const result = await rest(config, table, `select=*&id=eq.${encodeURIComponent(id)}&organization_id=eq.${encodeURIComponent(context.organizationId)}&limit=1`);
  if (!result.ok) return { ok: false, status: 502, code: result.code };
  if (!result.rows[0]) return { ok: false, status: 404, code: "resource_not_found" };
  return { ok: true, row: result.rows[0] };
}
async function recordEvent(config, context, initiativeId, type, status, details) {
  return insert(config, TABLES.events, { organization_id: context.organizationId, initiative_id: validUuid(initiativeId) ? initiativeId : null, user_id: context.userId, event_type: type, event_status: status, details: parseObject(details, {}) });
}

function stageAfter(stage) {
  const index = STAGES.findIndex((item) => item.key === stage);
  return index >= 0 && index < STAGES.length - 1 ? STAGES[index + 1].key : stage;
}
function stageLabel(stage) { return STAGES.find((item) => item.key === stage)?.label || String(stage || "Discover"); }
function studioLabel(key) { return ({ sonara_industries: "SONARA Industries", business_builder: "Business Builder", creator_studio: "Creator Studio", growth_studio: "Growth Studio" })[key] || "SONARA"; }
function countBy(rows, key) { return rows.reduce((acc, row) => { const value = row[key] || "unknown"; acc[value] = (acc[value] || 0) + 1; return acc; }, {}); }
function pass(req, res, next) { next(); }
function clean(value, max = 500) { return String(value || "").trim().slice(0, max); }
function nullable(value, max = 500) { const text = clean(value, max); return text || null; }
function compact(value) { return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)); }
function oneOf(value, allowed, fallback) { const text = clean(value, 100); return allowed.has(text) ? text : fallback; }
function parseObject(value, fallback = {}) { if (value && typeof value === "object" && !Array.isArray(value)) return value; try { const parsed = JSON.parse(String(value || "")); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback; } catch { return fallback; } }
function parseArray(value, fallback = []) { if (Array.isArray(value)) return value; try { const parsed = JSON.parse(String(value || "")); return Array.isArray(parsed) ? parsed : fallback; } catch { return fallback; } }
function truthy(value) { return [true, 1, "1", "true", "yes", "on"].includes(value); }
function numberOrNull(value) { if (value === undefined || value === null || value === "") return null; const number = Number(value); return Number.isFinite(number) ? number : null; }
function integerOrNull(value, min = Number.MIN_SAFE_INTEGER) { if (value === undefined || value === null || value === "") return null; const number = Number(value); return Number.isInteger(number) && number >= min ? number : null; }
function dateOnly(value) { const text = clean(value, 10); return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null; }
function validDate(value) { const text = clean(value, 100); return text && !Number.isNaN(Date.parse(text)) ? new Date(text).toISOString() : null; }
function validUuid(value) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || "")); }
function clamp(value, min, max, fallback) { const number = Number(value); return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.floor(number))) : fallback; }
function esc(value) { return String(value || "").replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char])); }
function basicLayout(data) { return `<!doctype html><html><head><title>${esc(data.title)}</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main><p>${esc(data.eyebrow)}</p><h1>${esc(data.heading)}</h1><p>${esc(data.body)}</p><nav>${(data.actions || []).join("")}</nav><section>${(data.sections || []).join("")}</section></main></body></html>`; }
function card(title, body) { return `<article class="card"><h2>${esc(title)}</h2><p>${esc(body)}</p></article>`; }
function link(href, label) { return `<a class="action" href="${esc(href)}">${esc(label)}</a>`; }

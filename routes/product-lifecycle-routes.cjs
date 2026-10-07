// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
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
const ITERATION_STATUSES = new Set(["planned", "active", "review", "completed", "cancelled"]);
const FEEDBACK_STATUSES = new Set(["new", "triaged", "planned", "resolved", "declined", "duplicate"]);
// A finding moved to one of these no longer blocks a stage. Saying why is
// required, because the gate reads only the status: "resolved" with no note is
// a blocker somebody removed, not one somebody fixed.
const CLOSED_FEEDBACK_STATUSES = new Set(["resolved", "declined", "duplicate"]);

// What a person edits on the initiative page.
//
// The stage is not among them, and neither are the statuses a stage review
// decides. The stage moves through a review and nowhere else: the review is
// graded against the stage the record is in (see
// tests/a-stage-review-grades-the-stage-the-record-is-in.test.js), and a field
// that moved the stage directly would make that grading optional. The JSON
// PATCH accepted `lifecycle_stage` until 7 October 2026, so any caller could
// skip every gate by naming the stage it wanted.
const EDITABLE_FIELDS = Object.freeze([
  "name", "problem_statement", "target_audience", "value_proposition",
  "product_goal", "primary_metric", "target_metric", "target_launch_date"
]);
const DECISION_STATUSES = new Set(["on_hold", "pivoting", "stopped", "scaled"]);

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
    const result = await updateInitiative(req, deps, req.body);
    return res.status(result.status).json(result.body);
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
    if (!loaded.body.ok) return res.status(loaded.status).type("html").send(ui.layout({ title: "Initiative unavailable", eyebrow: "Product lifecycle", heading: "Initiative unavailable", body: loaded.body.message || loaded.body.code, sections: [], actions: [ui.link("/product-lifecycle", "Return")] }));
    const data = loaded.body;
    const initiative = data.initiative;
    return res.status(200).type("html").send(ui.layout({
      title: `${initiative.name} | Roadmap`,
      eyebrow: `${studioLabel(initiative.studio_key)} · ${stageLabel(initiative.lifecycle_stage)}`,
      heading: initiative.name,
      body: initiative.product_goal || initiative.problem_statement || "Add a Product Goal and evidence before advancing.",
      sections: [
        scoreCard(data.readiness, ui.escape),
        ui.card("Problem and audience", `${initiative.problem_statement || "Problem not recorded"} Audience: ${initiative.target_audience || "not recorded"}`),
        ui.card("Evidence", `${data.evidence.length} records across ${Object.keys(countBy(data.evidence, "evidence_type")).length} evidence types.`),
        ui.card("MVP scope", `${data.requirements.length} requirements; ${data.requirements.filter((row) => row.priority === "must").length} Must Have items.`),
        iterationsCard(initiative.id, data.iterations, ui.escape),
        feedbackCard(initiative.id, data.feedback, ui.escape),
        initiativeEditForm(initiative, ui.escape),
        evidenceForm(initiative.id, ui.escape),
        requirementForm(initiative.id, ui.escape),
        iterationForm(initiative.id, data.iterations, ui.escape),
        feedbackForm(initiative.id, ui.escape),
        reviewForm(initiative.id, data.readiness.score, ui.escape)
      ],
      actions: [ui.link("/product-lifecycle", "Portfolio")]
    }));
  });

  // The initiative page's own form. Only the editable fields travel, so a
  // crafted post naming a stage or a decision status is refused below rather
  // than trusted.
  app.post("/product-lifecycle/initiatives/:initiativeId", requireCustomer, async (req, res) => {
    const back = `/product-lifecycle/initiatives/${encodeURIComponent(req.params.initiativeId)}`;
    const edits = Object.fromEntries(EDITABLE_FIELDS.filter((field) => req.body[field] !== undefined).map((field) => [field, req.body[field]]));
    const result = await updateInitiative(req, deps, edits);
    if (!result.body.ok) return res.status(result.status).type("html").send(ui.layout({ title: "Initiative not updated", eyebrow: "Product lifecycle", heading: "Initiative not updated", body: result.body.message || result.body.code, sections: [], actions: [ui.link(back, "Return")] }));
    return res.redirect(303, back);
  });

  // Moving an iteration along, and closing a finding. Without these an
  // iteration recorded as planned stayed planned, and a critical finding stayed
  // open, for good -- and the build gate needs an active iteration while beta,
  // launch and learn & scale are blocked by any open critical finding. The
  // gates could be read on this page and not passed from it.
  for (const [suffix, handler] of [["iterations", changeIterationStatus], ["feedback", changeFeedbackStatus]]) {
    app.post(`/product-lifecycle/initiatives/:initiativeId/${suffix}/:recordId/status`, requireCustomer, async (req, res) => {
      const back = `/product-lifecycle/initiatives/${encodeURIComponent(req.params.initiativeId)}`;
      const result = await handler(req, deps);
      if (!result.body.ok) return res.status(result.status).type("html").send(ui.layout({ title: "Status not changed", eyebrow: "Product lifecycle", heading: "Status not changed", body: result.body.message || result.body.code, sections: [], actions: [ui.link(back, "Return")] }));
      return res.redirect(303, back);
    });
  }

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
    status: oneOf(req.body.status, ITERATION_STATUSES, "planned"),
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
    status: oneOf(req.body.status, FEEDBACK_STATUSES, "new"),
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

async function updateInitiative(req, deps, input = {}) {
  const context = await resolveContext(req, deps);
  if (!context.ok) return { status: context.status, body: context };
  if (!validUuid(req.params.initiativeId)) return { status: 400, body: { ok: false, code: "invalid_initiative_id" } };
  if (input.lifecycle_stage !== undefined || input.lifecycleStage !== undefined) {
    return { status: 400, body: { ok: false, code: "stage_moves_by_review", message: "The stage changes through a stage review, which is graded against the stage the initiative is in. Record a review instead." } };
  }
  if (input.status !== undefined && DECISION_STATUSES.has(String(input.status))) {
    return { status: 400, body: { ok: false, code: "status_set_by_review", message: "On hold, pivoting, stopped and scaled are the outcomes of a stage review. Record a review instead." } };
  }
  if (input.name !== undefined && !clean(input.name, 240)) return { status: 400, body: { ok: false, code: "initiative_name_required", message: "An initiative needs a name." } };
  const config = getConfig(deps);
  const patch = compact({
    name: input.name === undefined ? undefined : clean(input.name, 240),
    problem_statement: input.problem_statement === undefined && input.problemStatement === undefined ? undefined : nullable(input.problem_statement || input.problemStatement, 5000),
    target_audience: input.target_audience === undefined && input.targetAudience === undefined ? undefined : nullable(input.target_audience || input.targetAudience, 3000),
    value_proposition: input.value_proposition === undefined && input.valueProposition === undefined ? undefined : nullable(input.value_proposition || input.valueProposition, 3000),
    product_goal: input.product_goal === undefined && input.productGoal === undefined ? undefined : nullable(input.product_goal || input.productGoal, 3000),
    status: input.status === undefined ? undefined : oneOf(input.status, INITIATIVE_STATUSES, null),
    primary_metric: input.primary_metric === undefined && input.primaryMetric === undefined ? undefined : nullable(input.primary_metric || input.primaryMetric, 300),
    target_metric: input.target_metric === undefined && input.targetMetric === undefined ? undefined : numberOrNull(input.target_metric ?? input.targetMetric),
    budget_cents: input.budget_cents === undefined && input.budgetCents === undefined ? undefined : integerOrNull(input.budget_cents ?? input.budgetCents, 0),
    target_launch_date: input.target_launch_date === undefined && input.targetLaunchDate === undefined ? undefined : dateOnly(input.target_launch_date || input.targetLaunchDate),
    metadata: input.metadata === undefined ? undefined : parseObject(input.metadata, {}),
    updated_at: new Date().toISOString()
  });
  if (!Object.keys(patch).filter((key) => key !== "updated_at").length) return { status: 400, body: { ok: false, code: "initiative_patch_required" } };
  const updated = await patchRows(config, TABLES.initiatives, context, req.params.initiativeId, patch);
  if (!updated.ok) return { status: 502, body: { ok: false, code: updated.code } };
  // A PATCH that matched nothing answers 200 with an empty list. That is not a
  // saved change, and the page would otherwise say it was.
  if (!updated.rows.length) return { status: 404, body: { ok: false, code: "resource_not_found", message: "That initiative is not in your business, or it has been removed." } };
  await recordEvent(config, context, req.params.initiativeId, "initiative.updated", "success", { fields: Object.keys(patch) });
  return { status: 200, body: { ok: true, initiative: updated.rows[0] } };
}

// One function per record kind, each naming its own table, rather than a
// lookup keyed by the path: scripts/generate-capability-inventory.cjs traces
// what a route writes from the functions it calls, and a table read out of a
// map at runtime is a write it cannot see.
function changeIterationStatus(req, deps) {
  return changeChildStatus(req, deps, { table: TABLES.iterations, statuses: ITERATION_STATUSES, noun: "iteration", noteColumn: "review_notes", event: "iteration.status_changed" });
}

function changeFeedbackStatus(req, deps) {
  return changeChildStatus(req, deps, { table: TABLES.feedback, statuses: FEEDBACK_STATUSES, noun: "finding", noteColumn: null, event: "feedback.status_changed", closingNeedsNote: true });
}

async function changeChildStatus(req, deps, spec) {
  const base = await prepareChildWrite(req, deps);
  if (!base.ok) return { status: base.status, body: base };
  const recordId = String(req.params.recordId || "");
  if (!validUuid(recordId)) return { status: 400, body: { ok: false, code: "invalid_record_id" } };
  const status = oneOf(req.body.status, spec.statuses, null);
  if (!status) return { status: 400, body: { ok: false, code: "status_not_offered", message: `That is not a status a ${spec.noun} can have.` } };
  const note = nullable(req.body.note, 2000);
  if (spec.closingNeedsNote && CLOSED_FEEDBACK_STATUSES.has(status) && !note) {
    return { status: 400, body: { ok: false, code: "closing_note_required", message: "Say how this finding was dealt with. A closed finding no longer blocks a stage, so the reason is the record of why." } };
  }
  // Scoped by organization and by initiative, read first for the previous
  // value. The service key bypasses row level security, so without both
  // filters a guessed id could move another initiative's -- or another
  // business's -- record.
  const scope = `id=eq.${encodeURIComponent(recordId)}&initiative_id=eq.${encodeURIComponent(base.initiative.id)}&organization_id=eq.${encodeURIComponent(base.context.organizationId)}`;
  const found = await rest(base.config, spec.table, `select=id,status,metadata&${scope}&limit=1`);
  if (!found.ok) return { status: 502, body: { ok: false, code: "record_unreadable", message: `We could not read that ${spec.noun} just now. Nothing has changed.` } };
  const before = found.rows[0];
  if (!before) return { status: 404, body: { ok: false, code: "resource_not_found", message: `That ${spec.noun} is not on this initiative.` } };
  const patch = { status, updated_at: new Date().toISOString() };
  if (note && spec.noteColumn) patch[spec.noteColumn] = note;
  if (note && !spec.noteColumn) patch.metadata = { ...(before.metadata && typeof before.metadata === "object" ? before.metadata : {}), status_note: note };
  const updated = await rest(base.config, spec.table, scope, { method: "PATCH", prefer: "return=representation", body: patch });
  if (!updated.ok) return { status: 502, body: { ok: false, code: "status_not_saved", message: "That could not be saved, so the status is unchanged." } };
  if (!updated.rows.length) return { status: 404, body: { ok: false, code: "resource_not_found", message: `That ${spec.noun} is not on this initiative.` } };
  await recordEvent(base.config, base.context, base.initiative.id, spec.event, "success", { record_id: recordId, from: before.status, to: status, note });
  return { status: 200, body: { ok: true, record: updated.rows[0], from: before.status, to: status } };
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
  // A failed read is not an empty list. Graded as one, a feedback read that
  // failed made "no unresolved critical feedback" true -- the one criterion
  // that is also a blocker -- so a launch or a scale decision could pass its
  // gate on the strength of a request that did not happen. The gate is not
  // graded at all unless every record it grades was read.
  const unreadable = Object.entries({ evidence, requirements, iterations, feedback, reviews })
    .filter(([, result]) => !result.ok).map(([name]) => name);
  if (unreadable.length) {
    return {
      status: 502,
      body: {
        ok: false,
        code: "initiative_records_unreadable",
        unreadable,
        message: `This initiative's ${unreadable.join(", ")} could not be read just now, so its readiness is not graded and no stage decision can be recorded. Nothing has changed.`
      }
    };
  }
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
  // The outcome travels, not just the rows. A failed read rendered exactly like
  // a business with no initiatives -- the cards simply were not there.
  let initiatives = [];
  let readable = false;
  if (config.ok) {
    const result = await list(config, TABLES.initiatives, context, 100, `&studio_key=eq.${encodeURIComponent(studioKey)}`);
    readable = result.ok;
    initiatives = result.ok ? result.rows : [];
  }
  const sections = [
    ui.card("Evidence before expansion", "Do not build because an idea sounds exciting. Record the problem, audience, market evidence, alternatives, pricing evidence, assumptions, and decision rationale."),
    ui.card("MVP means hypothesis test", "Scope only the smallest coherent experience that tests the riskiest assumptions. Record non-goals and Won't Have items to prevent feature creep."),
    ui.card("Definition of Done", "Every increment includes tests, security, accessibility, privacy, operational ownership, support impact, and traces, metrics, and logs where applicable."),
    ui.card("Moving to the next stage", "Move on only when the evidence for this stage is in and nothing critical is still open. The choices are advance, hold, pivot, stop, or scale."),
    initiativeForm(studioKey, ui.escape),
    ...(!readable
      ? [ui.card("Your initiatives", "We could not read your initiatives just now, so none are listed here. Nothing has changed.")]
      : initiatives.length
        ? initiatives.map((initiative) => initiativeCard(initiative, ui))
        : [ui.card("Your initiatives", "None yet. Start one above.")])
  ];
  return res.status(200).type("html").send(ui.layout({
    title: `${studioLabel(studioKey)} Roadmap`,
    eyebrow: "SONARA Roadmap",
    heading: `${studioLabel(studioKey)} discovery, MVP, beta, launch, and learning`,
    body: "Turn ideas into evidence-backed products through one tenant-scoped operating model shared across SONARA Industries, Business Builder, Creator Studio, and Growth Studio.",
    sections,
    // The framework and the initiatives are both rendered as cards on this
    // page, so linking a customer at the raw data said the page was not enough.
    actions: [ui.link("/product-lifecycle", "All initiatives"), ui.link("/dashboard", "Command center")]
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
  return `<article class="card"><h2>Start something new</h2><form method="post" action="/product-lifecycle/initiatives"><input type="hidden" name="studio_key" value="${escape(studioKey)}"><label>Name<input name="name" required maxlength="240"></label><label>Problem statement<textarea name="problem_statement" required></textarea></label><label>Target audience<textarea name="target_audience" required></textarea></label><label>Initial value proposition<textarea name="value_proposition"></textarea></label><label>Product Goal<textarea name="product_goal"></textarea></label><label>Primary metric<input name="primary_metric"></label><button type="submit">Create initiative</button></form></article>`;
}

function evidenceForm(id, escape) {
  return `<article class="card"><h2>Add evidence</h2><form method="post" action="/product-lifecycle/initiatives/${escape(id)}/evidence"><label>Type<select name="evidence_type">${[...EVIDENCE_TYPES].map((value) => `<option value="${value}">${value.replaceAll("_", " ")}</option>`).join("")}</select></label><label>Source<input name="source" required></label><label>Summary<textarea name="summary" required></textarea></label><label>Confidence<select name="confidence"><option>unknown</option><option>low</option><option>medium</option><option>high</option><option>verified</option></select></label><label>Participant count<input type="number" min="0" name="participant_count"></label><button type="submit">Record evidence</button></form></article>`;
}

function requirementForm(id, escape) {
  return `<article class="card"><h2>Add scope or operating requirement</h2><form method="post" action="/product-lifecycle/initiatives/${escape(id)}/requirements"><label>Type<select name="requirement_type">${[...REQUIREMENT_TYPES].map((value) => `<option value="${value}">${value.replaceAll("_", " ")}</option>`).join("")}</select></label><label>Title<input name="title" required></label><label>Detail<textarea name="detail"></textarea></label><label>Priority<select name="priority"><option value="must">Must Have</option><option value="should">Should Have</option><option value="could">Could Have</option><option value="wont">Won't Have</option></select></label><label>Acceptance criteria<textarea name="acceptance_criteria"></textarea></label><button type="submit">Add requirement</button></form></article>`;
}

function feedbackForm(id, escape) {
  return `<article class="card"><h2>Record beta or customer feedback</h2><form method="post" action="/product-lifecycle/initiatives/${escape(id)}/feedback"><label>Category<select name="category">${[...FEEDBACK_CATEGORIES].map((value) => `<option value="${value}">${value}</option>`).join("")}</select></label><label>Severity<select name="severity"><option>low</option><option selected>medium</option><option>high</option><option>critical</option></select></label><label>Summary<textarea name="summary" required></textarea></label><label>Beta cohort<input name="beta_cohort"></label><button type="submit">Record feedback</button></form></article>`;
}

// The fields the gates read, editable after the initiative exists. The create
// form asks for a primary metric and no target, and the plan stage needs both,
// so until this form existed the plan gate could not be passed from the page.
function initiativeEditForm(initiative, escape) {
  const id = escape(initiative.id);
  const value = (field) => escape(initiative[field] === null || initiative[field] === undefined ? "" : String(initiative[field]));
  return `<article class="card"><h2>Problem, goal and target</h2><form method="post" action="/product-lifecycle/initiatives/${id}"><label>Name<input name="name" required maxlength="240" value="${value("name")}"></label><label>Problem statement<textarea name="problem_statement" maxlength="5000">${value("problem_statement")}</textarea></label><label>Target audience<textarea name="target_audience" maxlength="3000">${value("target_audience")}</textarea></label><label>Value proposition<textarea name="value_proposition" maxlength="3000">${value("value_proposition")}</textarea></label><label>Product Goal<textarea name="product_goal" maxlength="3000">${value("product_goal")}</textarea></label><label>Primary metric<input name="primary_metric" maxlength="300" value="${value("primary_metric")}"></label><label>Target for that metric<input type="number" step="any" name="target_metric" value="${value("target_metric")}"></label><label>Target launch date<input type="date" name="target_launch_date" value="${value("target_launch_date")}"></label><button type="submit">Save changes</button></form></article>`;
}

function iterationForm(id, iterations, escape) {
  const next = iterations.reduce((highest, row) => Math.max(highest, Number(row.iteration_number) || 0), 0) + 1;
  return `<article class="card"><h2>Plan an iteration</h2><form method="post" action="/product-lifecycle/initiatives/${escape(id)}/iterations"><label>Number<input type="number" name="iteration_number" min="1" step="1" value="${next}" required></label><label>Goal<textarea name="goal" required maxlength="3000"></textarea></label><label>Status<select name="status">${[...ITERATION_STATUSES].map((value) => `<option value="${value}">${value}</option>`).join("")}</select></label><label>Starts<input type="date" name="starts_at"></label><label>Ends<input type="date" name="ends_at"></label><label>Definition of Done<textarea name="definition_of_done" maxlength="5000"></textarea></label><button type="submit">Add iteration</button></form></article>`;
}

function iterationsCard(id, iterations, escape) {
  const rows = [...iterations].sort((a, b) => (Number(a.iteration_number) || 0) - (Number(b.iteration_number) || 0));
  if (!rows.length) return `<article class="card"><h2>Iterations</h2><p>None yet. Plan the first one below.</p></article>`;
  const body = rows.map((row) => `<tr><td>${escape(String(row.iteration_number))}</td><td>${escape(row.goal || "")}</td><td>${escape(row.status || "")}</td><td>${row.definition_of_done ? "Written" : "Not written"}</td><td><form method="post" action="/product-lifecycle/initiatives/${escape(id)}/iterations/${escape(row.id)}/status"><label>Move to<select name="status">${[...ITERATION_STATUSES].map((value) => `<option value="${value}"${value === row.status ? " selected" : ""}>${value}</option>`).join("")}</select></label><label>Review note<input name="note" maxlength="2000"></label><button type="submit">Save</button></form></td></tr>`).join("");
  return `<article class="card"><h2>Iterations</h2><table><thead><tr><th>Number</th><th>Goal</th><th>Status</th><th>Definition of Done</th><th>Change</th></tr></thead><tbody>${body}</tbody></table></article>`;
}

function feedbackCard(id, feedback, escape) {
  const open = feedback.filter((row) => row.severity === "critical" && !CLOSED_FEEDBACK_STATUSES.has(row.status)).length;
  if (!feedback.length) return `<article class="card"><h2>Beta feedback</h2><p>No findings recorded yet.</p></article>`;
  const body = feedback.map((row) => `<tr><td>${escape(row.category || "")}</td><td>${escape(row.severity || "")}</td><td>${escape(row.summary || "")}</td><td>${escape(row.status || "")}</td><td><form method="post" action="/product-lifecycle/initiatives/${escape(id)}/feedback/${escape(row.id)}/status"><label>Move to<select name="status">${[...FEEDBACK_STATUSES].map((value) => `<option value="${value}"${value === row.status ? " selected" : ""}>${value}</option>`).join("")}</select></label><label>How it was dealt with<input name="note" maxlength="2000"></label><button type="submit">Save</button></form></td></tr>`).join("");
  return `<article class="card"><h2>Beta feedback</h2><p>${feedback.length} findings; ${open} unresolved critical. Closing a finding (resolved, declined or duplicate) needs a note saying how it was dealt with.</p><table><thead><tr><th>Category</th><th>Severity</th><th>Finding</th><th>Status</th><th>Change</th></tr></thead><tbody>${body}</tbody></table></article>`;
}

// The stage is deliberately NOT a field here. `addStageReview` records
// `bundle.body.initiative.lifecycle_stage` -- the stage the initiative is
// actually in, read back from the database -- rather than whatever the form
// says it was. This page posts to an endpoint reachable by anybody who can
// reach the page, so a stage carried in the request is a stage the requester
// chooses, and the readiness gate above it is graded against that stage.
//
// A hidden `stage` input sat here until 3 September 2026, submitted on every
// review and ignored on every one. Harmless as it stood, and misleading: it
// reads as though the stage travels with the review, which is the premise
// somebody would act on when "fixing" the handler to use it.
function reviewForm(id, score, escape) {
  return `<article class="card"><h2>Stage review</h2><p>Current readiness score: ${escape(String(score))}/100. Advance and scale decisions require at least 70 with no critical blocker.</p><form method="post" action="/product-lifecycle/initiatives/${escape(id)}/reviews"><label>Decision<select name="decision"><option>hold</option><option>advance</option><option>pivot</option><option>stop</option><option>scale</option></select></label><label>Rationale<textarea name="rationale" required></textarea></label><label><input type="checkbox" name="approved" value="true"> Owner approval attested</label><button type="submit">Record review</button></form></article>`;
}

function initiativeCard(initiative, ui) {
  return `<article class="card"><h2>${ui.escape(initiative.name)}</h2><p>${ui.escape(stageLabel(initiative.lifecycle_stage))} · ${ui.escape(String(initiative.status).replaceAll("_", " "))}</p><p>${ui.escape(initiative.product_goal || initiative.problem_statement || "Evidence and Product Goal required.")}</p><div class="card-actions">${ui.link(`/product-lifecycle/initiatives/${initiative.id}`, "Open initiative")}</div></article>`;
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

module.exports.EDITABLE_FIELDS = EDITABLE_FIELDS;
module.exports.DECISION_STATUSES = DECISION_STATUSES;

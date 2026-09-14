"use strict";

// Declarative automation planning shared by Business Builder and Creator Studio.
// This does not execute arbitrary code. A workflow is a named trigger plus an
// allowlisted sequence of actions. Anything that can publish, message a customer,
// mutate money, call an external endpoint, or start paid generation is explicitly
// approval-gated.

const TRIGGERS = Object.freeze(new Set([
  "booking_requested", "booking_confirmed", "booking_cancelled", "waitlist_opening",
  "shift_started", "shift_ended", "inventory_low", "route_completed",
  "lead_created", "lead_qualified", "form_submitted", "campaign_started",
  "conversion_recorded", "consent_granted", "content_ready", "manual",
  "music_project_ready", "audio_asset_ready", "video_treatment_ready", "release_due"
]));

const ACTION_POLICY = Object.freeze({
  create_task: "safe_automatic",
  notify_owner: "safe_automatic",
  add_to_segment: "safe_automatic",
  record_metric: "safe_automatic",
  build_export_plan: "safe_automatic",
  prepare_booking_offer: "safe_automatic",
  prepare_media_job: "safe_automatic",
  enqueue_email: "approval_required",
  notify_customer: "approval_required",
  send_webhook: "approval_required",
  sync_provider: "approval_required",
  publish_content: "approval_required",
  start_generation_job: "approval_required",
  mutate_booking: "approval_required",
  charge_payment: "approval_required",
  change_budget: "approval_required"
});

const AUTONOMY_ORDER = Object.freeze({ manual: 0, safe_automatic: 1, approval_required: 2 });
const MAX_STEPS = 20;

function clean(value, max = 200) {
  return String(value ?? "").trim().slice(0, max);
}

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function stepFrom(value, index) {
  const source = object(value);
  const action = clean(source.action || source.action_key || source.type, 80);
  if (!action || !Object.prototype.hasOwnProperty.call(ACTION_POLICY, action)) {
    return { ok: false, code: "unsupported_action", index, action: action || null };
  }
  return {
    ok: true,
    step: {
      action,
      config: object(source.config),
      approval: ACTION_POLICY[action]
    }
  };
}

function strongestAutonomy(steps = []) {
  let strongest = "manual";
  for (const step of steps) {
    if ((AUTONOMY_ORDER[step.approval] ?? 0) > (AUTONOMY_ORDER[strongest] ?? 0)) strongest = step.approval;
  }
  return strongest;
}

function validateWorkflow(input = {}) {
  const name = clean(input.name, 160);
  const trigger = clean(input.trigger || input.trigger_key, 80);
  const rawSteps = Array.isArray(input.steps) ? input.steps : Array.isArray(input.action_steps) ? input.action_steps : [];
  const requestedAutonomy = clean(input.autonomy || input.autonomy_level || "manual", 40);

  if (!name) return { ok: false, code: "workflow_name_required" };
  if (!TRIGGERS.has(trigger)) return { ok: false, code: "unsupported_trigger", trigger };
  if (!rawSteps.length) return { ok: false, code: "workflow_steps_required" };
  if (rawSteps.length > MAX_STEPS) return { ok: false, code: "too_many_workflow_steps", max: MAX_STEPS };
  if (!Object.prototype.hasOwnProperty.call(AUTONOMY_ORDER, requestedAutonomy)) {
    return { ok: false, code: "invalid_autonomy_level" };
  }

  const steps = [];
  for (let index = 0; index < rawSteps.length; index += 1) {
    const parsed = stepFrom(rawSteps[index], index);
    if (!parsed.ok) return parsed;
    steps.push(parsed.step);
  }

  const requiredAutonomy = strongestAutonomy(steps);
  const requestedRank = AUTONOMY_ORDER[requestedAutonomy];
  const requiredRank = AUTONOMY_ORDER[requiredAutonomy];
  const effectiveAutonomy = requestedRank < requiredRank ? requiredAutonomy : requestedAutonomy;

  return {
    ok: true,
    workflow: {
      name,
      trigger,
      triggerConfig: object(input.trigger_config || input.triggerConfig),
      steps,
      requestedAutonomy,
      effectiveAutonomy,
      approvalRequired: effectiveAutonomy === "approval_required",
      arbitraryCodeAllowed: false
    }
  };
}

function templates() {
  return [
    {
      key: "waitlist-opening",
      product: "business_builder",
      name: "Fill an opening from the waitlist",
      trigger: "waitlist_opening",
      autonomy: "approval_required",
      steps: [
        { action: "prepare_booking_offer", config: {} },
        { action: "notify_owner", config: {} },
        { action: "notify_customer", config: {} }
      ]
    },
    {
      key: "low-stock-owner-task",
      product: "business_builder",
      name: "Create a task when stock is low",
      trigger: "inventory_low",
      autonomy: "safe_automatic",
      steps: [
        { action: "create_task", config: {} },
        { action: "notify_owner", config: {} }
      ]
    },
    {
      key: "music-project-production-plan",
      product: "creator_studio",
      name: "Prepare a music production workflow",
      trigger: "music_project_ready",
      autonomy: "safe_automatic",
      steps: [
        { action: "prepare_media_job", config: { medium: "audio" } },
        { action: "build_export_plan", config: {} }
      ]
    },
    {
      key: "video-treatment-production-plan",
      product: "creator_studio",
      name: "Prepare a video production workflow",
      trigger: "video_treatment_ready",
      autonomy: "safe_automatic",
      steps: [
        { action: "prepare_media_job", config: { medium: "video" } },
        { action: "build_export_plan", config: {} }
      ]
    },
    {
      key: "approved-media-generation",
      product: "creator_studio",
      name: "Start an approved creator generation job",
      trigger: "content_ready",
      autonomy: "approval_required",
      steps: [
        { action: "prepare_media_job", config: {} },
        { action: "start_generation_job", config: {} }
      ]
    }
  ].map((template) => {
    const validated = validateWorkflow(template);
    return { ...template, valid: validated.ok, approvalRequired: validated.ok ? validated.workflow.approvalRequired : true };
  });
}

module.exports = { ACTION_POLICY, MAX_STEPS, TRIGGERS, templates, validateWorkflow };

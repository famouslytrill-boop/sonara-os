// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
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

// Industry coverage shares the same allowlisted planner as the core templates.
// These are inspectable plans, not live connectors, stored workflows, payouts,
// dispatches, compliance verdicts, or permission to contact customers.
// Review requiredRecords and actual provider/tenant state before activation.
const INDUSTRY_PACKS = Object.freeze([
  {
    key: "restaurant-availability-task", industry: "restaurant", product: "business_builder",
    name: "Review restaurant ingredient availability", trigger: "inventory_low", autonomy: "safe_automatic",
    launchState: "template_only", requiredRecords: ["inventory quantities","reorder thresholds"],
    disclosure: "A task and owner notice; no menu or stock changes",
    steps: [{ action: "create_task", config: {} }, { action: "notify_owner", config: {} }]
  },
  {
    key: "food-truck-closeout-plan", industry: "food_truck", product: "business_builder",
    name: "Prepare a food-truck shift closeout", trigger: "route_completed", autonomy: "safe_automatic",
    launchState: "template_only", requiredRecords: ["completed route","shift data"],
    disclosure: "A report plan only; no GPS collection or settlement",
    steps: [{ action: "record_metric", config: {} }, { action: "build_export_plan", config: {} }]
  },
  {
    key: "trade-job-handoff", industry: "trades", product: "business_builder",
    name: "Prepare a trades job handoff", trigger: "booking_confirmed", autonomy: "safe_automatic",
    launchState: "template_only", requiredRecords: ["confirmed booking","assigned team"],
    disclosure: "Creates a proposed job task; never dispatches a worker",
    steps: [{ action: "create_task", config: {} }, { action: "notify_owner", config: {} }]
  },
  {
    key: "trucking-delivery-review", industry: "trucking", product: "business_builder",
    name: "Review completed fleet deliveries", trigger: "route_completed", autonomy: "safe_automatic",
    launchState: "template_only", requiredRecords: ["completed route","consented tracking proof"],
    disclosure: "A summary plan, not a regulated driver-hours determination",
    steps: [{ action: "record_metric", config: {} }, { action: "build_export_plan", config: {} }]
  },
  {
    key: "cleaning-shift-review", industry: "cleaning", product: "business_builder",
    name: "Prepare a cleaning shift quality review", trigger: "shift_ended", autonomy: "safe_automatic",
    launchState: "template_only", requiredRecords: ["completed shift","site checklist"],
    disclosure: "A team review task without automatically publishing ratings",
    steps: [{ action: "create_task", config: {} }, { action: "notify_owner", config: {} }]
  },
  {
    key: "retail-reorder-review", industry: "retail", product: "business_builder",
    name: "Review retail stock replenishment", trigger: "inventory_low", autonomy: "safe_automatic",
    launchState: "template_only", requiredRecords: ["inventory quantities","reorder thresholds"],
    disclosure: "A task, not an automatic purchase order",
    steps: [{ action: "create_task", config: {} }, { action: "notify_owner", config: {} }]
  },
  {
    key: "rental-request-offer", industry: "rentals", product: "business_builder",
    name: "Prepare an equipment rental offer", trigger: "booking_requested", autonomy: "approval_required",
    launchState: "template_only", requiredRecords: ["inventory availability","requested period","customer contact consent"],
    disclosure: "Requires owner approval before contacting the renter",
    steps: [{ action: "prepare_booking_offer", config: {} }, { action: "notify_customer", config: {} }]
  },
  {
    key: "venue-waitlist-offer", industry: "venues", product: "business_builder",
    name: "Prepare a venue opening offer", trigger: "waitlist_opening", autonomy: "approval_required",
    launchState: "template_only", requiredRecords: ["capacity","waiting customer consent"],
    disclosure: "Requires owner approval and a live availability check",
    steps: [{ action: "prepare_booking_offer", config: {} }, { action: "notify_customer", config: {} }]
  },
  {
    key: "manufacturing-stock-alert", industry: "manufacturing", product: "business_builder",
    name: "Review a production material shortage", trigger: "inventory_low", autonomy: "safe_automatic",
    launchState: "template_only", requiredRecords: ["bill of materials","available inventory"],
    disclosure: "Flags a work item; does not change machinery or production",
    steps: [{ action: "create_task", config: {} }, { action: "notify_owner", config: {} }]
  },
  {
    key: "real-estate-lead-follow-up", industry: "real_estate", product: "business_builder",
    name: "Draft a property lead follow-up", trigger: "lead_qualified", autonomy: "approval_required",
    launchState: "template_only", requiredRecords: ["lead consent","property record"],
    disclosure: "Owner approval before any message; no screening decision",
    steps: [{ action: "create_task", config: {} }, { action: "enqueue_email", config: {} }]
  },
  {
    key: "professional-service-intake", industry: "professional_services", product: "business_builder",
    name: "Prepare a professional-service intake", trigger: "form_submitted", autonomy: "safe_automatic",
    launchState: "template_only", requiredRecords: ["intake record","consent"],
    disclosure: "A task only; not legal, tax or medical advice",
    steps: [{ action: "create_task", config: {} }, { action: "notify_owner", config: {} }]
  },
  {
    key: "last-mile-delivery-proof", industry: "delivery", product: "business_builder",
    name: "Prepare a delivery completion record", trigger: "route_completed", autonomy: "approval_required",
    launchState: "template_only", requiredRecords: ["consented delivery evidence","customer contact consent"],
    disclosure: "Owner approval before external contact or evidence sharing",
    steps: [{ action: "build_export_plan", config: {} }, { action: "notify_customer", config: {} }]
  },
  {
    key: "salon-booking-offer", industry: "salon", product: "business_builder",
    name: "Prepare a salon appointment offer", trigger: "booking_requested", autonomy: "approval_required",
    launchState: "template_only", requiredRecords: ["staff availability","service duration","customer contact consent"],
    disclosure: "Owner approval before contacting a customer",
    steps: [{ action: "prepare_booking_offer", config: {} }, { action: "notify_customer", config: {} }]
  },
  {
    key: "store-purchase-summary", industry: "ecommerce", product: "business_builder",
    name: "Review a completed online-store purchase", trigger: "conversion_recorded", autonomy: "safe_automatic",
    launchState: "template_only", requiredRecords: ["verified payment evidence","order record"],
    disclosure: "No fulfillment, refund or payment mutation",
    steps: [{ action: "record_metric", config: {} }, { action: "notify_owner", config: {} }]
  },
  {
    key: "nonprofit-intake-review", industry: "nonprofit", product: "business_builder",
    name: "Review a community program intake", trigger: "form_submitted", autonomy: "safe_automatic",
    launchState: "template_only", requiredRecords: ["consented intake"],
    disclosure: "No applicant eligibility decision",
    steps: [{ action: "create_task", config: {} }, { action: "notify_owner", config: {} }]
  },
  {
    key: "construction-estimate-review", industry: "construction", product: "business_builder",
    name: "Prepare a construction estimate review", trigger: "lead_created", autonomy: "safe_automatic",
    launchState: "template_only", requiredRecords: ["lead record","scope summary"],
    disclosure: "No quote, contract or binding price sent",
    steps: [{ action: "create_task", config: {} }, { action: "notify_owner", config: {} }]
  },
  {
    key: "facility-maintenance-request", industry: "facilities", product: "business_builder",
    name: "Prepare a maintenance response", trigger: "form_submitted", autonomy: "safe_automatic",
    launchState: "template_only", requiredRecords: ["site request","access permissions"],
    disclosure: "No key or door access granted",
    steps: [{ action: "create_task", config: {} }, { action: "notify_owner", config: {} }]
  }
].map((item) => Object.freeze(item)));

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
  ].concat(INDUSTRY_PACKS).map((template) => {
    const validated = validateWorkflow(template);
    return { ...template, valid: validated.ok, approvalRequired: validated.ok ? validated.workflow.approvalRequired : true };
  });
}

module.exports = { ACTION_POLICY, INDUSTRY_PACKS, MAX_STEPS, TRIGGERS, templates, validateWorkflow };

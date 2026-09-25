// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// The product analytics dictionary for SONARA's existing public.activity_events
// table. This deliberately does not create a second analytics store.
//
// An event may be useful operationally without being eligible for a product
// metric. Only events declared below can count toward activation, first value,
// or paid conversion. That keeps a new log line from silently becoming a
// marketing claim.
//
// Event data is intentionally narrow. activity_events is member-readable through
// tenant RLS, so it is not a place for email addresses, phone numbers, secrets,
// raw prompts, customer-entered descriptions, payment card data, or provider
// payloads.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVENT_TYPE_RE = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/;
const SAFE_TOKEN_RE = /^[a-z0-9][a-z0-9_.:-]{0,119}$/i;
const EXTERNAL_ID_RE = /^[a-z0-9][a-z0-9_-]{0,199}$/i;
const SENSITIVE_KEY_RE = /(?:^|_)(?:password|passcode|token|secret|authorization|cookie|session|email|phone|address|card|pan|cvv|cvc|service_role|api_key|private_key)(?:_|$)/i;

const PRODUCT_PATHS = Object.freeze(["business-builder", "creator-studio", "growth-studio", "dashboard"]);

function field(kind, options = {}) {
  return Object.freeze({ kind, ...options });
}

const EVENT_DEFINITIONS = Object.freeze({
  "account.organization_created": Object.freeze({
    productArea: "sonara_one",
    milestone: "workspace_activation",
    metricEligible: true,
    firstValue: false,
    fields: Object.freeze({
      product_path: field("enum", { values: PRODUCT_PATHS })
    })
  }),
  "business_builder.intake_created": Object.freeze({
    productArea: "business_builder",
    milestone: "workflow_started",
    metricEligible: true,
    firstValue: false,
    fields: Object.freeze({
      intake_request_id: field("uuid")
    })
  }),
  "business_builder.checklist_created": Object.freeze({
    productArea: "business_builder",
    milestone: "engagement",
    metricEligible: false,
    firstValue: false,
    fields: Object.freeze({ checklist_item_id: field("uuid") })
  }),
  "business_builder.checklist_updated": Object.freeze({
    productArea: "business_builder",
    milestone: "engagement",
    metricEligible: false,
    firstValue: false,
    fields: Object.freeze({ checklist_item_id: field("uuid") })
  }),
  "business_builder.checklist_deleted": Object.freeze({
    productArea: "business_builder",
    milestone: "engagement",
    metricEligible: false,
    firstValue: false,
    fields: Object.freeze({ checklist_item_id: field("uuid") })
  }),
  "billing.purchase_completed": Object.freeze({
    productArea: "sonara_one",
    milestone: "paid_conversion",
    metricEligible: true,
    firstValue: false,
    fields: Object.freeze({
      plan: field("token"),
      checkout_session_id: field("external_id")
    })
  }),
  "service_request.submitted": Object.freeze({
    productArea: "sonara_one",
    milestone: "workflow_started",
    metricEligible: true,
    firstValue: false,
    fields: Object.freeze({
      service_request_id: field("uuid"),
      product_key: field("token")
    })
  }),
  "sonara.formula_result_saved": Object.freeze({
    productArea: "sonara_one",
    milestone: "workflow_completed",
    metricEligible: true,
    firstValue: false,
    fields: Object.freeze({
      formula_key: field("token"),
      formula_result_id: field("uuid")
    })
  }),
  "sonara.prompt_template_created": Object.freeze({
    productArea: "sonara_one",
    milestone: "workflow_completed",
    metricEligible: true,
    firstValue: false,
    fields: Object.freeze({
      prompt_template_id: field("uuid"),
      product_area: field("token")
    })
  }),
  "sonara.prompt_template_version_created": Object.freeze({
    productArea: "sonara_one",
    milestone: "workflow_completed",
    metricEligible: true,
    firstValue: false,
    fields: Object.freeze({
      prompt_template_id: field("uuid")
    })
  }),
  "creator_studio.output_downloaded": Object.freeze({
    productArea: "creator_studio",
    milestone: "first_value",
    metricEligible: true,
    firstValue: true,
    fields: Object.freeze({
      job_id: field("uuid"),
      asset_id: field("uuid"),
      media_type: field("token"),
      provider_key: field("token")
    })
  }),
  "growth_studio.campaign_created": Object.freeze({
    productArea: "growth_studio",
    milestone: "workflow_started",
    metricEligible: true,
    firstValue: false,
    fields: Object.freeze({
      campaign_id: field("uuid"),
      channel: field("token")
    })
  }),
  "growth_studio.campaign_sent": Object.freeze({
    productArea: "growth_studio",
    milestone: "workflow_completed",
    metricEligible: true,
    firstValue: false,
    fields: Object.freeze({
      campaign_id: field("uuid"),
      sent: field("count"),
      failed: field("count"),
      skipped: field("count")
    })
  }),
  "growth_studio.conversion_recorded": Object.freeze({
    productArea: "growth_studio",
    milestone: "first_value",
    metricEligible: true,
    firstValue: true,
    fields: Object.freeze({
      conversion_id: field("uuid"),
      conversion_type: field("token"),
      attribution_model: field("token"),
      attribution_confidence: field("enum", { values: ["unknown", "low", "medium", "high", "provider_reported"] })
    })
  })
});

function cleanToken(value, pattern = SAFE_TOKEN_RE) {
  if (value === null || value === undefined || value === "") return null;
  const cleaned = String(value).trim();
  return pattern.test(cleaned) ? cleaned : null;
}

function cleanField(spec, value) {
  if (value === null || value === undefined || value === "") return null;
  if (spec.kind === "uuid") {
    const cleaned = String(value).trim();
    return UUID_RE.test(cleaned) ? cleaned.toLowerCase() : null;
  }
  if (spec.kind === "token") return cleanToken(value);
  if (spec.kind === "external_id") return cleanToken(value, EXTERNAL_ID_RE);
  if (spec.kind === "enum") {
    const cleaned = String(value).trim().toLowerCase();
    return spec.values.includes(cleaned) ? cleaned : null;
  }
  if (spec.kind === "count") {
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= 0 && number <= 1_000_000_000 ? number : null;
  }
  return null;
}

function containsSensitiveKey(value, depth = 0) {
  if (!value || typeof value !== "object" || depth > 4) return false;
  for (const [key, nested] of Object.entries(value)) {
    if (SENSITIVE_KEY_RE.test(String(key))) return true;
    if (nested && typeof nested === "object" && containsSensitiveKey(nested, depth + 1)) return true;
  }
  return false;
}

function productAreaForUnknown(eventType) {
  if (eventType.startsWith("business_builder.")) return "business_builder";
  if (eventType.startsWith("creator_studio.")) return "creator_studio";
  if (eventType.startsWith("growth_studio.")) return "growth_studio";
  return "sonara_one";
}

function normalizeActivityEvent(eventType, input = {}) {
  const type = String(eventType || "").trim().toLowerCase();
  if (!EVENT_TYPE_RE.test(type)) return { ok: false, code: "invalid_activity_event_type" };
  if (containsSensitiveKey(input)) return { ok: false, code: "sensitive_activity_metadata" };

  const definition = EVENT_DEFINITIONS[type];
  if (!definition) {
    return {
      ok: true,
      eventType: type,
      // Unknown event names have no field schema, so keep the event useful for
      // aggregate operational counting without persisting arbitrary caller data.
      // Future metrics require an explicit event definition and field allowlist.
      eventData: {
        measurement: {
          schema_version: 1,
          product_area: productAreaForUnknown(type),
          milestone: "operational",
          metric_eligible: false,
          first_value: false
        }
      },
      definition: null
    };
  }

  const eventData = {};
  for (const [key, spec] of Object.entries(definition.fields)) {
    const cleaned = cleanField(spec, input?.[key]);
    if (cleaned !== null) eventData[key] = cleaned;
  }
  eventData.measurement = {
    schema_version: 1,
    product_area: definition.productArea,
    milestone: definition.milestone,
    metric_eligible: definition.metricEligible,
    first_value: definition.firstValue
  };

  return { ok: true, eventType: type, eventData, definition };
}

function activityEventDefinition(eventType) {
  return EVENT_DEFINITIONS[String(eventType || "").trim().toLowerCase()] || null;
}

function metricEventTypes() {
  return Object.freeze(Object.entries(EVENT_DEFINITIONS)
    .filter(([, definition]) => definition.metricEligible)
    .map(([eventType]) => eventType));
}

module.exports = {
  EVENT_DEFINITIONS,
  PRODUCT_PATHS,
  normalizeActivityEvent,
  activityEventDefinition,
  metricEventTypes,
  containsSensitiveKey
};

// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Data-model decisions for the September 2026 expansion work.
//
// This file is intentionally not a migration. It answers the question that must
// come before a migration in this repository: can the lifecycle be represented
// honestly by an existing table/projection, or is a new durable record type
// actually required? `planned_new_table` means a later migration may create the
// table only after the relevant runtime/UI contract is implemented and tested.

const SCHEMA_PLAN = Object.freeze([
  contract({
    domain: "workflow",
    concept: "workflow definitions and versions",
    decision: "extend_or_normalize_existing_first",
    existing: ["automation_rules", "entity_automations", "entity_automation_runs", "workflow_runs"],
    candidate: ["workflow_definitions", "workflow_versions", "workflow_steps", "workflow_step_runs"],
    requiredFields: ["organization_id", "name", "version", "status", "trigger_type", "definition_digest", "created_by", "created_at"],
    gate: "Do not create a second automation model until existing entity_automations/automation_rules ownership and migration path are documented."
  }),
  contract({
    domain: "media_design",
    concept: "editable experience document",
    decision: "extend_or_normalize_existing_first",
    existing: ["scroll_sites", "business_sub_apps", "business_sub_app_pages", "creator_assets", "generation_artifacts"],
    candidate: ["experience_projects", "experience_documents", "experience_document_versions", "experience_components"],
    requiredFields: ["organization_id", "project_id", "document_type", "title", "status", "schema_version", "document_digest", "created_by", "created_at"],
    gate: "Create shared experience tables only if scroll-site and sub-app page shapes cannot represent the cross-product document lifecycle without overloaded columns."
  }),
  contract({
    domain: "creator_community",
    concept: "private creator/community spaces and live review rooms",
    decision: "extend_existing_first",
    existing: ["creator_artist_profiles", "creator_follows", "creator_assets", "call_sessions", "call_signals", "user_notifications", "merchant_products"],
    candidate: ["creator_spaces", "creator_space_memberships", "creator_space_posts", "creator_space_comments", "creator_space_moderation_events"],
    requiredFields: ["organization_id", "space_id", "actor_ref", "visibility", "status", "rights_or_consent_ref", "created_at", "updated_at"],
    gate: "Private spaces come first. Do not create a public feed or federation path until reporting, blocking, moderation, appeals, takedown, retention/deletion, rate limits, and abuse operations are implemented and tested."
  }),
  contract({
    domain: "field_offline",
    concept: "offline mutation queue",
    decision: "planned_new_table",
    existing: [],
    candidate: ["offline_action_queue"],
    requiredFields: ["organization_id", "device_ref", "entity_type", "entity_id", "operation", "idempotency_key", "expected_version", "payload_digest", "status", "retry_count", "last_error_code", "server_result_ref", "created_at", "updated_at"],
    gate: "Requires client-side encrypted/minimized persistence, conflict handling, idempotency, server authorization, and explicit prohibition on raw secrets/payment authentication data."
  }),
  contract({
    domain: "physical_digital",
    concept: "typed QR resource",
    decision: "planned_new_table",
    existing: ["shared_links", "public_booking_pages"],
    candidate: ["qr_resources", "qr_scan_events"],
    requiredFields: ["organization_id", "target_type", "target_id", "public_token", "status", "expires_at", "approved_by", "created_at"],
    gate: "Public activation must use allowlisted SONARA target types/paths; never become an arbitrary open redirect."
  }),
  contract({
    domain: "visibility_reputation",
    concept: "local/AI visibility snapshots",
    decision: "planned_new_table_if_provider_history_is_needed",
    existing: ["market_intelligence_signals", "market_intelligence_competitors", "market_intelligence_opportunities", "reviews", "business_locations"],
    candidate: ["visibility_sources", "visibility_snapshots", "listing_snapshots"],
    requiredFields: ["organization_id", "location_id", "source_key", "captured_at", "status", "evidence_ref", "metrics"],
    gate: "Reuse market-intelligence signals for recommendations; add snapshot tables only for normalized time-series/provider evidence."
  }),
  contract({
    domain: "communications",
    concept: "unified conversation inbox",
    decision: "projection_preferred",
    existing: ["lead_conversations", "call_sessions", "contact_records", "user_notifications"],
    candidate: ["conversation_projection_view", "conversation_assignments"],
    requiredFields: ["organization_id", "customer_ref", "channel", "source_record_ref", "occurred_at", "direction", "status"],
    gate: "Do not copy full email/SMS/call bodies into a second canonical store merely to render one inbox."
  }),
  contract({
    domain: "voice",
    concept: "voice receptionist configuration",
    decision: "extend_existing_first",
    existing: ["call_sessions", "phone_number_records", "communication_preferences", "creator_voice_consents"],
    candidate: ["business_voice_profiles", "voice_intent_policies"],
    requiredFields: ["organization_id", "phone_number_ref", "status", "allowed_intents", "knowledge_scope", "transfer_policy", "recording_policy", "created_at", "updated_at"],
    gate: "No provider-independent 'ready' state: telephony, knowledge, consent/recording, transfer, and fallback readiness must all be explicit."
  }),
  contract({
    domain: "marketplace",
    concept: "extension marketplace",
    decision: "planned_new_tables",
    existing: ["products", "organization_entitlements", "open_source_tools", "tool_reviews"],
    candidate: ["extension_catalog_items", "extension_versions", "extension_permissions", "organization_extension_installs"],
    requiredFields: ["publisher_ref", "name", "type", "version", "manifest_digest", "review_status", "permission_manifest", "created_at", "updated_at"],
    gate: "No public marketplace or third-party payout until publisher review, licence/security review, install permissions, versioning, rollback, abuse/removal, and payout/legal policy exist."
  }),
  contract({
    domain: "agency",
    concept: "parent/child tenant relationship",
    decision: "planned_new_table",
    existing: ["organizations", "organization_memberships", "organization_entitlements"],
    candidate: ["organization_relationships"],
    requiredFields: ["parent_organization_id", "child_organization_id", "relationship_type", "status", "created_by", "approved_at", "created_at"],
    gate: "A parent relationship must not grant access to child tenant data by itself; permissions remain explicit and auditable."
  }),
  contract({
    domain: "industry_packs",
    concept: "industry pack installation",
    decision: "no_new_table_initially",
    existing: ["organization_entitlements", "business_vertical_templates", "feature_flags"],
    candidate: [],
    requiredFields: ["organization_id", "entitlement_or_feature_key"],
    gate: "Industry packs should compose existing modules, defaults, terminology, workflows, and dashboards before inventing a new persistence layer."
  }),
  contract({
    domain: "commerce",
    concept: "creator digital delivery and membership",
    decision: "extend_existing_first",
    existing: ["merchant_products", "merchant_product_variants", "payments", "subscriptions", "organization_entitlements", "creator_assets", "creator_releases"],
    candidate: ["digital_delivery_grants", "creator_license_grants"],
    requiredFields: ["organization_id", "customer_ref", "product_ref", "asset_or_release_ref", "entitlement_ref", "status", "granted_at", "expires_at"],
    gate: "Provider-confirmed paid state must precede entitlement. Rights/licence grants require explicit terms and provenance."
  }),
  contract({
    domain: "distribution",
    concept: "MCP/external agent capability exposure",
    decision: "registry_and_policy_first",
    existing: ["entity_agent_tool_registry", "entity_connectors", "entity_connector_events", "organization_integrations"],
    candidate: ["external_tool_grants"],
    requiredFields: ["organization_id", "connector_ref", "tool_key", "permission_scope", "status", "approved_by", "created_at"],
    gate: "External discovery never implies invocation authority. Mutating tools require explicit per-tool scope plus normal SONARA approval/policy checks."
  })
]);

function getMarketExpansionSchemaPlan() {
  const contracts = SCHEMA_PLAN.map((item) => JSON.parse(JSON.stringify(item)));
  return {
    version: "2026-09-16",
    mode: "reuse_first_non_executing_schema_plan",
    count: contracts.length,
    decisions: countBy(contracts, "decision"),
    contracts
  };
}

function contract(input) {
  return Object.freeze({
    domain: input.domain,
    concept: input.concept,
    decision: input.decision,
    existing: Object.freeze([...(input.existing || [])]),
    candidate: Object.freeze([...(input.candidate || [])]),
    requiredFields: Object.freeze([...(input.requiredFields || [])]),
    gate: input.gate
  });
}

function countBy(records, field) {
  const output = {};
  for (const record of records) output[record[field]] = (output[record[field]] || 0) + 1;
  return output;
}

module.exports = {
  SCHEMA_PLAN,
  getMarketExpansionSchemaPlan
};

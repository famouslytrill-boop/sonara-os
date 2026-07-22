"use strict";

const DATABASE_TABLE_GROUPS = Object.freeze({
  identity: Object.freeze([
    "profiles",
    "organizations",
    "organization_memberships",
    "user_roles",
    "user_preferences"
  ]),
  platformBuilder: Object.freeze([
    "sonara_platforms",
    "sonara_platform_pages",
    "sonara_platform_apps",
    "sonara_platform_modules",
    "sonara_platform_publications",
    "sonara_platform_templates"
  ]),
  billing: Object.freeze([
    "stripe_customers",
    "purchases",
    "billing_webhook_events",
    "billing_subscriptions",
    "billing_entitlements",
    "plans",
    "organization_entitlements"
  ]),
  support: Object.freeze([
    "support_requests",
    "feedback_reports",
    "support_email_delivery_attempts"
  ]),
  serviceLifecycle: Object.freeze([
    "service_catalog_items",
    "service_requests",
    "service_request_events",
    "service_deliverables",
    "service_comments",
    "module_outputs",
    "intake_requests",
    "launch_checklist_items",
    "activity_events"
  ]),
  businessBuilder: Object.freeze([
    "business_workspaces",
    "business_memberships",
    "business_employee_invites",
    "business_employee_profiles",
    "business_service_catalog",
    "business_service_items",
    "business_bookings",
    "business_appointments",
    "employee_schedules",
    "employee_profiles",
    "employee_shifts",
    "employee_time_entries",
    "employee_pay_periods",
    "employee_pay_statements",
    "employee_posts",
    "business_locations",
    "business_assets",
    "inventory_items",
    "vendor_accounts",
    "vendor_invoices",
    "recipe_cards",
    "recipe_ingredients",
    "menu_items",
    "pos_sales_summaries",
    "daily_profit_snapshots",
    "customer_records",
    "order_records",
    "vehicle_records",
    "maintenance_logs",
    "waste_logs"
  ]),
  creatorStudio: Object.freeze([
    "creator_assets",
    "creator_releases",
    "creator_artist_systems",
    "creator_song_blueprints",
    "creator_prompt_packs",
    "creator_quality_checks",
    "creator_release_packages",
    "creator_export_packages",
    "music_tracks",
    "music_stems",
    "daw_export_profiles",
    "music_ai_providers",
    "music_ai_jobs",
    "audio_analysis_reports",
    "audio_transcription_segments",
    "music_projects"
  ]),
  growthStudio: Object.freeze([
    "growth_campaigns",
    "growth_leads",
    "growth_experiments",
    "automation_rules"
  ]),
  referenceIntelligence: Object.freeze([
    "reference_intelligence_sources",
    "reference_intelligence_insights",
    "reference_intelligence_actions"
  ]),
  agentsAndAutomation: Object.freeze([
    "provider_registry",
    "feature_flags",
    "workflow_runs",
    "agent_action_logs",
    "sonara_memory_records",
    "entities",
    "entity_memberships",
    "entity_agents",
    "entity_agent_runs",
    "entity_agent_memory",
    "entity_agent_tool_registry",
    "entity_proactive_actions",
    "entity_action_runs",
    "entity_action_approvals",
    "entity_automations",
    "entity_automation_runs",
    "entity_connectors",
    "entity_connector_events",
    "platform_jobs"
  ]),
  operationsAndAudit: Object.freeze([
    "audit_logs",
    "admin_audit_logs",
    "system_audit_events",
    "db_health_snapshots",
    "observability_events",
    "license_reviews",
    "security_reviews",
    "sonara_control_plane_checks"
  ]),
  formulas: Object.freeze([
    "sonara_formula_groups",
    "sonara_formula_definitions",
    "sonara_formula_variables",
    "sonara_formula_templates",
    "sonara_formula_results"
  ]),
  integrationsAndNotifications: Object.freeze([
    "integration_providers",
    "integration_jobs",
    "user_notifications"
  ]),
  sensoryAndLocation: Object.freeze([
    "sensory_feedback_profiles",
    "sound_cues",
    "haptic_patterns",
    "location_zones"
  ])
});

const DATABASE_FUNCTIONS = Object.freeze([
  "public.is_org_member(uuid)",
  "public.has_org_role(uuid,text[])",
  "public.is_admin_or_founder()",
  "public.is_org_owner_or_admin(uuid)",
  "public.sonara_is_org_member(uuid)",
  "public.sonara_has_org_role(uuid,text[])",
  "public.is_entity_member(uuid)",
  "public.has_entity_role(uuid,public.entity_member_role[])",
  "public.can_manage_entity(uuid)",
  "public.sonara_database_contract_snapshot()"
]);

const DATABASE_INDEXES = Object.freeze([
  Object.freeze({ name: "organization_memberships_active_user_created_idx", table: "organization_memberships" }),
  Object.freeze({ name: "business_memberships_active_manager_lookup_idx", table: "business_memberships" }),
  Object.freeze({ name: "billing_subscriptions_active_org_plan_idx", table: "billing_subscriptions" }),
  Object.freeze({ name: "service_catalog_items_active_product_name_idx", table: "service_catalog_items" }),
  Object.freeze({ name: "service_requests_org_product_created_idx", table: "service_requests" }),
  Object.freeze({ name: "service_deliverables_org_product_updated_idx", table: "service_deliverables" }),
  Object.freeze({ name: "module_outputs_org_product_module_created_idx", table: "module_outputs" }),
  Object.freeze({ name: "business_employee_invites_pending_workspace_created_idx", table: "business_employee_invites" }),
  Object.freeze({ name: "reference_intelligence_sources_status_created_idx", table: "reference_intelligence_sources" }),
  Object.freeze({ name: "reference_intelligence_insights_source_status_idx", table: "reference_intelligence_insights" }),
  Object.freeze({ name: "reference_intelligence_actions_product_status_idx", table: "reference_intelligence_actions" })
]);

const STORAGE_BUCKETS = Object.freeze([
  "avatars",
  "business-assets",
  "creator-assets",
  "music-stems",
  "release-packages",
  "support-attachments",
  "exports"
]);

const DATABASE_SCHEMAS = Object.freeze(["public", "auth", "storage"]);
const DATABASE_TABLES = Object.freeze([...new Set(Object.values(DATABASE_TABLE_GROUPS).flat())]);

module.exports = {
  DATABASE_FUNCTIONS,
  DATABASE_INDEXES,
  DATABASE_SCHEMAS,
  DATABASE_TABLE_GROUPS,
  DATABASE_TABLES,
  STORAGE_BUCKETS
};

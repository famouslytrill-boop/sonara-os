// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const FRONTEND_VISUAL_SNAPSHOT_DATE = "2026-09-20";
const FRONTEND_VISUAL_VERSION = "1.0.0";

const FRONTEND_MARKET_SIGNALS_2026 = Object.freeze([
  Object.freeze({
    key: "global_attention_is_search_video_social_and_ai",
    category: "market",
    asOf: "2026-08-31",
    source: "Similarweb",
    sourceUrl: "https://www.similarweb.com/blog/research/market-research/most-visited-websites/",
    evidence: "August 2026 global web traffic places Google, YouTube, Facebook, Instagram, and ChatGPT among the five most-visited sites.",
    sonaraDecision: "Keep global search, media, social, and conversational entry points as distinct navigation intents instead of collapsing them into one overloaded dashboard.",
    runtimeAuthority: "none"
  }),
  Object.freeze({
    key: "mobile_ai_and_communication_are_primary_entry_points",
    category: "market",
    asOf: "2026-09-15",
    source: "Similarweb",
    sourceUrl: "https://www.similarweb.com/top-apps/google/",
    evidence: "Current US Android usage rankings are led by browser, messaging, search, and social applications while AI and commerce are prominent among top-grossing apps.",
    sonaraDecision: "Treat mobile search, messages, notifications, assistant access, and fast task continuation as first-class shell capabilities.",
    runtimeAuthority: "none"
  }),
  Object.freeze({
    key: "productivity_charts_are_ai_first",
    category: "market",
    asOf: FRONTEND_VISUAL_SNAPSHOT_DATE,
    source: "Apple App Store",
    sourceUrl: "https://apps.apple.com/us/iphone/charts/6007?chart=top-free",
    evidence: "The current US iPhone Productivity chart includes multiple AI assistants alongside email, drive, office, authentication, and calendar tools.",
    sonaraDecision: "The assistant belongs inside the work shell, but records, files, identity, and scheduling remain explicit deterministic surfaces.",
    runtimeAuthority: "none"
  }),
  Object.freeze({
    key: "business_mobile_is_workflow_not_dashboard_only",
    category: "market",
    asOf: FRONTEND_VISUAL_SNAPSHOT_DATE,
    source: "Apple App Store",
    sourceUrl: "https://apps.apple.com/us/iphone/charts/6000?chart=top-free",
    evidence: "Current US Business rankings emphasize jobs, professional networks, delivery work, meetings, documents, identity, HR, shipping, POS, and team communication.",
    sonaraDecision: "Design Business Builder around actionable task lanes: customers, jobs, delivery, documents, staff, payments, identity, and communication.",
    runtimeAuthority: "none"
  }),
  Object.freeze({
    key: "creator_mobile_is_edit_publish_store_analyze",
    category: "market",
    asOf: FRONTEND_VISUAL_SNAPSHOT_DATE,
    source: "Apple App Store",
    sourceUrl: "https://apps.apple.com/us/iphone/charts/6008?chart=top-free",
    evidence: "Current Photo & Video rankings combine editing, publishing, storage, live streaming, creator studios, and AI media tools.",
    sonaraDecision: "Creator Studio should join asset management, editing states, publishing status, rights/provenance, and channel analytics without pretending one canvas replaces specialist editors.",
    runtimeAuthority: "none"
  }),
  Object.freeze({
    key: "commerce_ux_is_mobile_performance_and_checkout",
    category: "commerce",
    asOf: "2026-07-28",
    source: "Shopify",
    sourceUrl: "https://www.shopify.com/blog/ecommerce-ux",
    evidence: "Shopify's 2026 guidance centers navigation, product discovery, mobile UX, page speed, cart clarity, and low-friction checkout.",
    sonaraDecision: "Storefront and checkout surfaces prioritize speed, guest-friendly progression, clear costs, persistent order context, and minimal form friction.",
    runtimeAuthority: "none"
  }),
  Object.freeze({
    key: "performance_is_part_of_visual_quality",
    category: "performance",
    asOf: FRONTEND_VISUAL_SNAPSHOT_DATE,
    source: "web.dev",
    sourceUrl: "https://web.dev/articles/vitals",
    evidence: "Core Web Vitals guidance targets LCP <= 2.5s, INP <= 200ms, and CLS <= 0.1 at the 75th percentile.",
    sonaraDecision: "Visual polish must stay inside measurable loading, interaction, and layout-stability budgets.",
    runtimeAuthority: "none"
  }),
  Object.freeze({
    key: "wcag22_changes_operational_interactions",
    category: "accessibility",
    asOf: FRONTEND_VISUAL_SNAPSHOT_DATE,
    source: "W3C",
    sourceUrl: "https://www.w3.org/TR/WCAG22/",
    evidence: "WCAG 2.2 adds focus-not-obscured, dragging alternatives, and minimum target-size requirements relevant to dense workspaces, kanban boards, maps, and editors.",
    sonaraDecision: "Every drag interaction needs a non-drag alternative; sticky controls cannot hide focus; SONARA retains its stronger 44px default target even though WCAG AA permits smaller targets under defined conditions.",
    runtimeAuthority: "none"
  }),
  Object.freeze({
    key: "glass_is_a_control_layer_not_content",
    category: "visual_design",
    asOf: FRONTEND_VISUAL_SNAPSHOT_DATE,
    source: "Apple Human Interface Guidelines",
    sourceUrl: "https://developer.apple.com/documentation/technologyoverviews/liquid-glass",
    evidence: "Apple's current design direction emphasizes adaptable layouts, predictable navigation, restrained control color, and Liquid Glass as a navigation/control treatment around content.",
    sonaraDecision: "Reserve translucency and cinematic material effects for navigation, overlays, startup, and presentation; keep operational content surfaces opaque enough for fast scanning.",
    runtimeAuthority: "none"
  }),
  Object.freeze({
    key: "adaptive_navigation_changes_with_screen_class",
    category: "responsive_design",
    asOf: FRONTEND_VISUAL_SNAPSHOT_DATE,
    source: "Android Developers",
    sourceUrl: "https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-and-nav-patterns",
    evidence: "Material guidance adapts navigation patterns to window size rather than stretching a single mobile pattern onto tablets and large screens.",
    sonaraDecision: "Use bottom navigation only where compact screens justify it; promote to rails or persistent side navigation on wider operational layouts.",
    runtimeAuthority: "none"
  }),
  Object.freeze({
    key: "enterprise_accessibility_is_structural",
    category: "accessibility",
    asOf: FRONTEND_VISUAL_SNAPSHOT_DATE,
    source: "Microsoft Fluent 2",
    sourceUrl: "https://fluent2.microsoft.design/accessibility",
    evidence: "Fluent emphasizes predictable hierarchy, managed focus, contrast, responsive reflow, zoom support, semantic code, and plain language.",
    sonaraDecision: "Accessibility is a layout and state contract, not a final color-contrast pass.",
    runtimeAuthority: "none"
  }),
  Object.freeze({
    key: "design_systems_scale_through_tokens_and_modes",
    category: "design_system",
    asOf: FRONTEND_VISUAL_SNAPSHOT_DATE,
    source: "Figma",
    sourceUrl: "https://www.figma.com/design-systems/",
    evidence: "Figma's design-system guidance emphasizes shared components, variables, modes, and tokenized design decisions across products and themes.",
    sonaraDecision: "Keep SONARA's existing CSS token families as authority and map any future design-tool variables to them rather than introducing parallel color/spacing vocabularies.",
    runtimeAuthority: "none"
  }),
  Object.freeze({
    key: "creative_suites_merge_documents_data_and_media",
    category: "creator",
    asOf: FRONTEND_VISUAL_SNAPSHOT_DATE,
    source: "Canva",
    sourceUrl: "https://www.canva.com/visual-suite/",
    evidence: "Current visual-suite positioning combines docs, data visualization, media creation, collaboration, and AI-assisted production in one workspace family.",
    sonaraDecision: "Creator Studio should use shared project context and asset rails while preserving specialist media workspaces instead of forcing every task into one editor.",
    runtimeAuthority: "none"
  }),
  Object.freeze({
    key: "restaurant_ui_is_continuous_order_fulfillment_payment",
    category: "restaurant",
    asOf: "2026-09-17",
    source: "Toast",
    sourceUrl: "https://support.toasttab.com/en/article/Mobile-Order-and-Pay-Overview",
    evidence: "Toast's current mobile flow connects menu browsing, continuous tabs, order routing, staff additions, split payment, fulfillment communication, loyalty, and guest data.",
    sonaraDecision: "Restaurant surfaces need one canonical order state visualized differently for guest, counter, handheld, kitchen, pickup, and manager contexts.",
    runtimeAuthority: "none"
  }),
  Object.freeze({
    key: "kiosk_ui_requires_large_visual_choices_and_persistent_cart",
    category: "kiosk",
    asOf: FRONTEND_VISUAL_SNAPSHOT_DATE,
    source: "Square",
    sourceUrl: "https://squareup.com/help/us/en/article/8540-preview-diner-experience-on-square-kiosk",
    evidence: "Square describes kiosk UX with picture-based categories, large fonts and tap targets, recommendations, and a persistent cart.",
    sonaraDecision: "Kiosk mode gets its own large-touch density, persistent transaction context, visible escape/back actions, and no admin complexity.",
    runtimeAuthority: "none"
  }),
  Object.freeze({
    key: "fleet_ui_is_role_and_status_driven",
    category: "fleet",
    asOf: "2026-09-02",
    source: "Samsara",
    sourceUrl: "https://kb.samsara.com/hc/en-us/articles/48621492984589-Dashboard-Menus",
    evidence: "Samsara's dashboard is organized around role- and license-dependent modules such as overview, safety, compliance, maintenance, routing, forms, and alerts.",
    sonaraDecision: "Fleet and field navigation should be entitlement-aware and center location, status, exceptions, work, and alerts rather than decorative KPI density.",
    runtimeAuthority: "none"
  }),
  Object.freeze({
    key: "spatial_ui_needs_comfort_not_depth_everywhere",
    category: "spatial",
    asOf: FRONTEND_VISUAL_SNAPSHOT_DATE,
    source: "Apple Human Interface Guidelines",
    sourceUrl: "https://developer.apple.com/design/human-interface-guidelines/spatial-layout/",
    evidence: "Spatial guidance recommends centering important content, using depth to clarify hierarchy, avoiding depth on text, and limiting excess windows and motion.",
    sonaraDecision: "3D is reserved for CAD, product, facility, map, simulation, or media contexts where depth conveys information; ordinary business text stays planar.",
    runtimeAuthority: "none"
  }),
  Object.freeze({
    key: "ai_native_ui_is_composed_from_design_knowledge",
    category: "agentic_ui",
    asOf: "2026-05-12",
    source: "SAP",
    sourceUrl: "https://www.sap.com/design/stories-resources/evolving-design-systems-for-ai-driven-ux",
    evidence: "SAP describes enterprise interfaces shifting toward intent- and context-composed experiences backed by design-system knowledge.",
    sonaraDecision: "SONARA can add intent-composed panels only through bounded semantic components and policy-validated composition; deterministic navigation remains available.",
    runtimeAuthority: "none"
  })
]);

const FRONTEND_REPOSITORY_REFERENCES = Object.freeze([
  Object.freeze({
    repository: "shadcn-ui/ui",
    license: "MIT",
    role: "component_composition_reference",
    adoption: "research_only",
    reason: "Study open-code composition, command palettes, data tables, sheets, sidebars, charts, forms, and AI-oriented component structure without introducing React into the current Express/static runtime."
  }),
  Object.freeze({
    repository: "radix-ui/primitives",
    license: "MIT",
    role: "accessible_interaction_reference",
    adoption: "research_only",
    reason: "Use accessibility, keyboard, focus, layering, and primitive-composition patterns as references for SONARA-owned components."
  }),
  Object.freeze({
    repository: "microsoft/fluentui",
    license: "MIT",
    role: "enterprise_accessibility_reference",
    adoption: "research_only",
    reason: "Study enterprise hierarchy, dense-workspace behavior, accessibility, localization, and responsive component conventions."
  }),
  Object.freeze({
    repository: "storybookjs/storybook",
    license: "MIT",
    role: "component_evidence_reference",
    adoption: "review_before_install",
    reason: "Candidate future isolated component documentation and visual-state evidence tool if SONARA later introduces a compatible frontend build layer."
  }),
  Object.freeze({
    repository: "microsoft/playwright",
    license: "Apache-2.0",
    role: "browser_regression_reference",
    adoption: "review_before_install",
    reason: "Candidate future browser-level accessibility, responsive-state, keyboard, route, and screenshot regression harness; not installed by this research pass."
  }),
  Object.freeze({
    repository: "dequelabs/axe-core",
    license: "MPL-2.0",
    role: "accessibility_automation_reference",
    adoption: "license_and_tooling_review",
    reason: "Candidate automated accessibility signal to complement manual testing; automated checks must never be treated as complete accessibility proof."
  })
]);

const FRONTEND_SURFACE_ARCHETYPES = Object.freeze([
  Object.freeze({
    key: "public_marketing",
    density: "spacious",
    primaryUsers: Object.freeze(["prospect", "customer", "partner"]),
    primaryPattern: "editorial_sections_with_clear_conversion_paths",
    requiredStates: Object.freeze(["default", "loading", "error", "reduced_motion"]),
    rules: Object.freeze(["cinematic_brand_moments_allowed", "content_remains_readable_without_motion", "no_fake_metrics_or_progress", "performance_budget_applies"])
  }),
  Object.freeze({
    key: "business_command_center",
    density: "comfortable",
    primaryUsers: Object.freeze(["owner", "manager"]),
    primaryPattern: "exceptions_tasks_status_and_recent_activity",
    requiredStates: Object.freeze(["default", "loading", "empty", "error", "offline", "permission_limited"]),
    rules: Object.freeze(["show_next_actions_before_vanity_metrics", "support_keyboard_and_touch", "drill_down_not_dashboard_sprawl"])
  }),
  Object.freeze({
    key: "agent_workspace",
    density: "comfortable",
    primaryUsers: Object.freeze(["owner", "operator", "creator"]),
    primaryPattern: "conversation_plus_plan_tools_evidence_and_approval",
    requiredStates: Object.freeze(["idle", "streaming", "tool_running", "approval_required", "blocked", "failed", "complete"]),
    rules: Object.freeze(["never_hide_tool_or_action_state", "sensitive_actions_require_explicit_approval", "show_cost_latency_or_budget_when_material", "preserve_deterministic_manual_path"])
  }),
  Object.freeze({
    key: "rag_evidence_workspace",
    density: "compact",
    primaryUsers: Object.freeze(["operator", "analyst", "admin"]),
    primaryPattern: "answer_source_evidence_and_filters",
    requiredStates: Object.freeze(["retrieving", "partial", "cited", "insufficient_evidence", "failed"]),
    rules: Object.freeze(["source_scope_visible", "citations_open_in_context", "unknown_is_not_success", "tenant_filter_state_visible"])
  }),
  Object.freeze({
    key: "records_and_data_table",
    density: "compact",
    primaryUsers: Object.freeze(["operator", "manager", "admin"]),
    primaryPattern: "table_filter_sort_select_bulk_action_detail",
    requiredStates: Object.freeze(["default", "loading", "empty", "filtered_empty", "error", "partial"]),
    rules: Object.freeze(["sticky_headers_must_not_obscure_focus", "bulk_actions_show_selection_count", "mobile_collapses_to_priority_fields", "exports_reflect_active_filters"])
  }),
  Object.freeze({
    key: "crm_customer_timeline",
    density: "comfortable",
    primaryUsers: Object.freeze(["sales", "service", "owner"]),
    primaryPattern: "identity_summary_timeline_tasks_conversation",
    requiredStates: Object.freeze(["active", "new", "at_risk", "consent_limited", "closed"]),
    rules: Object.freeze(["separate_facts_from_model_summaries", "communication_consent_visible", "timeline_is_chronological_source_of_truth"])
  }),
  Object.freeze({
    key: "pipeline_kanban",
    density: "comfortable",
    primaryUsers: Object.freeze(["sales", "project_manager", "operator"]),
    primaryPattern: "stage_columns_cards_and_detail",
    requiredStates: Object.freeze(["default", "dragging", "keyboard_move", "blocked", "empty_stage"]),
    rules: Object.freeze(["drag_has_single_pointer_and_keyboard_alternative", "stage_transition_can_require_validation", "do_not_encode_status_by_color_only"])
  }),
  Object.freeze({
    key: "calendar_scheduler",
    density: "comfortable",
    primaryUsers: Object.freeze(["customer", "staff", "dispatcher"]),
    primaryPattern: "availability_time_resource_booking",
    requiredStates: Object.freeze(["available", "held", "confirmed", "rescheduled", "cancelled", "conflict"]),
    rules: Object.freeze(["timezone_visible_when_ambiguous", "conflicts_explained", "mobile_uses_agenda_fallback", "calendar_drag_has_form_alternative"])
  }),
  Object.freeze({
    key: "pos_counter",
    density: "high_touch",
    primaryUsers: Object.freeze(["cashier", "server"]),
    primaryPattern: "catalog_cart_payment_and_fulfillment",
    requiredStates: Object.freeze(["open_order", "held", "payment_pending", "paid", "partial_payment", "offline", "syncing", "failed"]),
    rules: Object.freeze(["primary_controls_48px_or_larger", "cart_always_visible_or_one_action_away", "payment_state_never_inferred_from_spinner", "offline_mode_distinguishable"])
  }),
  Object.freeze({
    key: "kiosk_self_service",
    density: "kiosk",
    primaryUsers: Object.freeze(["guest", "customer"]),
    primaryPattern: "large_category_choices_persistent_cart_guided_checkout",
    requiredStates: Object.freeze(["welcome", "browsing", "customizing", "review", "payment", "receipt", "assistance"]),
    rules: Object.freeze(["large_text_and_targets", "persistent_cart", "obvious_back_and_cancel", "no_staff_only_controls", "timeout_preserves_privacy"])
  }),
  Object.freeze({
    key: "restaurant_kitchen_fulfillment",
    density: "glanceable",
    primaryUsers: Object.freeze(["kitchen", "expeditor", "manager"]),
    primaryPattern: "order_queue_elapsed_time_station_and_exception",
    requiredStates: Object.freeze(["new", "accepted", "in_progress", "ready", "held", "voided", "late"]),
    rules: Object.freeze(["status_not_color_only", "large_distance_legibility", "touch_or_bump_bar_safe", "timestamps_use_one_canonical_clock"])
  }),
  Object.freeze({
    key: "field_service_mobile",
    density: "focused",
    primaryUsers: Object.freeze(["technician", "driver", "inspector"]),
    primaryPattern: "today_job_detail_checklist_media_signature_and_sync",
    requiredStates: Object.freeze(["assigned", "en_route", "onsite", "paused", "complete", "offline", "sync_conflict"]),
    rules: Object.freeze(["offline_first_state_is_visible", "one_primary_action_per_step", "camera_gps_and_signature_permissions_are_contextual", "sync_conflicts_are_never_silent"])
  }),
  Object.freeze({
    key: "fleet_map_dispatch",
    density: "compact",
    primaryUsers: Object.freeze(["dispatcher", "fleet_manager"]),
    primaryPattern: "map_list_detail_alerts_and_route_state",
    requiredStates: Object.freeze(["live", "delayed", "stale_location", "alert", "disconnected", "historical"]),
    rules: Object.freeze(["map_has_list_equivalent", "location_freshness_visible", "alerts_are_prioritized", "role_and_entitlement_shape_navigation"])
  }),
  Object.freeze({
    key: "commerce_storefront_checkout",
    density: "focused",
    primaryUsers: Object.freeze(["shopper", "customer"]),
    primaryPattern: "discover_compare_cart_checkout_track",
    requiredStates: Object.freeze(["browsing", "cart", "checkout", "payment_pending", "paid", "failed", "refunded"]),
    rules: Object.freeze(["transparent_costs_before_commit", "guest_path_supported_when_product_allows", "mobile_wallets_are_adapters_not_ui_assumptions", "order_summary_stays_visible"])
  }),
  Object.freeze({
    key: "creator_media_workbench",
    density: "compact",
    primaryUsers: Object.freeze(["creator", "editor", "producer"]),
    primaryPattern: "asset_bin_canvas_or_timeline_inspector_history_export",
    requiredStates: Object.freeze(["draft", "rendering", "render_failed", "review", "approved", "published"]),
    rules: Object.freeze(["media_provenance_visible", "timeline_has_keyboard_operations", "render_progress_real_or_indeterminate", "publish_is_separate_from_generate"])
  }),
  Object.freeze({
    key: "analytics_observability",
    density: "compact",
    primaryUsers: Object.freeze(["owner", "analyst", "engineer"]),
    primaryPattern: "summary_trend_breakdown_exception_evidence",
    requiredStates: Object.freeze(["healthy", "degraded", "partial_data", "stale", "incident"]),
    rules: Object.freeze(["time_range_always_visible", "chart_has_table_or_text_equivalent", "forecast_separated_from_actual", "data_freshness_visible"])
  }),
  Object.freeze({
    key: "spatial_3d_viewer",
    density: "immersive",
    primaryUsers: Object.freeze(["designer", "customer", "technician"]),
    primaryPattern: "viewport_selection_properties_measurement_and_reset",
    requiredStates: Object.freeze(["loading_asset", "interactive", "selection", "measurement", "unsupported_device", "reduced_motion"]),
    rules: Object.freeze(["depth_must_convey_information", "text_remains_planar", "2d_fallback_exists", "camera_motion_is_user_controlled"])
  })
]);

const FRONTEND_STATE_VOCABULARY = Object.freeze([
  "idle",
  "loading",
  "streaming",
  "partial",
  "empty",
  "error",
  "offline",
  "syncing",
  "blocked",
  "approval_required",
  "complete"
]);

const FRONTEND_IMPLEMENTATION_SEQUENCE = Object.freeze([
  "resolve_design_authority_and_remove_stale_palette_guidance",
  "standardize_surface_archetypes_and_state_vocabulary",
  "adopt_operational_shell_primitives_without_framework_migration",
  "make_agent_rag_tool_and_approval_state_visually_explicit",
  "strengthen_mobile_field_pos_and_kiosk_density_modes",
  "add_map_list_and_drag_non_drag_equivalent_interactions",
  "enforce_real_loading_offline_stale_and_sync_states",
  "measure_core_web_vitals_and_accessibility_on_representative_routes",
  "add_browser_level_visual_keyboard_and_responsive_regression_when_tooling_review_allows",
  "introduce_bounded_compositional_ui_only_after_component_contract_and_policy_gate_exist",
  "promote_3d_ar_or_spatial_views_only_for_information_bearing_domain_tasks"
]);

function assertUnit(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1) {
    throw new RangeError(`${field} must be a finite number between 0 and 1`);
  }
  return number;
}

function round(value, digits = 4) {
  const power = 10 ** digits;
  return Math.round(value * power) / power;
}

function frontendPriorityScore(input = {}) {
  const taskFrequency = assertUnit(input.taskFrequency, "taskFrequency");
  const operationalCriticality = assertUnit(input.operationalCriticality, "operationalCriticality");
  const platformReuse = assertUnit(input.platformReuse, "platformReuse");
  const mobileImportance = assertUnit(input.mobileImportance, "mobileImportance");
  const revenueOrServiceImpact = assertUnit(input.revenueOrServiceImpact, "revenueOrServiceImpact");
  const implementationRisk = assertUnit(input.implementationRisk, "implementationRisk");
  const interactionRisk = assertUnit(input.interactionRisk, "interactionRisk");

  const raw =
    taskFrequency * 0.24 +
    operationalCriticality * 0.22 +
    platformReuse * 0.20 +
    mobileImportance * 0.18 +
    revenueOrServiceImpact * 0.16 -
    implementationRisk * 0.10 -
    interactionRisk * 0.10;

  return round(Math.max(0, Math.min(1, raw)));
}

function getFrontendSurface(key) {
  const found = FRONTEND_SURFACE_ARCHETYPES.find((item) => item.key === key);
  return found ? {
    ...found,
    primaryUsers: [...found.primaryUsers],
    requiredStates: [...found.requiredStates],
    rules: [...found.rules]
  } : null;
}

function getFrontendVisualIntelligence() {
  return {
    ok: true,
    version: FRONTEND_VISUAL_VERSION,
    snapshotDate: FRONTEND_VISUAL_SNAPSHOT_DATE,
    researchOnly: true,
    productionExecutionCount: 0,
    marketSignalCount: FRONTEND_MARKET_SIGNALS_2026.length,
    repositoryReferenceCount: FRONTEND_REPOSITORY_REFERENCES.length,
    surfaceArchetypeCount: FRONTEND_SURFACE_ARCHETYPES.length,
    marketSignals: FRONTEND_MARKET_SIGNALS_2026.map((item) => ({ ...item })),
    repositoryReferences: FRONTEND_REPOSITORY_REFERENCES.map((item) => ({ ...item })),
    surfaceArchetypes: FRONTEND_SURFACE_ARCHETYPES.map((item) => ({
      ...item,
      primaryUsers: [...item.primaryUsers],
      requiredStates: [...item.requiredStates],
      rules: [...item.rules]
    })),
    stateVocabulary: [...FRONTEND_STATE_VOCABULARY],
    implementationSequence: [...FRONTEND_IMPLEMENTATION_SEQUENCE],
    formulas: {
      frontendPriorityScore: "0.24*task_frequency + 0.22*operational_criticality + 0.20*platform_reuse + 0.18*mobile_importance + 0.16*revenue_or_service_impact - 0.10*implementation_risk - 0.10*interaction_risk",
      coreWebVitalsTargets: Object.freeze({ lcpSeconds: 2.5, inpMilliseconds: 200, cls: 0.1 }),
      sonaraDefaultTapTargetCssPx: 44
    },
    guardrails: [
      "Research and repository references grant no runtime or dependency authority.",
      "Public and startup presentation may be cinematic; work surfaces remain calm and operational.",
      "Generated UI may select only application-owned semantic components after deterministic validation; arbitrary model-authored HTML, JavaScript, event handlers, or privileged URLs are not accepted.",
      "Agent actions, payments, publishing, refunds, security changes, destructive operations, and other sensitive mutations retain existing owner-approval and server-side authority rules.",
      "Accessibility automation complements but never replaces keyboard, screen-reader, zoom, touch, low-motion, and human usability review.",
      "External design systems are pattern references unless a separate architecture and license review explicitly approves adoption."
    ]
  };
}

module.exports = {
  FRONTEND_VISUAL_SNAPSHOT_DATE,
  FRONTEND_VISUAL_VERSION,
  FRONTEND_MARKET_SIGNALS_2026,
  FRONTEND_REPOSITORY_REFERENCES,
  FRONTEND_SURFACE_ARCHETYPES,
  FRONTEND_STATE_VOCABULARY,
  FRONTEND_IMPLEMENTATION_SEQUENCE,
  frontendPriorityScore,
  getFrontendSurface,
  getFrontendVisualIntelligence
};

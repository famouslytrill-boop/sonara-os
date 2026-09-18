// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Broad industry + algorithm research registry for the September 2026 expansion.
//
// This is non-executing strategy data. It does not install third-party software,
// activate a provider, create a financial/medical/security decision system, or
// grant an agent authority. Market scores are internal portfolio heuristics,
// not forecasts, guarantees, or third-party market ratings.

const PRIORITY = Object.freeze({
  FOUNDATION: "foundation",
  HIGHEST_VALUE: "highest_value",
  SECOND_WAVE: "second_wave",
  LATER: "later",
  PARTNER_ONLY: "partner_only",
  RESEARCH_ONLY: "research_only"
});

const POSITIVE_WEIGHTS = Object.freeze({
  willingnessToPay: 0.18,
  recurringFrequency: 0.12,
  workflowDepth: 0.14,
  reusablePrimitives: 0.15,
  grossMarginPotential: 0.12,
  retentionPotential: 0.12,
  openSourceLeverage: 0.08,
  distributionLeverage: 0.09
});

const RISK_WEIGHTS = Object.freeze({
  buildComplexity: 0.10,
  complianceRisk: 0.10,
  supportBurden: 0.06,
  integrationVolatility: 0.04
});

const INDUSTRIES = Object.freeze([
  industry({
    key: "entrepreneur_business_operations",
    name: "Entrepreneur and Small-Business Operating System",
    priority: PRIORITY.FOUNDATION,
    customers: ["solo operators", "small businesses", "service businesses", "local companies", "new founders"],
    revenue: ["subscription", "usage", "payments", "premium workflows", "templates", "implementation"],
    primitives: ["CRM", "offers", "websites", "bookings", "invoices", "payments", "tasks", "calendar", "communications", "analytics"],
    addOns: ["business planning", "pricing", "customer support", "local visibility", "training", "document generation"],
    score: scores(5, 5, 5, 5, 5, 5, 5, 5, 3, 2, 3, 2)
  }),
  industry({
    key: "logistics_trucking_fleet",
    name: "Logistics, Trucking and Fleet Operations",
    priority: PRIORITY.HIGHEST_VALUE,
    customers: ["owner-operators", "delivery fleets", "trucking carriers", "couriers", "service fleets"],
    revenue: ["per organization", "per vehicle", "routing optimization", "telematics add-on", "implementation"],
    primitives: ["vehicles", "drivers", "orders", "dispatch", "GPS", "routes", "maintenance", "fuel", "documents", "notifications"],
    addOns: ["route optimization", "driver app", "proof of delivery", "geofencing", "camera events", "maintenance forecasting", "warehouse"],
    score: scores(5, 5, 5, 5, 5, 5, 5, 4, 4, 3, 4, 3)
  }),
  industry({
    key: "manufacturing_supply_chain_iot",
    name: "Manufacturing, Supply Chain and Industrial IoT",
    priority: PRIORITY.HIGHEST_VALUE,
    customers: ["small manufacturers", "fabricators", "assembly operations", "warehouses", "industrial service companies"],
    revenue: ["site subscription", "asset/device tier", "analytics", "optimization", "implementation", "support"],
    primitives: ["BOM", "work orders", "machines", "inventory", "quality", "maintenance", "telemetry", "scheduling", "vendors", "digital twins"],
    addOns: ["OEE", "job-shop scheduling", "predictive maintenance support", "quality control", "shop-floor dashboards", "simulation"],
    score: scores(5, 5, 5, 5, 5, 5, 5, 4, 5, 4, 5, 4)
  }),
  industry({
    key: "construction_trades_field_service",
    name: "Construction, Trades and Field Service",
    priority: PRIORITY.HIGHEST_VALUE,
    customers: ["general contractors", "plumbers", "electricians", "HVAC", "carpenters", "roofers", "maintenance companies"],
    revenue: ["subscription", "per field worker", "payments", "voice", "routing", "document add-ons"],
    primitives: ["leads", "estimates", "jobs", "work orders", "crews", "materials", "schedules", "photos", "signatures", "payments"],
    addOns: ["dispatch", "offline field mode", "blueprints", "change orders", "inspections", "equipment", "maintenance plans"],
    score: scores(5, 5, 5, 5, 5, 5, 5, 4, 4, 3, 4, 3)
  }),
  industry({
    key: "property_rental_facilities",
    name: "Property, Housing, Rentals and Facilities",
    priority: PRIORITY.SECOND_WAVE,
    customers: ["small landlords", "property managers", "apartment operators", "equipment/car rental operators", "facility managers"],
    revenue: ["per unit/asset", "payments", "screening/integration", "maintenance", "marketplace"],
    primitives: ["properties", "units", "assets", "applications", "leases", "bookings", "rent", "maintenance", "vendors", "resident/customer portal"],
    addOns: ["listing syndication", "inspections", "work orders", "turnover planning", "rentals", "document signing"],
    score: scores(5, 5, 5, 4, 5, 5, 4, 4, 4, 4, 4, 3)
  }),
  industry({
    key: "venues_events_ticketing_catering",
    name: "Venues, Events, Tickets and Catering",
    priority: PRIORITY.SECOND_WAVE,
    customers: ["venues", "promoters", "event planners", "caterers", "festivals", "community organizations"],
    revenue: ["subscription", "per ticket/order", "payments", "check-in", "catering", "communications"],
    primitives: ["events", "venues", "tickets", "QR/NFC", "RSVP", "walk-ins", "seating", "payments", "menus", "staff"],
    addOns: ["offline check-in", "badges", "donations", "merchandise", "catering plans", "broadcast/streaming"],
    score: scores(4, 4, 5, 5, 4, 4, 5, 5, 3, 3, 4, 3)
  }),
  industry({
    key: "retail_pos_supermarket_merchandise",
    name: "Retail, POS, Supermarket and Merchandise",
    priority: PRIORITY.SECOND_WAVE,
    customers: ["small retailers", "markets", "food businesses", "pop-ups", "creator merchandise stores"],
    revenue: ["subscription", "payments", "transaction margin", "inventory add-ons", "hardware integrations"],
    primitives: ["catalog", "variants", "inventory", "barcode/QR", "orders", "payments", "returns", "suppliers", "pricing", "promotions"],
    addOns: ["sell-through analytics", "basket affinity", "replenishment", "loyalty", "kiosk", "digital signage"],
    score: scores(5, 5, 5, 5, 5, 5, 4, 5, 4, 3, 4, 3)
  }),
  industry({
    key: "creator_media_broadcast_production",
    name: "Creator, Media, Broadcast and Production",
    priority: PRIORITY.HIGHEST_VALUE,
    customers: ["musicians", "video creators", "podcasters", "streamers", "small studios", "publishers"],
    revenue: ["subscription", "generation/processing usage", "storage", "digital products", "memberships", "licensing"],
    primitives: ["projects", "assets", "audio", "video", "images", "timelines", "metadata", "rights", "publishing", "commerce"],
    addOns: ["streaming", "captions", "transcoding", "music theory", "video analysis", "interactive media", "3D", "blogs/vlogs/books/magazines"],
    score: scores(4, 5, 5, 5, 5, 5, 5, 5, 4, 3, 4, 3)
  }),
  industry({
    key: "communications_telecom_collaboration",
    name: "Communications, Telecom and Collaboration",
    priority: PRIORITY.SECOND_WAVE,
    customers: ["small businesses", "distributed teams", "support teams", "communities", "training organizations"],
    revenue: ["seat subscription", "voice/video usage", "storage", "premium routing", "support"],
    primitives: ["identity", "inbox", "chat", "voice", "video", "mail", "notifications", "presence", "files", "calendar"],
    addOns: ["PBX/IVR", "video rooms", "screen sharing", "recording", "translation", "TTS", "community spaces"],
    score: scores(4, 5, 5, 5, 4, 5, 5, 4, 4, 4, 5, 4)
  }),
  industry({
    key: "learning_training_accessibility",
    name: "Learning, Training, Study and Accessibility",
    priority: PRIORITY.SECOND_WAVE,
    customers: ["business trainers", "schools", "creators", "workforce programs", "self-learners"],
    revenue: ["subscription", "course sales", "organization seats", "certificates", "premium analytics"],
    primitives: ["courses", "lessons", "quizzes", "practice", "spaced repetition", "video rooms", "captions", "progress", "certificates"],
    addOns: ["music learning", "film theory", "language learning", "sign-language resources", "hearing accessibility", "training modules"],
    score: scores(4, 5, 4, 5, 4, 5, 5, 5, 3, 3, 4, 2)
  }),
  industry({
    key: "gaming_xr_3d_simulation",
    name: "Gaming, XR, 3D and Simulation",
    priority: PRIORITY.LATER,
    customers: ["creators", "training teams", "manufacturers", "architects", "event producers", "game developers"],
    revenue: ["creator subscription", "render/export usage", "templates", "training/simulation packages"],
    primitives: ["scenes", "assets", "physics", "input", "3D models", "animation", "simulation", "telemetry", "exports"],
    addOns: ["WebXR", "AR previews", "product configurators", "simulators", "interactive training", "game prototypes"],
    score: scores(3, 3, 4, 4, 4, 3, 5, 4, 5, 2, 5, 4)
  }),
  industry({
    key: "geospatial_weather_satellite_city",
    name: "Geospatial, Weather, Satellite and City Operations",
    priority: PRIORITY.SECOND_WAVE,
    customers: ["field businesses", "fleets", "property operators", "event teams", "city/community organizations"],
    revenue: ["premium mapping", "weather/alert usage", "location analytics", "operations subscriptions"],
    primitives: ["maps", "locations", "routes", "geofences", "weather", "alerts", "satellite imagery", "zones", "assets"],
    addOns: ["service areas", "risk overlays", "city planning maps", "route weather", "satellite visualization", "warning workflows"],
    score: scores(4, 5, 5, 5, 4, 5, 5, 4, 4, 4, 4, 4)
  }),
  industry({
    key: "security_monitoring_warning_systems",
    name: "Security, Monitoring and Warning Systems",
    priority: PRIORITY.FOUNDATION,
    customers: ["SONARA internal operations", "business customers", "multi-location operators", "regulated partners"],
    revenue: ["premium monitoring", "security add-on", "managed service", "audit evidence"],
    primitives: ["identity", "device events", "logs", "alerts", "policies", "approvals", "audit", "cameras", "notifications"],
    addOns: ["SIEM/XDR integrations", "behavior rules", "camera events", "device health", "incident workflows"],
    score: scores(5, 5, 5, 5, 4, 5, 5, 4, 4, 5, 5, 4)
  }),
  industry({
    key: "finance_accounting_business_planning",
    name: "Finance, Accounting and Business Planning",
    priority: PRIORITY.SECOND_WAVE,
    customers: ["small businesses", "entrepreneurs", "creators", "operators", "agencies"],
    revenue: ["subscription", "premium planning", "accounting integrations", "reports"],
    primitives: ["budgets", "cash flow", "invoices", "expenses", "forecasts", "KPIs", "plans", "scenarios"],
    addOns: ["unit economics", "break-even planning", "pricing", "cash runway", "financial dashboards", "accounting exports"],
    score: scores(5, 5, 5, 5, 5, 5, 5, 5, 3, 4, 4, 3)
  }),
  industry({
    key: "nonprofit_fundraising_community",
    name: "Nonprofit, Donations, Fundraising and Community",
    priority: PRIORITY.SECOND_WAVE,
    customers: ["nonprofits", "community groups", "clubs", "arts organizations", "associations"],
    revenue: ["subscription", "payments", "event ticketing", "communications", "donation processing"],
    primitives: ["contacts", "memberships", "donations", "events", "campaigns", "mailings", "volunteers", "payments"],
    addOns: ["recurring donors", "fundraising pages", "RSVP", "ticketing", "community portal", "reports"],
    score: scores(4, 4, 5, 5, 4, 5, 5, 5, 3, 4, 4, 2)
  }),
  industry({
    key: "automotive_vehicle_rental_service",
    name: "Automotive, Vehicle Rental and Service",
    priority: PRIORITY.SECOND_WAVE,
    customers: ["repair shops", "detailers", "rental operators", "small fleets", "mobile mechanics"],
    revenue: ["subscription", "per vehicle", "bookings", "payments", "maintenance"],
    primitives: ["vehicles", "customers", "inspections", "appointments", "work orders", "parts", "rentals", "payments", "maintenance"],
    addOns: ["damage photos", "mileage/fuel", "rental availability", "service reminders", "quotes", "GPS integration"],
    score: scores(4, 5, 5, 5, 5, 5, 5, 4, 4, 3, 4, 3)
  }),
  industry({
    key: "health_wellness_interoperability",
    name: "Health, Wellness and Medical Interoperability",
    priority: PRIORITY.PARTNER_ONLY,
    customers: ["wellness users", "health partners", "clinics only after compliance review"],
    revenue: ["wellness subscription", "partner integration", "enterprise interoperability"],
    primitives: ["appointments", "reminders", "wellness logs", "activity", "nutrition", "documents", "consent"],
    addOns: ["health data connections", "medication reminders", "nutrition tracking", "accessible communication"],
    boundaries: ["No diagnosis claims without regulated validation", "No autonomous medical detection", "Biometrics require explicit consent and purpose limitation", "Clinical workflows require qualified partners and compliance review"],
    score: scores(4, 5, 4, 4, 4, 5, 4, 3, 5, 5, 5, 5)
  }),
  industry({
    key: "trading_investment_research",
    name: "Trading and Investment Research",
    priority: PRIORITY.RESEARCH_ONLY,
    customers: ["research users", "business finance learners"],
    revenue: ["research subscription", "analytics"],
    primitives: ["market data adapters", "research notebooks", "backtests", "risk metrics", "paper portfolios"],
    addOns: ["paper trading", "strategy comparison", "scenario/risk analysis"],
    boundaries: ["No default autonomous trade execution", "Separate research/backtest from brokerage authority", "Require explicit account and risk controls before any future brokerage integration"],
    score: scores(4, 5, 3, 3, 4, 3, 4, 3, 5, 5, 5, 5)
  })
]);

const FORMULAS = Object.freeze([
  formula("opportunity_score", "Portfolio opportunity score", "strategy", "100 * positive_weighted_score/5 - 30 * risk_weighted_score/5", ["internal portfolio comparison only", "weights are owner-adjustable"]),
  formula("contribution_margin", "Contribution margin", "finance", "revenue - variable_cost", ["include provider, payment, messaging, support and fulfillment variable costs"]),
  formula("ltv_simple", "Simple subscription LTV", "finance", "arpa * gross_margin_rate / monthly_logo_churn_rate", ["use only when churn is measured and reasonably stable"]),
  formula("cac_payback", "CAC payback months", "finance", "cac / (arpa * gross_margin_rate)", ["same accounting period and cohort definition required"]),
  formula("break_even_units", "Break-even units", "finance", "fixed_cost / (unit_price - unit_variable_cost)", ["unit contribution must be positive"]),
  formula("target_margin_price", "Target-margin price", "pricing", "variable_cost / (1 - target_margin_rate)", ["a floor/target aid, not proof of customer willingness to pay"]),
  formula("eoq", "Economic order quantity", "inventory", "sqrt((2 * annual_demand * order_cost) / annual_holding_cost_per_unit)", ["assumes stable demand/order/holding cost"]),
  formula("reorder_point", "Reorder point", "inventory", "mean_demand_during_lead_time + safety_stock", ["recalculate when lead-time or demand distribution changes"]),
  formula("gmroi", "Gross margin return on inventory", "retail", "gross_margin_dollars / average_inventory_cost", []),
  formula("sell_through", "Sell-through rate", "retail", "units_sold / (units_sold + ending_units_on_hand)", ["define period consistently"]),
  formula("basket_lift", "Basket affinity lift", "retail", "P(A_and_B) / (P(A) * P(B))", ["minimum support threshold required before action"]),
  formula("oee", "Overall equipment effectiveness", "manufacturing", "availability * performance * quality", ["all components expressed as rates from 0 to 1"]),
  formula("takt_time", "Takt time", "manufacturing", "available_production_time / required_customer_units", []),
  formula("first_pass_yield", "First-pass yield", "quality", "good_units_without_rework / total_units_started", []),
  formula("cp", "Process capability Cp", "quality", "(usl - lsl) / (6 * sigma)", ["requires stable process and meaningful specification limits"]),
  formula("cpk", "Process capability Cpk", "quality", "min((usl - mean)/(3*sigma), (mean - lsl)/(3*sigma))", ["requires stable process and meaningful specification limits"]),
  formula("food_cost_pct", "Food cost percentage", "restaurant", "recipe_ingredient_cost / menu_price", []),
  formula("recipe_cost", "Recipe cost", "restaurant", "sum(ingredient_quantity * normalized_unit_cost / usable_yield)", ["normalize units before aggregation"]),
  formula("labor_utilization", "Labor utilization", "field_service", "productive_or_billable_time / available_time", ["do not reward unsafe speed or skipped required work"]),
  formula("travel_ratio", "Travel-time ratio", "field_service", "travel_time / paid_or_scheduled_time", []),
  formula("occupancy", "Occupancy rate", "property", "occupied_unit_days / rentable_unit_days", []),
  formula("noi", "Net operating income", "property", "operating_income - operating_expenses", ["exclude financing and capital expenditures when using standard NOI convention"]),
  formula("collection_rate", "Collection rate", "property", "payments_collected / payments_due", []),
  formula("route_cost", "Fleet route objective", "optimization", "distance_cost + travel_time_cost + lateness_penalty + overtime_penalty + unserved_penalty", ["capacity, skills, time windows and legal limits are hard constraints"]),
  formula("haversine", "Great-circle distance", "geospatial", "2R * asin(sqrt(sin^2((lat2-lat1)/2) + cos(lat1)*cos(lat2)*sin^2((lon2-lon1)/2)))", ["use radians; routing distance still requires a road network"]),
  formula("earned_value_cpi", "Cost performance index", "construction", "earned_value / actual_cost", []),
  formula("earned_value_spi", "Schedule performance index", "construction", "earned_value / planned_value", []),
  formula("pert_expected", "PERT expected duration", "planning", "(optimistic + 4*most_likely + pessimistic) / 6", ["an estimate aid, not a deterministic actual duration"]),
  formula("little_law", "Little's Law", "operations", "work_in_process = throughput_rate * cycle_time", ["requires a stable system over the observation period"]),
  formula("lead_score", "Explainable lead score", "growth", "sum(normalized_signal_i * approved_weight_i) - disqualifier_penalties", ["exclude sensitive/protected attributes and retain factor evidence"]),
  formula("campaign_roi", "Incremental campaign ROI", "growth", "(incremental_contribution - campaign_cost) / campaign_cost", ["prefer holdout or credible counterfactual over raw attribution"]),
  formula("donor_retention", "Donor retention", "fundraising", "retained_prior_period_donors / prior_period_donors", []),
  formula("customer_health", "Deterministic customer health", "customer_success", "weighted(usage_outcomes, payment_health, support_friction, workflow_completion, breadth)", ["use explicit business signals; never infer sensitive personal traits"]),
  formula("error_budget", "SLO error budget", "reliability", "1 - target_availability", ["measure over a defined rolling or calendar window"]),
  formula("security_risk", "Deterministic security risk priority", "security", "likelihood * impact * exposure * control_gap", ["use bounded scales and record the contributing evidence"]),
  formula("audio_beat_alignment", "Beat-cut alignment", "media", "aligned_edit_points / eligible_edit_points", ["define beat tolerance window and minimum eligible count"]),
  formula("video_pacing", "Average shot duration", "media", "program_duration / detected_shot_count", ["distribution/variance matters in addition to the mean"]),
  formula("music_pitch_class_distance", "Pitch-class distance", "music_theory", "min((a-b) mod 12, (b-a) mod 12)", ["use alongside scale/chord context; distance alone does not determine musical quality"])
]);

const ALGORITHMS = Object.freeze([
  algorithm("constraint_solver", "Constraint satisfaction / optimization", "deterministic_inputs_reproducible_with_solver_config", ["routing", "shift scheduling", "job-shop scheduling", "task assignment", "room/venue scheduling"], "Prefer before custom genetic search for constrained operations."),
  algorithm("milp", "Mixed-integer linear programming", "deterministic_model", ["capacity planning", "production mix", "allocation", "network flow"], "Use where objectives and constraints can be expressed linearly."),
  algorithm("min_cost_flow", "Min-cost flow", "deterministic", ["assignment", "shipping", "supply routing", "resource allocation"], "Strong fit for network allocation problems."),
  algorithm("dijkstra_astar", "Dijkstra / A* graph search", "deterministic", ["pathfinding", "network routing", "game navigation", "facility/city graphs"], "A* requires an admissible/consistent heuristic for standard optimality guarantees."),
  algorithm("critical_path", "Critical Path Method", "deterministic", ["construction", "production", "launch plans", "media production"], "Compute earliest/latest starts and zero-float critical tasks."),
  algorithm("hungarian", "Hungarian assignment", "deterministic", ["worker-task matching", "room assignment", "basic dispatch"], "Use for one-to-one assignment before heavier general solvers."),
  algorithm("ewma_cusum", "EWMA / CUSUM statistical monitoring", "deterministic_statistical", ["quality control", "sensor monitoring", "service reliability", "security signals"], "Thresholds must be calibrated from representative baseline data."),
  algorithm("kalman", "Kalman filtering", "deterministic_given_model_and_measurements", ["GPS smoothing", "sensor fusion", "tracking"], "Model/process noise assumptions must be explicit."),
  algorithm("fsrs", "FSRS spaced repetition", "trained_deterministic_scheduler", ["study", "training", "music theory practice", "language learning"], "Use maintained FSRS implementation/version rather than inventing a proprietary memory curve."),
  algorithm("rule_engine", "Rules / decision tables", "deterministic", ["pricing floors", "approvals", "eligibility", "notifications", "warning systems", "compliance workflows"], "Version rules and store evidence for each decision."),
  algorithm("genetic", "Genetic / evolutionary optimization", "stochastic_reproducible_only_with_seed", ["layout search", "multi-objective design", "hard nonlinear scheduling experiments"], "Not the default. Use after exact/constraint methods become impractical; fix seeds/bounds and retain objective traces."),
  algorithm("monte_carlo", "Monte Carlo simulation", "stochastic_reproducible_only_with_seed", ["scenario planning", "inventory risk", "project uncertainty", "financial planning"], "Simulation is not a forecast guarantee; publish assumptions and confidence intervals."),
  algorithm("thompson_ucb", "Bandit optimization (Thompson/UCB)", "stochastic", ["content experiments", "offer experiments", "channel allocation"], "Only after measurement infrastructure exists; cap spend/actions and preserve human approval for consequential changes."),
  algorithm("perceptual_hash", "Perceptual hashing and deterministic similarity", "deterministic", ["image duplicate detection", "asset QA", "media organization"], "Similarity is not ownership/copyright determination."),
  algorithm("media_signal", "Deterministic audio/video signal analysis", "deterministic", ["loudness", "tempo/onsets", "shot changes", "motion energy", "resolution/codec QA"], "Use standard signal-processing libraries and keep raw-vs-derived provenance."),
  algorithm("rbac_abac_policy", "RBAC/ABAC policy evaluation", "deterministic", ["authorization", "tenant access", "external tools", "sensitive actions"], "Default deny; approval cannot substitute for missing authorization."),
  algorithm("idempotent_state_machine", "Idempotent finite-state workflow", "deterministic", ["payments", "generation", "ticket scans", "webhooks", "offline sync"], "Use explicit legal transitions, idempotency keys, version/CAS, dedupe and audit evidence.")
]);

const OPEN_SOURCE_CANDIDATES = Object.freeze([
  oss("timefold", "Timefold Solver", "optimization", "apache_2_verified", "strong_candidate", ["routing", "shift scheduling", "job-shop scheduling", "task assignment"]),
  oss("thingsboard", "ThingsBoard Community Edition", "iot", "apache_2_reported_by_project", "strong_candidate", ["device telemetry", "alarms", "dashboards", "digital-twin style entity relationships"]),
  oss("opensearch", "OpenSearch", "search_analytics", "apache_2_verified", "strong_candidate", ["full-text search", "vector search", "logs", "security analytics"]),
  oss("postgresql", "PostgreSQL", "database", "permissive_postgresql_license", "existing_or_strong_candidate", ["transactional data", "RLS", "JSON", "geospatial extensions", "analytics staging"]),
  oss("duckdb", "DuckDB", "analytics", "mit_reported_by_project", "strong_candidate", ["embedded analytics", "Parquet/CSV analysis", "local analytical jobs"]),
  oss("traccar", "Traccar", "gps_tracking", "license_review_before_embedding", "reference_or_adapter_candidate", ["GPS tracking", "geofences", "sensor events", "fleet alerts"]),
  oss("fleetbase", "Fleetbase", "logistics", "agpl_3_or_commercial_license", "commercial_license_or_clean_adapter", ["fleet operations", "orders", "warehousing", "driver apps"]),
  oss("eclipse_ditto", "Eclipse Ditto", "digital_twin", "license_review_before_embedding", "reference_or_service_candidate", ["device twins", "desired/reported state", "twin access policy"]),
  oss("jitsi", "Jitsi", "video_communications", "license_review_before_embedding", "adapter_candidate", ["video meetings", "screen sharing", "recording/streaming architecture"]),
  oss("asterisk", "Asterisk", "telephony", "gpl_copyleft_review", "service_boundary_candidate", ["PBX", "IVR", "SIP", "call routing"]),
  oss("matrix", "Matrix", "messaging_protocol", "open_protocol_review_implementation_licenses", "protocol_candidate", ["federated messaging", "rooms", "bots", "secure communication"]),
  oss("obs", "OBS Studio", "broadcast", "gpl_2_plus_verified", "reference_or_external_integration", ["live production", "scenes", "audio mixing", "streaming"]),
  oss("ffmpeg", "FFmpeg", "media_processing", "license_configuration_review", "strong_service_candidate", ["transcode", "probe", "filters", "audio/video processing"]),
  oss("godot", "Godot Engine", "game_xr", "mit_verified", "strong_candidate_for_separate_runtime", ["2D/3D", "games", "simulations", "XR"]),
  oss("blender", "Blender", "3d_creation", "gpl_copyleft_review", "external_tool_or_service_boundary", ["modeling", "animation", "rendering", "simulation", "video editing"]),
  oss("freecad", "FreeCAD", "cad", "license_review_before_embedding", "external_tool_or_file_interop", ["parametric CAD", "drawings", "3D-print preparation"]),
  oss("kicad", "KiCad", "eda", "gpl_copyleft_review", "external_tool_or_file_interop", ["schematics", "PCB design", "manufacturing exports"]),
  oss("open_edx", "Open edX", "learning", "copyleft_review", "reference_or_separate_service", ["courses", "LMS", "course authoring", "learning analytics"]),
  oss("openproject", "OpenProject", "project_management", "gpl_3_verified", "reference_or_service_boundary", ["project planning", "agile", "time tracking", "portfolios"]),
  oss("mautic", "Mautic", "marketing_automation", "copyleft_review", "reference_or_service_boundary", ["campaign automation", "lead scoring", "email", "segmentation"]),
  oss("civicrm", "CiviCRM", "nonprofit_crm", "license_review_before_embedding", "reference_or_service_boundary", ["donations", "memberships", "events", "mailings"]),
  oss("pretix", "pretix", "ticketing", "agpl_3_with_additional_terms", "commercial_or_service_boundary_review", ["ticketing", "QR/NFC", "offline check-in", "POS", "vouchers"]),
  oss("wazuh", "Wazuh", "security", "copyleft_or_component_license_review", "internal_security_candidate", ["XDR/SIEM", "endpoint monitoring", "vulnerability/configuration assessment"]),
  oss("qgis", "QGIS", "gis", "gpl_copyleft_review", "external_tool_or_file_interop", ["GIS analysis", "cartography", "city/service-area planning"]),
  oss("open_meteo", "Open-Meteo", "weather", "data_and_server_terms_differ", "adapter_or_self_host_with_license_review", ["forecast", "historical weather", "weather-derived operations"]),
  oss("openmrs", "OpenMRS", "health_interoperability", "license_and_compliance_review", "partner_only", ["clinical record interoperability", "FHIR/REST reference"]),
  oss("lean", "QuantConnect LEAN", "trading_research", "license_review_before_productization", "research_backtest_only_initially", ["backtesting", "paper trading", "market research"])
]);

function getIndustryAlgorithmExpansion() {
  const industries = INDUSTRIES.map(clone).map((item) => ({
    ...item,
    internalValueScore: scoreOpportunity(item.score)
  })).sort((a, b) => b.internalValueScore - a.internalValueScore || a.name.localeCompare(b.name));

  return {
    version: "2026-09-16",
    authority: "non_executing_strategy_and_formula_registry",
    scoring: {
      meaning: "internal strategy heuristic, not a market forecast or guarantee",
      inputScale: "1_to_5",
      positiveWeights: { ...POSITIVE_WEIGHTS },
      riskWeights: { ...RISK_WEIGHTS }
    },
    counts: {
      industries: industries.length,
      formulas: FORMULAS.length,
      algorithms: ALGORITHMS.length,
      openSourceCandidates: OPEN_SOURCE_CANDIDATES.length,
      priorities: countBy(industries, "priority")
    },
    industries,
    formulas: FORMULAS.map(clone),
    algorithms: ALGORITHMS.map(clone),
    openSourceCandidates: OPEN_SOURCE_CANDIDATES.map(clone),
    platformFabric: [
      "identity_and_trust",
      "tenant_business_graph",
      "authorization_entitlements",
      "workflow_and_approval_engine",
      "formula_and_optimization_engine",
      "integration_tool_gateway",
      "commerce_and_billing",
      "communications",
      "media_and_creation",
      "geospatial_iot_and_device_events",
      "analytics_observability_and_search",
      "learning_and_training",
      "extension_marketplace",
      "product_shells_and_industry_packs"
    ],
    highestValueSequence: [
      "shared deterministic formula/optimization engine",
      "logistics/fleet + field-service primitives",
      "manufacturing/inventory/quality/IoT primitives",
      "construction/trades pack from field-service primitives",
      "retail/POS and venue/event commerce primitives",
      "creator/media/broadcast processing and commerce",
      "property/rental and multi-location operations",
      "communications/training/community adapters",
      "geospatial/weather/satellite operational overlays",
      "gaming/XR/simulation as a cross-industry experience engine",
      "health and trading remain partner/research constrained until dedicated compliance/risk gates exist"
    ]
  };
}

function scoreOpportunity(score) {
  const positive = weighted(score, POSITIVE_WEIGHTS);
  const risk = weighted(score, RISK_WEIGHTS);
  return Math.max(0, Math.min(100, Math.round((positive / 5) * 100 - (risk / 5) * 30)));
}

function weighted(score, weights) {
  let total = 0;
  let divisor = 0;
  for (const [key, weight] of Object.entries(weights)) {
    total += Number(score[key] || 0) * weight;
    divisor += weight;
  }
  return divisor ? total / divisor : 0;
}

function scores(willingnessToPay, recurringFrequency, workflowDepth, reusablePrimitives, grossMarginPotential, retentionPotential, openSourceLeverage, distributionLeverage, buildComplexity, complianceRisk, supportBurden, integrationVolatility) {
  return Object.freeze({
    willingnessToPay,
    recurringFrequency,
    workflowDepth,
    reusablePrimitives,
    grossMarginPotential,
    retentionPotential,
    openSourceLeverage,
    distributionLeverage,
    buildComplexity,
    complianceRisk,
    supportBurden,
    integrationVolatility
  });
}

function industry(input) {
  return Object.freeze({
    key: input.key,
    name: input.name,
    priority: input.priority,
    customers: Object.freeze([...(input.customers || [])]),
    revenue: Object.freeze([...(input.revenue || [])]),
    primitives: Object.freeze([...(input.primitives || [])]),
    addOns: Object.freeze([...(input.addOns || [])]),
    boundaries: Object.freeze([...(input.boundaries || [])]),
    score: input.score
  });
}

function formula(key, name, domain, expression, assumptions) {
  return Object.freeze({ key, name, domain, expression, assumptions: Object.freeze([...(assumptions || [])]) });
}

function algorithm(key, name, reproducibility, useCases, boundary) {
  return Object.freeze({ key, name, reproducibility, useCases: Object.freeze([...useCases]), boundary });
}

function oss(key, name, domain, licenseClass, recommendation, uses) {
  return Object.freeze({ key, name, domain, licenseClass, recommendation, uses: Object.freeze([...uses]) });
}

function countBy(records, field) {
  const output = {};
  for (const record of records) output[record[field]] = (output[record[field]] || 0) + 1;
  return output;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = {
  PRIORITY,
  INDUSTRIES,
  FORMULAS,
  ALGORITHMS,
  OPEN_SOURCE_CANDIDATES,
  POSITIVE_WEIGHTS,
  RISK_WEIGHTS,
  getIndustryAlgorithmExpansion,
  scoreOpportunity
};

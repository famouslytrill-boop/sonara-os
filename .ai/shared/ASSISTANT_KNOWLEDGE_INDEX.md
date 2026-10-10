# SONARA Shared Assistant Knowledge Index

> GENERATED FILE — `scripts/generate-assistant-knowledge-index.mjs`. Run `node scripts/generate-assistant-knowledge-index.mjs` to refresh; run with `--check` to reject a stale index. Do not hand-edit.

## Loading contract for Claude Code, ChatGPT and Codex

1. Start with `AGENTS.md` (non-negotiable repository rules), then `CLAUDE.md` where supported, `.ai/shared/PROJECT_MEMORY.md`, and this index.
2. Use this index to locate a task-specific source. Read its actual contents before applying it; names and formula keys are discovery metadata only.
3. Claude Code can discover repository skills in `.claude/skills/`. Codex/ChatGPT must have repository access and use `AGENTS.md` plus these references; committing files does not silently update account-wide memories or install an app.
4. Distinguish a research design, a registered formula, a tested executable handler, and a production-activated capability. No listing below grants authorization.
5. Prefer the source code and tests over prose summaries. Keep tenant isolation, human approval, provider credentials, licensing, provenance, pricing and release gates intact.

## Canonical SONARA skill procedures (15)

- `.ai/shared/EXTERNAL_TOOL_RESEARCH_SKILL.md`
- `.ai/shared/SOURCE_GROUNDED_RESEARCH_SKILL.md`
- `.claude/skills/adding-a-record-page/SKILL.md`
- `.claude/skills/checks-that-cannot-lie/SKILL.md`
- `.claude/skills/comparing-sonara-to-a-competitor/SKILL.md`
- `.claude/skills/creator-daw-interoperability/SKILL.md`
- `.claude/skills/designing-governed-product-workflows/SKILL.md`
- `.claude/skills/diagnosing-sonara-customer-flows/SKILL.md`
- `.claude/skills/governed-batch-convergence/SKILL.md`
- `.claude/skills/researching-screenshot-tools/SKILL.md`
- `.claude/skills/reviewing-an-outside-repository/SKILL.md`
- `.claude/skills/reviewing-premium-sonara-ui/SKILL.md`
- `.claude/skills/source-grounded-research/SKILL.md`
- `.claude/skills/writing-a-social-post-for-sonara/SKILL.md`
- `.claude/skills/writing-sonara-marketing-copy/SKILL.md`

Shared skills are reference procedures for both assistants; `.claude/skills/` manifests are Claude-discoverable workflows. An external skill still requires licence and security review before adaptation.

## Generated Codex skill bridges (16)

- `.agents/skills/adding-a-record-page/SKILL.md`
- `.agents/skills/checks-that-cannot-lie/SKILL.md`
- `.agents/skills/comparing-sonara-to-a-competitor/SKILL.md`
- `.agents/skills/creator-daw-interoperability/SKILL.md`
- `.agents/skills/designing-governed-product-workflows/SKILL.md`
- `.agents/skills/diagnosing-sonara-customer-flows/SKILL.md`
- `.agents/skills/governed-batch-convergence/SKILL.md`
- `.agents/skills/researching-screenshot-tools/SKILL.md`
- `.agents/skills/reviewing-an-outside-repository/SKILL.md`
- `.agents/skills/reviewing-premium-sonara-ui/SKILL.md`
- `.agents/skills/sonara-external-tool-intake/SKILL.md`
- `.agents/skills/sonara-formula-evidence/SKILL.md`
- `.agents/skills/sonara-source-grounding/SKILL.md`
- `.agents/skills/source-grounded-research/SKILL.md`
- `.agents/skills/writing-a-social-post-for-sonara/SKILL.md`
- `.agents/skills/writing-sonara-marketing-copy/SKILL.md`

Codex bridge files load the canonical full skill from the current authorized repository. For standalone API skills, generate separate offline bundles using `scripts/export-assistant-model-skill-packs.mjs`.

## Catalogued formula and agent-strategy keys

Keys below are **scoped by source**, not global identifiers. The same key can have different definitions, units or eligibility in different modules. Never select a formula solely by name.

### Formula definitions (registered) — 110 keys

Source: `lib/sonara-formula-library.cjs`

`gross_revenue`, `net_revenue`, `monthly_recurring_revenue`, `average_order_value`, `conversion_rate`, `churn_rate`, `customer_lifetime_value`, `customer_acquisition_cost`, `ltv_to_cac_ratio`, `food_cost_percent`, `gross_margin_percent`, `recipe_unit_cost`, `menu_item_profit`, `waste_cost`, `prime_cost_percent`, `break_even_sales`, `shift_hours`, `regular_pay`, `overtime_pay`, `labor_cost_percent`, `wage_projection`, `employee_productivity`, `reorder_point`, `inventory_turnover`, `stockout_risk_score`, `vendor_total_cost`, `route_cost`, `delivery_profit`, `lead_score`, `campaign_roi`, `follow_up_priority`, `email_reply_rate`, `booking_conversion`, `prompt_specificity_score`, `song_readiness_score`, `originality_guard_score`, `release_readiness_score`, `audio_job_completion`, `transcript_confidence_average`, `device_capability_score`, `motion_safety_score`, `setup_readiness_percent`, `module_health_score`, `next_best_step_score`, `workflow_priority_score`, `risk_adjusted_value`, `proof_strength_score`, `expected_loss`, `smoothed_demand_level`, `service_capacity_jobs`, `media_duration_seconds`, `media_payload_mebibytes`, `tracked_motion_speed`, `kinetic_energy_joules`, `dilution_stock_volume`, `render_time_estimate_seconds`, `uncompressed_image_bytes`, `average_acceleration`, `rectangle_area_square_meters`, `loaded_labor_cost`, `weekly_wage_projection`, `billable_utilization_percent`, `opportunity_value_gap`, `project_unit_margin_percent`, `material_quantity_with_waste`, `concrete_volume_cubic_yards`, `crew_duration_hours`, `trade_job_cost`, `length_meters_from_feet`, `data_transfer_seconds`, `base64_encoded_bytes`, `quantum_qubit_layer_shots`, `earth_circular_orbit_period_minutes`, `telescope_diffraction_arcseconds`, `math_triangle_area_m2`, `math_circle_area_m2`, `math_hypotenuse_m`, `math_compound_future_value`, `math_weighted_grade_percent`, `math_probability_union_percent`, `stem_ohms_voltage_v`, `stem_electrical_power_w`, `stem_wave_speed_mps`, `stem_material_density_kg_m3`, `social_population_density_km2`, `social_population_change_percent`, `social_school_participation_percent`, `social_voter_turnout_percent`, `social_map_scale_distance_m`, `language_reading_wpm`, `language_lexical_diversity_percent`, `language_flesch_reading_ease`, `language_source_coverage_percent`, `arts_beat_duration_seconds`, `arts_frame_count`, `arts_print_dpi`, `arts_frame_aspect_ratio`, `pe_met_minutes`, `pe_pace_minutes_per_km`, `pe_estimated_kcal`, `cad_paper_to_model_mm`, `cad_distance_3d_mm`, `cad_cylinder_volume_mm3`, `cad_inches_to_millimeters`, `cad_feet_to_millimeters`, `mocap_marker_speed_mps`, `mocap_sample_interval_ms`, `mocap_joint_angle_degrees`, `mocap_frame_coverage_percent`, `mocap_nyquist_hz`

### Industry research formulas (non-executing register) — 40 keys

Source: `lib/sonara-industry-algorithm-expansion.cjs`

`opportunity_score`, `contribution_margin`, `ltv_simple`, `cac_payback`, `activation_rate`, `retention_rate`, `break_even_units`, `target_margin_price`, `eoq`, `reorder_point`, `gmroi`, `sell_through`, `basket_lift`, `oee`, `takt_time`, `first_pass_yield`, `cp`, `cpk`, `food_cost_pct`, `recipe_cost`, `labor_utilization`, `travel_ratio`, `occupancy`, `noi`, `collection_rate`, `route_cost`, `haversine`, `earned_value_cpi`, `earned_value_spi`, `pert_expected`, `little_law`, `lead_score`, `campaign_roi`, `donor_retention`, `customer_health`, `error_budget`, `security_risk`, `audio_beat_alignment`, `video_pacing`, `music_pitch_class_distance`

### Financial decision-support formulas — 11 keys

Source: `lib/sonara-financial-intelligence-formulas.cjs`

`net_cash_flow`, `monthly_net_burn`, `runway_months`, `gross_margin_percent`, `period_growth_percent`, `customer_acquisition_cost`, `simple_ltv`, `burn_multiple`, `revenue_concentration_percent`, `scenario_runway`, `data_quality_flags`

### Allowlisted executable formula handlers — 40 keys

Source: `lib/sonara-formula-engine.cjs`

`opportunity_score`, `contribution_margin`, `ltv_simple`, `cac_payback`, `activation_rate`, `retention_rate`, `break_even_units`, `target_margin_price`, `eoq`, `reorder_point`, `gmroi`, `sell_through`, `basket_lift`, `oee`, `takt_time`, `first_pass_yield`, `cp`, `cpk`, `food_cost_pct`, `recipe_cost`, `labor_utilization`, `travel_ratio`, `occupancy`, `noi`, `collection_rate`, `route_cost`, `haversine`, `earned_value_cpi`, `earned_value_spi`, `pert_expected`, `little_law`, `lead_score`, `campaign_roi`, `donor_retention`, `customer_health`, `error_budget`, `security_risk`, `audio_beat_alignment`, `video_pacing`, `music_pitch_class_distance`

### Agent architecture patterns (strategy, not permission) — 5 keys

Source: `lib/sonara-agent-skill-strategies.cjs`

`single_shot`, `iterative_react`, `planner_executor`, `reflexive`, `verifier_gated`

### Business AI strategy catalogue (not runtime permission) — 10 keys

Source: `lib/sonara-agent-skill-strategies.cjs`

`ai_assisted_app_building`, `agentic_workflows`, `context_engineering`, `rag_business_knowledge`, `ai_evaluation`, `workflow_automation`, `data_analysis_with_ai`, `multimodal_ai`, `ai_security_approvals`, `system_thinking_deployment`

### Repository agent skill strategies (not runtime permission) — 14 keys

Source: `lib/sonara-agent-skill-strategies.cjs`

`governed_batch_convergence`, `governed_product_workflow_design`, `commercial_open_source_adoption`, `provider_model_selection`, `learning_memory_governance`, `creator_media_pipeline`, `growth_campaign_execution`, `business_operations_delivery`, `authorized_security_review`, `release_evidence_delivery`, `agent_execution_pattern_routing`, `business_ai_capability_delivery`, `reusable_agent_skill_contracts`, `typed_business_decisions`

### Formula planning table (documentation; verify actual execution) — 47 keys

Source: `docs/sonara-formula-table-library.md`

`gross_revenue`, `net_revenue`, `monthly_recurring_revenue`, `average_order_value`, `conversion_rate`, `churn_rate`, `customer_lifetime_value`, `customer_acquisition_cost`, `ltv_to_cac_ratio`, `food_cost_percent`, `gross_margin_percent`, `recipe_unit_cost`, `menu_item_profit`, `waste_cost`, `prime_cost_percent`, `break_even_sales`, `shift_hours`, `regular_pay`, `overtime_pay`, `labor_cost_percent`, `wage_projection`, `employee_productivity`, `reorder_point`, `inventory_turnover`, `stockout_risk_score`, `vendor_total_cost`, `route_cost`, `delivery_profit`, `lead_score`, `campaign_roi`, `follow_up_priority`, `email_reply_rate`, `booking_conversion`, `prompt_specificity_score`, `song_readiness_score`, `originality_guard_score`, `release_readiness_score`, `audio_job_completion`, `transcript_confidence_average`, `device_capability_score`, `motion_safety_score`, `setup_readiness_percent`, `module_health_score`, `next_best_step_score`, `workflow_priority_score`, `risk_adjusted_value`, `proof_strength_score`

## Other formula and quantitative source modules (27)

This is a file-level discovery inventory; additional equations can occur inside these files. Check tests, required units, source lineage, input validation, tenant scope, zero denominators, and whether an operation is authorized.

- `lib/sonara-activation-metrics.cjs`
- `lib/sonara-applied-formulas.cjs`
- `lib/sonara-deterministic-capacity-planner.cjs`
- `lib/sonara-deterministic-risk-assessment.cjs`
- `lib/sonara-engineering-formulas.cjs`
- `lib/sonara-event-resource-scenario.cjs`
- `lib/sonara-financial-intelligence-formulas.cjs`
- `lib/sonara-financial-scenario-math.cjs`
- `lib/sonara-formula-engine.cjs`
- `lib/sonara-formula-library.cjs`
- `lib/sonara-formula-pages.cjs`
- `lib/sonara-game-risk-paper-trading.cjs`
- `lib/sonara-goal-science.cjs`
- `lib/sonara-industry-algorithm-expansion.cjs`
- `lib/sonara-inventory-science.cjs`
- `lib/sonara-inventory-stock.cjs`
- `lib/sonara-labour-cost.cjs`
- `lib/sonara-lease-statutory-formulas.cjs`
- `lib/sonara-operations-science.cjs`
- `lib/sonara-pay-period-engine.cjs`
- `lib/sonara-rate-budget-math.cjs`
- `lib/sonara-research-formula-blueprints.cjs`
- `lib/sonara-resource-budget-store.cjs`
- `lib/sonara-restaurant-capacity-science.cjs`
- `lib/sonara-review-moderation-metrics.cjs`
- `lib/sonara-security-geometry-formulas.cjs`
- `lib/sonara-spreadsheet-formulas.cjs`

## Formula planning and migration evidence

- `docs/CODEX_HANDOFF_SKILLS_FORMULAS_AGENTS.md`
- `docs/sonara-formula-table-library.md`
- `supabase/migrations/20260621020200_sonara_formula_table_library.sql`
- `supabase/migrations/20261004130000_seed_bounded_planning_formulas.sql`
- `supabase/migrations/20261007110000_every_formula_can_be_saved.sql`
- `supabase/migrations/20261009170000_applied_cost_trade_and_science_formulas.sql`
- `supabase/migrations/20261009180000_education_stem_cad_mocap_formulas.sql`
- `supabase/migrations/20261010181849_seed_engineering_formulas.sql`

## Authoritative verification and handoff

- `docs/HANDOFF_PROMPT.md` — generated repository state; update only through its generator.
- `docs/CODEX_HANDOFF_SKILLS_FORMULAS_AGENTS.md` — engineering method and falsification discipline; historical counts may be stale.
- `docs/SPRINT_LOG.md` — decision history, not proof of production release.
- `scripts/verify-adapted-skills.mjs` — external-skill licence/provenance gate.
- `scripts/verify-agent-development-sync.mjs` — shared state gate, including this index via `--check`.
- `lib/sonara-agent-authority.cjs` and `lib/sonara-agent-runner.cjs` — owner approval and execution boundaries.

## Status discipline

Do not call a file listing an implementation, a registered expression an executable calculation, a mocked test an integration proof, or a drafted formula a licensed/regulatory determination. Re-derive state from the current revision and independent real-path tests.

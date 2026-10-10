// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { APPLIED_FORMULAS, AppliedFormulaInputError } = require("./sonara-applied-formulas.cjs");
const { EDUCATION_FORMULAS, EducationFormulaInputError } = require("./sonara-education-stem-cad-mocap.cjs");
const { FORMULAS: ENGINEERING_FORMULAS, EVALUATORS: ENGINEERING_EVALUATORS, PRECISE_FORMULA_KEYS: ENGINEERING_PRECISE_KEYS } = require("./sonara-engineering-formulas.cjs");

const FORMULA_DEFINITIONS = [
  f("gross_revenue", "business_revenue", "Business Builder", "Gross revenue", "sum(order_total)", ["order_total"], ["pos_sales_summaries", "billing_subscriptions"], "money"),
  f("net_revenue", "business_revenue", "Business Builder", "Net revenue", "gross_revenue - refunds - discounts - fees", ["gross_revenue", "refunds", "discounts", "fees"], ["pos_sales_summaries", "billing_webhook_events"], "money"),
  f("monthly_recurring_revenue", "business_revenue", "SONARA Admin", "Monthly recurring revenue", "sum(active_subscription_monthly_amount)", ["active_subscription_monthly_amount"], ["billing_subscriptions"], "money_per_month"),
  f("average_order_value", "business_revenue", "Business Builder", "Average order value", "gross_revenue / order_count", ["gross_revenue", "order_count"], ["pos_sales_summaries"], "money"),
  f("conversion_rate", "growth_marketing", "Growth Studio", "Conversion rate", "(conversions / visitors) * 100", ["conversions", "visitors"], ["growth_campaigns", "growth_leads"], "percent"),
  f("churn_rate", "business_revenue", "SONARA Admin", "Churn rate", "(lost_customers / starting_customers) * 100", ["lost_customers", "starting_customers"], ["billing_subscriptions"], "percent"),
  f("customer_lifetime_value", "business_revenue", "Business Builder", "Customer lifetime value", "average_order_value * purchase_frequency * customer_lifespan", ["average_order_value", "purchase_frequency", "customer_lifespan"], ["customer_records", "pos_sales_summaries"], "money"),
  f("customer_acquisition_cost", "growth_marketing", "Growth Studio", "Customer acquisition cost", "marketing_spend / new_customers", ["marketing_spend", "new_customers"], ["growth_campaigns", "growth_leads"], "money"),
  f("ltv_to_cac_ratio", "growth_marketing", "Growth Studio", "LTV to CAC ratio", "customer_lifetime_value / customer_acquisition_cost", ["customer_lifetime_value", "customer_acquisition_cost"], ["growth_campaigns", "customer_records"], "ratio"),
  f("food_cost_percent", "restaurant_margin", "Business Builder", "Food cost", "(ingredient_cost / menu_price) * 100", ["ingredient_cost", "menu_price"], ["recipe_cards", "recipe_ingredients", "menu_items"], "percent"),
  f("gross_margin_percent", "restaurant_margin", "Business Builder", "Gross margin", "((sale_price - cost) / sale_price) * 100", ["sale_price", "cost"], ["menu_items", "inventory_items"], "percent"),
  f("recipe_unit_cost", "restaurant_margin", "Business Builder", "Recipe cost", "sum(ingredient_quantity * ingredient_unit_cost)", ["ingredients"], ["recipe_cards", "recipe_ingredients"], "money"),
  f("menu_item_profit", "restaurant_margin", "Business Builder", "Menu item profit", "menu_price - recipe_unit_cost - packaging_cost - payment_fee", ["menu_price", "recipe_unit_cost", "packaging_cost", "payment_fee"], ["menu_items", "recipe_cards"], "money"),
  f("waste_cost", "restaurant_margin", "Business Builder", "Waste cost", "waste_quantity * unit_cost", ["waste_quantity", "unit_cost"], ["waste_logs", "inventory_items"], "money"),
  f("prime_cost_percent", "restaurant_margin", "Business Builder", "Prime cost", "((food_cost + labor_cost) / sales) * 100", ["food_cost", "labor_cost", "sales"], ["daily_profit_snapshots", "employee_time_entries"], "percent"),
  f("break_even_sales", "restaurant_margin", "Business Builder", "Break-even sales", "fixed_costs / gross_margin_percent_decimal", ["fixed_costs", "gross_margin_percent_decimal"], ["daily_profit_snapshots"], "money"),
  f("shift_hours", "employee_payroll", "Business Builder", "Shift hours", "(clock_out - clock_in) - unpaid_break_hours", ["clock_in", "clock_out", "unpaid_break_hours"], ["employee_time_entries"], "hours"),
  f("regular_pay", "employee_payroll", "Business Builder", "Regular pay", "regular_hours * hourly_rate", ["regular_hours", "hourly_rate"], ["employee_time_entries", "employee_wage_rates"], "money"),
  f("overtime_pay", "employee_payroll", "Business Builder", "Overtime pay", "overtime_hours * hourly_rate * overtime_multiplier", ["overtime_hours", "hourly_rate", "overtime_multiplier"], ["employee_time_entries", "employee_wage_rates"], "money"),
  f("labor_cost_percent", "employee_payroll", "Business Builder", "Labor cost", "(labor_cost / sales) * 100", ["labor_cost", "sales"], ["employee_pay_statements", "daily_profit_snapshots"], "percent"),
  f("wage_projection", "employee_payroll", "Business Builder", "Wage projection", "scheduled_hours * hourly_rate", ["scheduled_hours", "hourly_rate"], ["employee_shifts", "employee_wage_rates"], "money"),
  f("employee_productivity", "employee_payroll", "Business Builder", "Employee productivity", "sales / labor_hours", ["sales", "labor_hours"], ["employee_time_entries", "pos_sales_summaries"], "money_per_hour"),
  f("reorder_point", "inventory_operations", "Business Builder", "Reorder point", "(average_daily_usage * lead_time_days) + safety_stock", ["average_daily_usage", "lead_time_days", "safety_stock"], ["inventory_items", "vendor_accounts"], "quantity"),
  f("inventory_turnover", "inventory_operations", "Business Builder", "Inventory turnover", "cost_of_goods_sold / average_inventory_value", ["cost_of_goods_sold", "average_inventory_value"], ["inventory_items", "daily_profit_snapshots"], "ratio"),
  f("stockout_risk_score", "inventory_operations", "Business Builder", "Stockout risk", "max(0, reorder_point - current_stock)", ["reorder_point", "current_stock"], ["inventory_items"], "score"),
  f("vendor_total_cost", "inventory_operations", "Business Builder", "Vendor total cost", "item_cost + shipping + fees - discounts", ["item_cost", "shipping", "fees", "discounts"], ["vendor_invoices"], "money"),
  f("route_cost", "inventory_operations", "Business Builder", "Route cost", "(distance_miles * cost_per_mile) + driver_labor + tolls", ["distance_miles", "cost_per_mile", "driver_labor", "tolls"], ["vehicle_records", "route_tracking_sessions"], "money"),
  f("delivery_profit", "inventory_operations", "Business Builder", "Delivery profit", "delivery_revenue - route_cost - packaging_cost", ["delivery_revenue", "route_cost", "packaging_cost"], ["route_tracking_sessions", "pos_sales_summaries"], "money"),
  f("lead_score", "growth_marketing", "Growth Studio", "Lead score", "fit_score + urgency_score + engagement_score - risk_score", ["fit_score", "urgency_score", "engagement_score", "risk_score"], ["growth_leads"], "score"),
  f("campaign_roi", "growth_marketing", "Growth Studio", "Campaign return", "((campaign_revenue - campaign_cost) / campaign_cost) * 100", ["campaign_revenue", "campaign_cost"], ["growth_campaigns"], "percent"),
  f("follow_up_priority", "growth_marketing", "Growth Studio", "Follow-up priority", "lead_score + days_since_contact_weight + value_weight", ["lead_score", "days_since_contact_weight", "value_weight"], ["growth_leads"], "score"),
  f("email_reply_rate", "growth_marketing", "Growth Studio", "Email reply rate", "(replies / delivered_messages) * 100", ["replies", "delivered_messages"], ["growth_campaigns"], "percent"),
  f("booking_conversion", "growth_marketing", "Growth Studio", "Booking conversion", "(bookings / booking_page_visits) * 100", ["bookings", "booking_page_visits"], ["business_appointments", "growth_campaigns"], "percent"),
  f("prompt_specificity_score", "creator_music", "Creator Studio", "Prompt strength", "key + rhythmic_feel + harmonic_identity + drum_language + vocal_mode", ["key", "rhythmic_feel", "harmonic_identity", "drum_language", "vocal_mode"], ["creator_prompt_packs", "creator_song_blueprints"], "score"),
  f("song_readiness_score", "creator_music", "Creator Studio", "Song readiness", "lyrics_score + production_score + arrangement_score + mix_notes_score + release_fit_score", ["lyrics_score", "production_score", "arrangement_score", "mix_notes_score", "release_fit_score"], ["creator_song_blueprints"], "score"),
  f("originality_guard_score", "creator_music", "Creator Studio", "Originality guard", "100 - similarity_risk_score", ["similarity_risk_score"], ["creator_quality_checks"], "score"),
  f("release_readiness_score", "creator_music", "Creator Studio", "Release readiness", "metadata + cover_art + audio_master + video_assets + distribution_checklist", ["metadata", "cover_art", "audio_master", "video_assets", "distribution_checklist"], ["creator_release_packages"], "score"),
  f("audio_job_completion", "creator_music", "Creator Studio", "Audio job progress", "(completed_steps / total_steps) * 100", ["completed_steps", "total_steps"], ["music_ai_jobs", "audio_analysis_reports"], "percent"),
  f("transcript_confidence_average", "creator_music", "Creator Studio", "Transcript confidence", "avg(segment_confidence)", ["segment_confidence"] , ["audio_transcription_segments"], "percent"),
  f("device_capability_score", "ui_device_experience", "SONARA UI", "Device capability", "gpu_score + memory_score + touch_score + motion_support + audio_support", ["gpu_score", "memory_score", "touch_score", "motion_support", "audio_support"], ["app_experience_settings"], "score"),
  f("motion_safety_score", "ui_device_experience", "SONARA UI", "Motion safety", "reduced_motion_enabled ? 100 : animation_intensity_score", ["reduced_motion_enabled", "animation_intensity_score"], ["app_experience_settings"], "score"),
  f("setup_readiness_percent", "ui_device_experience", "SONARA Admin", "Setup readiness", "(ready_checks / total_checks) * 100", ["ready_checks", "total_checks"], ["sonara_control_plane_checks"], "percent"),
  f("module_health_score", "ui_device_experience", "SONARA Admin", "Tool health", "route_score + table_score + permission_score + test_score + integration_score", ["route_score", "table_score", "permission_score", "test_score", "integration_score"], ["sonara_control_plane_checks"], "score"),
  f("next_best_step_score", "operating_twin", "SONARA Admin", "Next best step", "impact_score + urgency_score + confidence_score - effort_score - risk_score", ["impact_score", "urgency_score", "confidence_score", "effort_score", "risk_score"], ["module_outputs"], "score"),
  f("workflow_priority_score", "operating_twin", "SONARA Admin", "Workflow priority", "business_value + customer_value + deadline_weight - complexity", ["business_value", "customer_value", "deadline_weight", "complexity"], ["module_outputs"], "score"),
  f("risk_adjusted_value", "operating_twin", "SONARA Admin", "Risk-adjusted value", "expected_value * confidence_percent - risk_cost", ["expected_value", "confidence_percent", "risk_cost"], ["module_outputs"], "money_or_score"),
  f("proof_strength_score", "operating_twin", "Business Builder", "Proof strength", "verified_records + customer_reviews + payment_history + completion_events", ["verified_records", "customer_reviews", "payment_history", "completion_events"], ["customer_records", "billing_webhook_events", "module_outputs"], "score"),
  f("expected_loss", "operating_twin", "Business Builder", "Scenario expected loss", "event_probability * loss_amount", ["event_probability", "loss_amount"], [], "money"),
  f("smoothed_demand_level", "inventory_operations", "Business Builder", "Smoothed demand level", "alpha * observed_demand + (1 - alpha) * previous_level", ["alpha", "observed_demand", "previous_level"], [], "quantity"),
  f("service_capacity_jobs", "inventory_operations", "Business Builder", "Service capacity", "floor(available_minutes / minutes_per_job)", ["available_minutes", "minutes_per_job"], [], "jobs"),
  f("media_duration_seconds", "creator_music", "Creator Studio", "Frame duration", "frame_count / frames_per_second", ["frame_count", "frames_per_second"], [], "seconds"),
  f("media_payload_mebibytes", "creator_music", "Creator Studio", "Estimated media payload", "bitrate_bits_per_second * duration_seconds / (8 * 1048576)", ["bitrate_bits_per_second", "duration_seconds"], [], "MiB"),
  f("tracked_motion_speed", "creator_music", "Creator Studio", "Calibrated motion speed", "displacement_meters / elapsed_seconds", ["displacement_meters", "elapsed_seconds"], [], "meters_per_second"),
  f("kinetic_energy_joules", "operating_twin", "Business Builder", "Translational kinetic energy", "mass_kg * speed_meters_per_second^2 / 2", ["mass_kg", "speed_meters_per_second"], [], "joules"),
  f("dilution_stock_volume", "operating_twin", "Business Builder", "Research dilution volume", "target_concentration * final_volume / stock_concentration", ["target_concentration", "final_volume", "stock_concentration"], [], "input_volume_unit"),
  f("render_time_estimate_seconds", "creator_music", "Creator Studio", "Measured render time estimate", "frame_count / measured_frames_per_second + overhead_seconds", ["frame_count", "measured_frames_per_second", "overhead_seconds"], [], "seconds"),
  f("uncompressed_image_bytes", "creator_music", "Creator Studio", "Uncompressed image payload", "width_pixels * height_pixels * channels * bytes_per_channel", ["width_pixels", "height_pixels", "channels", "bytes_per_channel"], [], "bytes"),
  f("average_acceleration", "creator_music", "Creator Studio", "Calibrated average acceleration", "(final_velocity - initial_velocity) / elapsed_seconds", ["final_velocity", "initial_velocity", "elapsed_seconds"], [], "meters_per_second_squared"),
  f("rectangle_area_square_meters", "operating_twin", "Business Builder", "Rectangular surface area", "length_meters * width_meters", ["length_meters", "width_meters"], [], "square_meters"),
  f("loaded_labor_cost", "employee_payroll", "Business Builder", "Loaded labor cost", "paid_hours * (hourly_wage + benefits_per_hour + employer_payroll_cost_per_hour)", ["paid_hours","hourly_wage","benefits_per_hour","employer_payroll_cost_per_hour"], [], "money"),
  f("weekly_wage_projection", "employee_payroll", "Business Builder", "Weekly wage projection", "regular_hours * regular_rate + overtime_hours * regular_rate * overtime_multiplier", ["regular_hours","regular_rate","overtime_hours","overtime_multiplier"], [], "money"),
  f("billable_utilization_percent", "employee_payroll", "Business Builder", "Billable utilization", "100 * billable_hours / paid_hours", ["billable_hours","paid_hours"], [], "percent"),
  f("opportunity_value_gap", "operating_twin", "Business Builder", "Opportunity value gap", "alternative_net_value - selected_net_value", ["alternative_net_value","selected_net_value"], [], "money"),
  f("project_unit_margin_percent", "operating_twin", "Business Builder", "Project margin", "100 * (bid_revenue - direct_cost - allocated_overhead) / bid_revenue", ["bid_revenue","direct_cost","allocated_overhead"], [], "percent"),
  f("material_quantity_with_waste", "construction_trades", "Business Builder", "Material quantity including waste", "net_quantity * (1 + waste_percent / 100)", ["net_quantity","waste_percent"], [], "quantity"),
  f("concrete_volume_cubic_yards", "construction_trades", "Business Builder", "Concrete volume including waste", "length_feet * width_feet * depth_feet * (1 + waste_percent / 100) / 27", ["length_feet","width_feet","depth_feet","waste_percent"], [], "cubic_yards"),
  f("crew_duration_hours", "construction_trades", "Business Builder", "Crew duration", "labor_hours / crew_size", ["labor_hours","crew_size"], [], "hours"),
  f("trade_job_cost", "construction_trades", "Business Builder", "Trade job cost", "labor_hours * loaded_hourly_cost + material_cost + equipment_cost + permit_cost", ["labor_hours","loaded_hourly_cost","material_cost","equipment_cost","permit_cost"], [], "money"),
  f("length_meters_from_feet", "units_measurement", "Business Builder", "Feet to meters", "length_feet * 0.3048", ["length_feet"], [], "meters"),
  f("data_transfer_seconds", "computing_encoding", "Creator Studio", "Ideal transfer time", "payload_mebibytes * 1048576 * 8 / throughput_bits_per_second", ["payload_mebibytes","throughput_bits_per_second"], [], "seconds"),
  f("base64_encoded_bytes", "computing_encoding", "Creator Studio", "Base64 size", "4 * ceil(payload_bytes / 3)", ["payload_bytes"], [], "bytes"),
  f("quantum_qubit_layer_shots", "science_research", "SONARA Lab", "Quantum sampling workload proxy", "measured_qubits * circuit_depth * shot_count", ["measured_qubits","circuit_depth","shot_count"], [], "qubit_layer_shots"),
  f("earth_circular_orbit_period_minutes", "science_research", "SONARA Lab", "Ideal Earth orbit period", "2*pi*sqrt((6378.137 + altitude_km)^3 / 398600.4418) / 60", ["altitude_km"], [], "minutes"),
  f("telescope_diffraction_arcseconds", "science_research", "SONARA Lab", "Ideal telescope angular resolution", "1.22 * (wavelength_nanometers*1e-9) / (aperture_millimeters*1e-3) * 206264.80624709636", ["wavelength_nanometers","aperture_millimeters"], [], "arcseconds"),
  f("math_triangle_area_m2", "stem_mathematics", "Business Builder", "Triangle area", "base_m * height_m / 2", ["base_m","height_m"], [], "square_meters"),
  f("math_circle_area_m2", "stem_mathematics", "Creator Studio", "Circle area", "pi * radius_m^2", ["radius_m"], [], "square_meters"),
  f("math_hypotenuse_m", "stem_mathematics", "Business Builder", "Right triangle hypotenuse", "sqrt(leg_a_m^2 + leg_b_m^2)", ["leg_a_m","leg_b_m"], [], "meters"),
  f("math_compound_future_value", "stem_mathematics", "Business Builder", "Illustrative compound growth", "principal * (1 + annual_rate_percent/100)^years", ["principal","annual_rate_percent","years"], [], "money"),
  f("math_weighted_grade_percent", "stem_mathematics", "Creator Studio", "Earned points percentage", "100 * earned_points / possible_points", ["earned_points","possible_points"], [], "percent"),
  f("math_probability_union_percent", "stem_mathematics", "Creator Studio", "Union of event probabilities", "event_a_percent + event_b_percent - intersection_percent", ["event_a_percent","event_b_percent","intersection_percent"], [], "percent"),
  f("stem_ohms_voltage_v", "stem_physical_science", "Business Builder", "Ohm's law voltage", "current_amperes * resistance_ohms", ["current_amperes","resistance_ohms"], [], "volts"),
  f("stem_electrical_power_w", "stem_physical_science", "Business Builder", "DC power estimate", "voltage_volts * current_amperes", ["voltage_volts","current_amperes"], [], "watts"),
  f("stem_wave_speed_mps", "stem_physical_science", "Creator Studio", "Ideal wave propagation speed", "frequency_hz * wavelength_m", ["frequency_hz","wavelength_m"], [], "meters_per_second"),
  f("stem_material_density_kg_m3", "stem_physical_science", "Business Builder", "Material density", "mass_kg / volume_m3", ["mass_kg","volume_m3"], [], "kilograms_per_cubic_meter"),
  f("social_population_density_km2", "social_studies", "Growth Studio", "Population per square kilometer", "population_people / area_km2", ["population_people","area_km2"], [], "people_per_square_kilometer"),
  f("social_population_change_percent", "social_studies", "Growth Studio", "Population change", "100 * (current_population / previous_population - 1)", ["current_population","previous_population"], [], "percent"),
  f("social_school_participation_percent", "social_studies", "Growth Studio", "School age participation", "100 * enrolled_school_age / population_school_age", ["enrolled_school_age","population_school_age"], [], "percent"),
  f("social_voter_turnout_percent", "social_studies", "Growth Studio", "Aggregate voter turnout", "100 * ballots_cast / eligible_voters", ["ballots_cast","eligible_voters"], [], "percent"),
  f("social_map_scale_distance_m", "social_studies", "Creator Studio", "Map distance in meters", "map_distance_cm * scale_denominator / 100", ["map_distance_cm","scale_denominator"], [], "meters"),
  f("language_reading_wpm", "language_arts", "Creator Studio", "Reading pace", "word_count / elapsed_minutes", ["word_count","elapsed_minutes"], [], "words_per_minute"),
  f("language_lexical_diversity_percent", "language_arts", "Creator Studio", "Lexical diversity", "100 * unique_word_types / total_word_tokens", ["unique_word_types","total_word_tokens"], [], "percent"),
  f("language_flesch_reading_ease", "language_arts", "Creator Studio", "English Flesch reading ease", "206.835 - 1.015*(word_count/sentence_count) - 84.6*(syllable_count/word_count)", ["word_count","sentence_count","syllable_count"], [], "score"),
  f("language_source_coverage_percent", "language_arts", "Creator Studio", "Claim citation coverage", "100 * cited_claims / total_factual_claims", ["cited_claims","total_factual_claims"], [], "percent"),
  f("arts_beat_duration_seconds", "creative_arts", "Creator Studio", "Beat grid duration", "beat_count * 60 / tempo_bpm", ["beat_count","tempo_bpm"], [], "seconds"),
  f("arts_frame_count", "creative_arts", "Creator Studio", "Animation frame budget", "ceil(duration_seconds * frames_per_second)", ["duration_seconds","frames_per_second"], [], "frames"),
  f("arts_print_dpi", "creative_arts", "Creator Studio", "Print resolution", "image_width_pixels / print_width_inches", ["image_width_pixels","print_width_inches"], [], "dots_per_inch"),
  f("arts_frame_aspect_ratio", "creative_arts", "Creator Studio", "Picture aspect ratio", "frame_width_pixels / frame_height_pixels", ["frame_width_pixels","frame_height_pixels"], [], "ratio"),
  f("pe_met_minutes", "physical_education", "Creator Studio", "Activity MET-minutes", "activity_minutes * met_value", ["activity_minutes","met_value"], [], "met_minutes"),
  f("pe_pace_minutes_per_km", "physical_education", "Creator Studio", "Average walking or running pace", "elapsed_minutes / distance_km", ["elapsed_minutes","distance_km"], [], "minutes_per_kilometer"),
  f("pe_estimated_kcal", "physical_education", "Creator Studio", "Illustrative activity energy", "met_value * 3.5 * body_mass_kg * activity_minutes / 200", ["met_value","body_mass_kg","activity_minutes"], [], "kilocalories"),
  f("cad_paper_to_model_mm", "cad_geometry", "Business Builder", "CAD plotted scale distance", "drawing_length_mm * scale_denominator", ["drawing_length_mm","scale_denominator"], [], "millimeters"),
  f("cad_distance_3d_mm", "cad_geometry", "Business Builder", "CAD 3D displacement", "sqrt(delta_x^2 + delta_y^2 + delta_z^2)", ["delta_x","delta_y","delta_z"], [], "millimeters"),
  f("cad_cylinder_volume_mm3", "cad_geometry", "Business Builder", "CAD cylindrical volume", "pi * radius_mm^2 * height_mm", ["radius_mm","height_mm"], [], "cubic_millimeters"),
  f("cad_inches_to_millimeters", "cad_geometry", "Business Builder", "CAD inches to millimeters", "length_inches * 25.4", ["length_inches"], [], "millimeters"),
  f("cad_feet_to_millimeters", "cad_geometry", "Business Builder", "CAD feet to millimeters", "length_feet * 304.8", ["length_feet"], [], "millimeters"),
  f("mocap_marker_speed_mps", "motion_capture", "Creator Studio", "Motion capture marker speed", "sqrt(displacement_x^2 + displacement_y^2 + displacement_z^2) / elapsed_seconds", ["displacement_x","displacement_y","displacement_z","elapsed_seconds"], [], "meters_per_second"),
  f("mocap_sample_interval_ms", "motion_capture", "Creator Studio", "Motion capture sample interval", "1000 / sample_rate_hz", ["sample_rate_hz"], [], "milliseconds"),
  f("mocap_joint_angle_degrees", "motion_capture", "Creator Studio", "Joint vector angle", "acos(clamp(dot(vector_a,vector_b)/(norm(vector_a)*norm(vector_b)),-1,1))*180/pi", ["vector_a_x","vector_a_y","vector_a_z","vector_b_x","vector_b_y","vector_b_z"], [], "degrees"),
  f("mocap_frame_coverage_percent", "motion_capture", "Creator Studio", "Tracking frame coverage", "100 * valid_tracked_frames / total_capture_frames", ["valid_tracked_frames","total_capture_frames"], [], "percent"),
  f("mocap_nyquist_hz", "motion_capture", "Creator Studio", "Capture Nyquist frequency", "sample_rate_hz / 2", ["sample_rate_hz"], [], "hertz"),
  ...ENGINEERING_FORMULAS.filter((item) => !["gross_revenue", "net_revenue", "monthly_recurring_revenue", "average_order_value", "conversion_rate", "churn_rate", "customer_lifetime_value", "customer_acquisition_cost", "ltv_to_cac_ratio", "food_cost_percent", "gross_margin_percent", "recipe_unit_cost", "menu_item_profit", "waste_cost", "prime_cost_percent", "break_even_sales", "shift_hours", "regular_pay", "overtime_pay", "labor_cost_percent", "wage_projection", "employee_productivity", "reorder_point", "inventory_turnover", "stockout_risk_score", "vendor_total_cost", "route_cost", "delivery_profit", "lead_score", "campaign_roi", "follow_up_priority", "email_reply_rate", "booking_conversion", "prompt_specificity_score", "song_readiness_score", "originality_guard_score", "release_readiness_score", "audio_job_completion", "transcript_confidence_average", "device_capability_score", "motion_safety_score", "setup_readiness_percent", "module_health_score", "next_best_step_score", "workflow_priority_score", "risk_adjusted_value", "proof_strength_score", "expected_loss", "smoothed_demand_level", "service_capacity_jobs", "media_duration_seconds", "media_payload_mebibytes", "tracked_motion_speed", "kinetic_energy_joules", "dilution_stock_volume", "render_time_estimate_seconds", "uncompressed_image_bytes", "average_acceleration", "rectangle_area_square_meters", "loaded_labor_cost", "weekly_wage_projection", "billable_utilization_percent", "opportunity_value_gap", "project_unit_margin_percent", "material_quantity_with_waste", "concrete_volume_cubic_yards", "crew_duration_hours", "trade_job_cost", "length_meters_from_feet", "data_transfer_seconds", "base64_encoded_bytes", "quantum_qubit_layer_shots", "earth_circular_orbit_period_minutes", "telescope_diffraction_arcseconds", "math_triangle_area_m2", "math_circle_area_m2", "math_hypotenuse_m", "math_compound_future_value", "math_weighted_grade_percent", "math_probability_union_percent", "stem_ohms_voltage_v", "stem_electrical_power_w", "stem_wave_speed_mps", "stem_material_density_kg_m3", "social_population_density_km2", "social_population_change_percent", "social_school_participation_percent", "social_voter_turnout_percent", "social_map_scale_distance_m", "language_reading_wpm", "language_lexical_diversity_percent", "language_flesch_reading_ease", "language_source_coverage_percent", "arts_beat_duration_seconds", "arts_frame_count", "arts_print_dpi", "arts_frame_aspect_ratio", "pe_met_minutes", "pe_pace_minutes_per_km", "pe_estimated_kcal", "cad_paper_to_model_mm", "cad_distance_3d_mm", "cad_cylinder_volume_mm3", "cad_inches_to_millimeters", "cad_feet_to_millimeters", "mocap_marker_speed_mps", "mocap_sample_interval_ms", "mocap_joint_angle_degrees", "mocap_frame_coverage_percent", "mocap_nyquist_hz"].includes(item.formulaKey)).map((item) => f(item.formulaKey, item.groupKey, item.productArea, item.publicLabel, item.expressionText, item.requiredInputs, item.targetTables, item.outputUnit))
];

class FormulaValidationError extends Error {
  constructor(inputKey) {
    super(`${inputKey} must be a finite number`);
    this.name = "FormulaValidationError";
    this.inputKey = inputKey;
  }
}

const FORMULA_TABLES = [
  "sonara_formula_groups",
  "sonara_formula_definitions",
  "sonara_formula_variables",
  "sonara_formula_templates",
  "sonara_formula_results"
];

function f(formulaKey, groupKey, productArea, publicLabel, expressionText, requiredInputs, targetTables, outputUnit) {
  return {
    formulaKey,
    formula_key: formulaKey,
    groupKey,
    group_key: groupKey,
    productArea,
    product_area: productArea,
    publicLabel,
    public_label: publicLabel,
    expressionText,
    expression_text: expressionText,
    requiredInputs,
    required_inputs: requiredInputs,
    targetTables,
    target_tables: targetTables,
    outputUnit,
    output_unit: outputUnit,
  status: "active"
  };
}

function getFormulaDefinition(formulaKey) {
  // External API callers can send JSON objects for formulaKey, including
  // objects whose toString property is not callable. Never coerce those.
  if (typeof formulaKey !== "string" && typeof formulaKey !== "number") return undefined;
  const key = String(formulaKey).trim();
  if (key.length > 120) return undefined;
  return FORMULA_DEFINITIONS.find((definition) => definition.formulaKey === key);
}

function listFormulaDefinitions() {
  return FORMULA_DEFINITIONS.slice();
}

function evaluateFormula(formulaKey, inputValues = {}) {
  const definition = getFormulaDefinition(formulaKey);
  if (!definition) return { ok: false, code: "unknown_formula", message: "Formula is not registered." };
  // API boundaries accept an input map, not null, arrays or scalar values.
  // Without this guard a JSON null body can throw before evaluation's catch
  // and produce an internal-server error instead of a bounded refusal.
  if (!inputValues || typeof inputValues !== "object" || Array.isArray(inputValues)) {
    return { ok: false, code: "invalid_input", formulaKey: definition.formulaKey,
      message: "inputValues must be a JSON object with named formula inputs." };
  }
  const missing = definition.requiredInputs.filter((key) => !hasValue(inputValues[key]));
  if (missing.length) return { ok: false, code: "missing_inputs", formulaKey: definition.formulaKey, missing };

  const fn = EVALUATORS[definition.formulaKey];
  if (!fn) return { ok: false, code: "formula_not_enabled", formulaKey: definition.formulaKey, message: "Formula is registered but not enabled in the runtime evaluator yet." };

  try {
    const rawValue = fn(inputValues);
    // Keep existing business values at four decimals, but preserve very small
    // scientific values that otherwise round to a falsely reassuring zero.
    const resultValue = ENGINEERING_PRECISE_KEYS.has(definition.formulaKey) &&
      Number.isFinite(rawValue) && rawValue !== 0
      ? Number(rawValue.toPrecision(12))
      : round(rawValue);
    if (!Number.isFinite(resultValue)) {
      return {
        ok: false,
        code: "not_computable",
        formulaKey: definition.formulaKey,
        publicLabel: definition.publicLabel,
        expressionText: definition.expressionText,
        message: `${definition.publicLabel} cannot be worked out from these figures, because ${definition.expressionText} divides by something that is zero.`
      };
    }
    return {
      ok: true,
      formulaKey: definition.formulaKey,
      publicLabel: definition.publicLabel,
      resultValue,
      resultUnit: definition.outputUnit,
      expressionText: definition.expressionText,
      inputValues: sanitizeInputValues(declaredInputs(definition, inputValues))
    };
  } catch (error) {
    if (error instanceof FormulaValidationError || error instanceof AppliedFormulaInputError || error instanceof EducationFormulaInputError || error?.code === "invalid_input") {
      return {
        ok: false,
        code: "invalid_input",
        formulaKey: definition.formulaKey,
        inputKey: error.inputKey,
        message: error.message
      };
    }
    return { ok: false, code: "formula_runtime_error", formulaKey: definition.formulaKey, message: error.message };
  }
}

const EVALUATORS = {
  gross_revenue: (v) => sum(toArray(v.order_total)),
  net_revenue: (v) => n(v.gross_revenue) - n(v.refunds) - n(v.discounts) - n(v.fees),
  monthly_recurring_revenue: (v) => sum(toArray(v.active_subscription_monthly_amount)),
  average_order_value: (v) => divide(n(v.gross_revenue), n(v.order_count)),
  conversion_rate: (v) => percent(n(v.conversions), n(v.visitors)),
  churn_rate: (v) => percent(n(v.lost_customers), n(v.starting_customers)),
  customer_lifetime_value: (v) => n(v.average_order_value) * n(v.purchase_frequency) * n(v.customer_lifespan),
  customer_acquisition_cost: (v) => divide(n(v.marketing_spend), n(v.new_customers)),
  ltv_to_cac_ratio: (v) => divide(n(v.customer_lifetime_value), n(v.customer_acquisition_cost)),
  food_cost_percent: (v) => percent(n(v.ingredient_cost), n(v.menu_price)),
  gross_margin_percent: (v) => percent(n(v.sale_price) - n(v.cost), n(v.sale_price)),
  recipe_unit_cost: (v) => toArray(v.ingredients).reduce((total, item) => total + n(item.quantity) * n(item.unit_cost), 0),
  menu_item_profit: (v) => n(v.menu_price) - n(v.recipe_unit_cost) - n(v.packaging_cost) - n(v.payment_fee),
  waste_cost: (v) => n(v.waste_quantity) * n(v.unit_cost),
  prime_cost_percent: (v) => percent(n(v.food_cost) + n(v.labor_cost), n(v.sales)),
  break_even_sales: (v) => divide(n(v.fixed_costs), n(v.gross_margin_percent_decimal)),
  shift_hours: (v) => Math.max(0, (moment(v, "clock_out") - moment(v, "clock_in")) / 36e5 - n(v.unpaid_break_hours)),
  regular_pay: (v) => n(v.regular_hours) * n(v.hourly_rate),
  overtime_pay: (v) => n(v.overtime_hours) * n(v.hourly_rate) * n(v.overtime_multiplier),
  labor_cost_percent: (v) => percent(n(v.labor_cost), n(v.sales)),
  wage_projection: (v) => n(v.scheduled_hours) * n(v.hourly_rate),
  employee_productivity: (v) => divide(n(v.sales), n(v.labor_hours)),
  reorder_point: (v) => n(v.average_daily_usage) * n(v.lead_time_days) + n(v.safety_stock),
  inventory_turnover: (v) => divide(n(v.cost_of_goods_sold), n(v.average_inventory_value)),
  stockout_risk_score: (v) => Math.max(0, n(v.reorder_point) - n(v.current_stock)),
  vendor_total_cost: (v) => n(v.item_cost) + n(v.shipping) + n(v.fees) - n(v.discounts),
  route_cost: (v) => n(v.distance_miles) * n(v.cost_per_mile) + n(v.driver_labor) + n(v.tolls),
  delivery_profit: (v) => n(v.delivery_revenue) - n(v.route_cost) - n(v.packaging_cost),
  lead_score: (v) => n(v.fit_score) + n(v.urgency_score) + n(v.engagement_score) - n(v.risk_score),
  campaign_roi: (v) => percent(n(v.campaign_revenue) - n(v.campaign_cost), n(v.campaign_cost)),
  follow_up_priority: (v) => n(v.lead_score) + n(v.days_since_contact_weight) + n(v.value_weight),
  email_reply_rate: (v) => percent(n(v.replies), n(v.delivered_messages)),
  booking_conversion: (v) => percent(n(v.bookings), n(v.booking_page_visits)),
  prompt_specificity_score: (v) => ["key", "rhythmic_feel", "harmonic_identity", "drum_language", "vocal_mode"].reduce((score, key) => score + (String(v[key] || "").trim() ? 20 : 0), 0),
  song_readiness_score: (v) => n(v.lyrics_score) + n(v.production_score) + n(v.arrangement_score) + n(v.mix_notes_score) + n(v.release_fit_score),
  originality_guard_score: (v) => 100 - n(v.similarity_risk_score),
  release_readiness_score: (v) => ["metadata", "cover_art", "audio_master", "video_assets", "distribution_checklist"].reduce((score, key) => score + n(v[key]), 0),
  audio_job_completion: (v) => percent(n(v.completed_steps), n(v.total_steps)),
  transcript_confidence_average: (v) => average(toArray(v.segment_confidence)),
  device_capability_score: (v) => n(v.gpu_score) + n(v.memory_score) + n(v.touch_score) + n(v.motion_support) + n(v.audio_support),
  motion_safety_score: (v) => v.reduced_motion_enabled === true || v.reduced_motion_enabled === "true" ? 100 : n(v.animation_intensity_score),
  setup_readiness_percent: (v) => percent(n(v.ready_checks), n(v.total_checks)),
  module_health_score: (v) => n(v.route_score) + n(v.table_score) + n(v.permission_score) + n(v.test_score) + n(v.integration_score),
  next_best_step_score: (v) => n(v.impact_score) + n(v.urgency_score) + n(v.confidence_score) - n(v.effort_score) - n(v.risk_score),
  workflow_priority_score: (v) => n(v.business_value) + n(v.customer_value) + n(v.deadline_weight) - n(v.complexity),
  risk_adjusted_value: (v) => n(v.expected_value) * n(v.confidence_percent) - n(v.risk_cost),
  proof_strength_score: (v) => n(v.verified_records) + n(v.customer_reviews) + n(v.payment_history) + n(v.completion_events),
  expected_loss: (v) => bounded(v, "event_probability", 0, 1) * bounded(v, "loss_amount"),
  smoothed_demand_level: (v) => bounded(v, "alpha", 0, 1) * bounded(v, "observed_demand") + (1 - bounded(v, "alpha", 0, 1)) * bounded(v, "previous_level"),
  service_capacity_jobs: (v) => Math.floor(bounded(v, "available_minutes") / bounded(v, "minutes_per_job", Number.MIN_VALUE)),
  media_duration_seconds: (v) => bounded(v, "frame_count", 0, Number.MAX_SAFE_INTEGER, true) / bounded(v, "frames_per_second", Number.MIN_VALUE),
  media_payload_mebibytes: (v) => bounded(v, "bitrate_bits_per_second") * bounded(v, "duration_seconds") / (8 * 1048576),
  tracked_motion_speed: (v) => bounded(v, "displacement_meters") / bounded(v, "elapsed_seconds", Number.MIN_VALUE),
  kinetic_energy_joules: (v) => bounded(v, "mass_kg", 0, 1e12) * bounded(v, "speed_meters_per_second", 0, 1e6) ** 2 / 2,
  dilution_stock_volume: (v) => {
    const stock = bounded(v, "stock_concentration", Number.MIN_VALUE);
    return bounded(v, "target_concentration", 0, stock) * bounded(v, "final_volume", Number.MIN_VALUE) / stock;
  },
  render_time_estimate_seconds: (v) => bounded(v, "frame_count", 0, Number.MAX_SAFE_INTEGER, true) / bounded(v, "measured_frames_per_second", Number.MIN_VALUE) + bounded(v, "overhead_seconds"),
  uncompressed_image_bytes: (v) => bounded(v, "width_pixels", 1, 8192, true) * bounded(v, "height_pixels", 1, 8192, true) * bounded(v, "channels", 1, 4, true) * bounded(v, "bytes_per_channel", 1, 8, true),
  average_acceleration: (v) => (bounded(v, "final_velocity", -1e6, 1e6) - bounded(v, "initial_velocity", -1e6, 1e6)) / bounded(v, "elapsed_seconds", Number.MIN_VALUE),
  rectangle_area_square_meters: (v) => bounded(v, "length_meters", 0, 1e6) * bounded(v, "width_meters", 0, 1e6),
  ...ENGINEERING_EVALUATORS,
  ...APPLIED_FORMULAS,
  ...EDUCATION_FORMULAS
};

// Explicit domains for the expanded calculations; never coerce booleans to data.
function bounded(values, key, minimum = 0, maximum = Number.MAX_SAFE_INTEGER, integer = false) {
  const raw = values[key];
  const numeric = typeof raw === "number" || (typeof raw === "string" && raw.trim()) ? Number(raw) : NaN;
  if (!Number.isFinite(numeric) || numeric < minimum || numeric > maximum || (integer && !Number.isSafeInteger(numeric))) {
    const error = new FormulaValidationError(key);
    error.message = `${key} must be ${integer ? "an integer" : "a finite number"} between ${minimum} and ${maximum}`;
    throw error;
  }
  return numeric;
}

function hasValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  // Avoid untrusted JSON objects with shadowed toString causing a TypeError.
  // Specific formula evaluators enforce expected types and number ranges.
  if (value !== null && typeof value === "object") return true;
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function n(value, inputKey = "input") {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new FormulaValidationError(inputKey);
  return parsed;
}

// A zero denominator is not a zero answer.
//
// "Break-even sales" is `fixed_costs / gross_margin_percent_decimal`. With
// 12000 of fixed costs and no margin this returned 0, and the customer was
// shown "Break-even sales: 0" -- that you break even at zero sales, when at
// zero margin you never break even at all. "Customer acquisition cost" with
// 5000 spent and nobody acquired returned 0, reading as customers costing
// nothing rather than as money spent for none. Six more evaluators divide.
//
// NaN reaches the non-finite branch in evaluateFormula, which refuses with a
// reason rather than publishing a number nobody can act on. Three states, not
// two: a figure, no figure, and never a zero standing in for "cannot say".
function divide(a, b) {
  return b === 0 ? NaN : a / b;
}

function percent(part, whole) {
  return divide(part, whole) * 100;
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];
  return [value];
}

function sum(values) {
  return values.reduce((total, value) => total + n(value), 0);
}

function average(values) {
  return values.length ? sum(values) / values.length : 0;
}

function round(value) {
  return Math.round(Number(value) * 10000) / 10000;
}

// The inputs a formula declares, and only those. The result carries these back
// and /api/formulas/results stores them: before this the whole request body was
// kept, so whatever else a caller sent -- the formula key itself, a field from
// another form, a value nobody asked for -- was saved beside the business's
// figures as though it were one of them.
function declaredInputs(definition, values) {
  const source = values && typeof values === "object" ? values : {};
  return Object.fromEntries(definition.requiredInputs
    .filter((key) => Object.prototype.hasOwnProperty.call(source, key))
    .map((key) => [key, source[key]]));
}

// A clock time that does not parse is an invalid input, not a zero-length shift
// and not "divides by zero", which is what reaching not_computable would say.
function moment(values, key) {
  const time = new Date(values[key]).getTime();
  if (!Number.isFinite(time)) {
    const error = new FormulaValidationError(key);
    error.message = `${key} must be a date and time`;
    throw error;
  }
  return time;
}

function sanitizeInputValues(values) {
  return JSON.parse(JSON.stringify(values || {}));
}

function productAreaToWorkspace(productArea) {
  const normalized = String(productArea || "").toLowerCase();
  if (normalized.includes("creator")) return "creator_studio";
  if (normalized.includes("growth")) return "growth_studio";
  return "business_builder";
}

module.exports = {
  FORMULA_DEFINITIONS,
  FORMULA_TABLES,
  getFormulaDefinition,
  listFormulaDefinitions,
  evaluateFormula,
  productAreaToWorkspace
};

"use strict";

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
  f("proof_strength_score", "operating_twin", "Business Builder", "Proof strength", "verified_records + customer_reviews + payment_history + completion_events", ["verified_records", "customer_reviews", "payment_history", "completion_events"], ["customer_records", "billing_webhook_events", "module_outputs"], "score")
];

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
  return FORMULA_DEFINITIONS.find((definition) => definition.formulaKey === String(formulaKey || "").trim());
}

function listFormulaDefinitions() {
  return FORMULA_DEFINITIONS.slice();
}

function evaluateFormula(formulaKey, inputValues = {}) {
  const definition = getFormulaDefinition(formulaKey);
  if (!definition) return { ok: false, code: "unknown_formula", message: "Formula is not registered." };
  const missing = definition.requiredInputs.filter((key) => !hasValue(inputValues[key]));
  if (missing.length) return { ok: false, code: "missing_inputs", formulaKey: definition.formulaKey, missing };

  const fn = EVALUATORS[definition.formulaKey];
  if (!fn) return { ok: false, code: "formula_not_enabled", formulaKey: definition.formulaKey, message: "Formula is registered but not enabled in the runtime evaluator yet." };

  try {
    const resultValue = round(fn(inputValues));
    if (!Number.isFinite(resultValue)) return { ok: false, code: "invalid_result", formulaKey: definition.formulaKey };
    return {
      ok: true,
      formulaKey: definition.formulaKey,
      publicLabel: definition.publicLabel,
      resultValue,
      resultUnit: definition.outputUnit,
      expressionText: definition.expressionText,
      inputValues: sanitizeInputValues(inputValues)
    };
  } catch (error) {
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
  shift_hours: (v) => Math.max(0, (new Date(v.clock_out).getTime() - new Date(v.clock_in).getTime()) / 36e5 - n(v.unpaid_break_hours)),
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
  proof_strength_score: (v) => n(v.verified_records) + n(v.customer_reviews) + n(v.payment_history) + n(v.completion_events)
};

function hasValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function n(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function divide(a, b) {
  return b === 0 ? 0 : a / b;
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

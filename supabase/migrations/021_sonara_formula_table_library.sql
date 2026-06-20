-- SONARA Formula Table Library
-- Stores formula definitions and saved formula results. Formulas are metadata first;
-- runtime execution should use a safe allowlisted evaluator, not arbitrary eval.

create extension if not exists pgcrypto;

create table if not exists public.sonara_formula_groups (
  id uuid primary key default gen_random_uuid(),
  group_key text not null unique,
  label text not null,
  product_area text not null default 'sonara',
  description text,
  status text not null default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.sonara_formula_definitions (
  id uuid primary key default gen_random_uuid(),
  formula_key text not null unique,
  group_key text not null references public.sonara_formula_groups(group_key) on delete cascade,
  product_area text not null,
  label text not null,
  public_label text not null,
  expression_text text not null,
  required_inputs jsonb not null default '[]'::jsonb,
  target_tables jsonb not null default '[]'::jsonb,
  output_unit text not null default 'score',
  role_visibility jsonb not null default '["owner","admin"]'::jsonb,
  status text not null default 'active',
  setup_required_reason text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.sonara_formula_variables (
  id uuid primary key default gen_random_uuid(),
  formula_key text not null references public.sonara_formula_definitions(formula_key) on delete cascade,
  variable_key text not null,
  label text not null,
  value_type text not null default 'number',
  source_table text,
  source_column text,
  required boolean not null default true,
  default_value jsonb,
  created_at timestamptz default now(),
  unique(formula_key, variable_key)
);

create table if not exists public.sonara_formula_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null unique,
  formula_key text not null references public.sonara_formula_definitions(formula_key) on delete cascade,
  label text not null,
  product_area text not null,
  input_schema jsonb not null default '{}'::jsonb,
  output_schema jsonb not null default '{}'::jsonb,
  ui_hints jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.sonara_formula_results (
  id uuid primary key default gen_random_uuid(),
  formula_key text not null references public.sonara_formula_definitions(formula_key) on delete restrict,
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  source_table text,
  source_record_id uuid,
  input_values jsonb not null default '{}'::jsonb,
  result_value numeric,
  result_unit text,
  result_payload jsonb not null default '{}'::jsonb,
  status text not null default 'computed',
  created_at timestamptz default now()
);

create index if not exists sonara_formula_definitions_group_idx on public.sonara_formula_definitions(group_key);
create index if not exists sonara_formula_results_formula_idx on public.sonara_formula_results(formula_key);
create index if not exists sonara_formula_results_org_idx on public.sonara_formula_results(organization_id);

insert into public.sonara_formula_groups (group_key, label, product_area, description, status)
values
  ('business_revenue', 'Business and revenue', 'Business Builder', 'Revenue, subscriptions, conversion, customer value, and acquisition formulas.', 'active'),
  ('restaurant_margin', 'Restaurant and service margin', 'Business Builder', 'Food cost, gross margin, recipe cost, waste, and break-even formulas.', 'active'),
  ('employee_payroll', 'Employee payroll and time clock', 'Business Builder', 'Shift hours, wages, overtime, labor cost, and productivity formulas.', 'active'),
  ('inventory_operations', 'Inventory and operations', 'Business Builder', 'Reorder points, inventory turnover, vendor cost, route cost, and delivery profit.', 'active'),
  ('growth_marketing', 'Growth and marketing', 'Growth Studio', 'Lead scoring, campaign ROI, follow-up priority, reply rate, and booking conversion.', 'active'),
  ('creator_music', 'Creator music and release', 'Creator Studio', 'Prompt specificity, song readiness, release readiness, originality guard, and audio job progress.', 'active'),
  ('ui_device_experience', 'Device and interface experience', 'SONARA UI', 'Device capability, motion safety, setup readiness, and module health formulas.', 'active'),
  ('operating_twin', 'Operating twin and decision support', 'SONARA Admin', 'Next best step, workflow priority, risk-adjusted value, and proof strength formulas.', 'active')
on conflict (group_key) do update
set label = excluded.label,
    product_area = excluded.product_area,
    description = excluded.description,
    status = excluded.status,
    updated_at = now();

insert into public.sonara_formula_definitions
  (formula_key, group_key, product_area, label, public_label, expression_text, required_inputs, target_tables, output_unit, role_visibility, status, notes)
values
  ('gross_revenue','business_revenue','Business Builder','Gross revenue','Gross revenue','sum(order_total)','["order_total"]','["pos_sales_summaries","billing_subscriptions"]','money','["owner","admin"]','active','Total revenue before discounts, refunds, and fees.'),
  ('net_revenue','business_revenue','Business Builder','Net revenue','Net revenue','gross_revenue - refunds - discounts - fees','["gross_revenue","refunds","discounts","fees"]','["pos_sales_summaries","billing_webhook_events"]','money','["owner","admin"]','active','Revenue after common reductions.'),
  ('monthly_recurring_revenue','business_revenue','SONARA Admin','Monthly recurring revenue','Monthly recurring revenue','sum(active_subscription_monthly_amount)','["active_subscription_monthly_amount"]','["billing_subscriptions"]','money_per_month','["founder","admin"]','active','Subscription revenue view.'),
  ('average_order_value','business_revenue','Business Builder','Average order value','Average order value','gross_revenue / order_count','["gross_revenue","order_count"]','["pos_sales_summaries"]','money','["owner","admin","manager"]','active','Average sale size.'),
  ('conversion_rate','growth_marketing','Growth Studio','Conversion rate','Conversion rate','(conversions / visitors) * 100','["conversions","visitors"]','["growth_campaigns","growth_leads"]','percent','["owner","admin","manager"]','active','Visitor-to-action conversion.'),
  ('churn_rate','business_revenue','SONARA Admin','Churn rate','Churn rate','(lost_customers / starting_customers) * 100','["lost_customers","starting_customers"]','["billing_subscriptions"]','percent','["founder","admin"]','active','Subscription/customer loss rate.'),
  ('customer_lifetime_value','business_revenue','Business Builder','Customer lifetime value','Customer lifetime value','average_order_value * purchase_frequency * customer_lifespan','["average_order_value","purchase_frequency","customer_lifespan"]','["customer_records","pos_sales_summaries"]','money','["owner","admin"]','active','Estimated customer value.'),
  ('customer_acquisition_cost','growth_marketing','Growth Studio','Customer acquisition cost','Customer acquisition cost','marketing_spend / new_customers','["marketing_spend","new_customers"]','["growth_campaigns","growth_leads"]','money','["owner","admin"]','active','Cost to acquire each customer.'),
  ('food_cost_percent','restaurant_margin','Business Builder','Food cost percent','Food cost','(ingredient_cost / menu_price) * 100','["ingredient_cost","menu_price"]','["recipe_cards","recipe_ingredients","menu_items"]','percent','["owner","admin","manager"]','active','Core restaurant margin formula.'),
  ('gross_margin_percent','restaurant_margin','Business Builder','Gross margin percent','Gross margin','((sale_price - cost) / sale_price) * 100','["sale_price","cost"]','["menu_items","inventory_items"]','percent','["owner","admin","manager"]','active','Gross margin percentage.'),
  ('recipe_unit_cost','restaurant_margin','Business Builder','Recipe unit cost','Recipe cost','sum(ingredient_quantity * ingredient_unit_cost)','["ingredient_quantity","ingredient_unit_cost"]','["recipe_cards","recipe_ingredients"]','money','["owner","admin","manager"]','active','Cost to produce one recipe unit.'),
  ('menu_item_profit','restaurant_margin','Business Builder','Menu item profit','Menu item profit','menu_price - recipe_unit_cost - packaging_cost - payment_fee','["menu_price","recipe_unit_cost","packaging_cost","payment_fee"]','["menu_items","recipe_cards"]','money','["owner","admin","manager"]','active','Profit after key direct costs.'),
  ('prime_cost_percent','restaurant_margin','Business Builder','Prime cost percent','Prime cost','((food_cost + labor_cost) / sales) * 100','["food_cost","labor_cost","sales"]','["daily_profit_snapshots","employee_time_entries"]','percent','["owner","admin"]','active','Food plus labor against sales.'),
  ('shift_hours','employee_payroll','Business Builder','Shift hours','Shift hours','(clock_out - clock_in) - unpaid_break_hours','["clock_in","clock_out","unpaid_break_hours"]','["employee_time_entries"]','hours','["owner","admin","manager","employee"]','active','Hours worked in a shift.'),
  ('regular_pay','employee_payroll','Business Builder','Regular pay','Regular pay','regular_hours * hourly_rate','["regular_hours","hourly_rate"]','["employee_time_entries","employee_wage_rates"]','money','["owner","admin","manager","employee"]','active','Base pay before overtime.'),
  ('overtime_pay','employee_payroll','Business Builder','Overtime pay','Overtime pay','overtime_hours * hourly_rate * overtime_multiplier','["overtime_hours","hourly_rate","overtime_multiplier"]','["employee_time_entries","employee_wage_rates"]','money','["owner","admin","manager","employee"]','active','Overtime projection/pay estimate.'),
  ('labor_cost_percent','employee_payroll','Business Builder','Labor cost percent','Labor cost','(labor_cost / sales) * 100','["labor_cost","sales"]','["employee_pay_statements","daily_profit_snapshots"]','percent','["owner","admin","manager"]','active','Labor as a percentage of sales.'),
  ('reorder_point','inventory_operations','Business Builder','Reorder point','Reorder point','(average_daily_usage * lead_time_days) + safety_stock','["average_daily_usage","lead_time_days","safety_stock"]','["inventory_items","vendor_accounts"]','quantity','["owner","admin","manager"]','active','When to reorder stock.'),
  ('inventory_turnover','inventory_operations','Business Builder','Inventory turnover','Inventory turnover','cost_of_goods_sold / average_inventory_value','["cost_of_goods_sold","average_inventory_value"]','["inventory_items","daily_profit_snapshots"]','ratio','["owner","admin"]','active','How quickly inventory turns.'),
  ('route_cost','inventory_operations','Business Builder','Route cost','Route cost','(distance_miles * cost_per_mile) + driver_labor + tolls','["distance_miles","cost_per_mile","driver_labor","tolls"]','["vehicle_records","route_tracking_sessions"]','money','["owner","admin","manager"]','active','Vehicle/delivery route cost.'),
  ('lead_score','growth_marketing','Growth Studio','Lead score','Lead score','fit_score + urgency_score + engagement_score - risk_score','["fit_score","urgency_score","engagement_score","risk_score"]','["growth_leads"]','score','["owner","admin","manager"]','active','Simple lead scoring model.'),
  ('campaign_roi','growth_marketing','Growth Studio','Campaign ROI','Campaign return','((campaign_revenue - campaign_cost) / campaign_cost) * 100','["campaign_revenue","campaign_cost"]','["growth_campaigns"]','percent','["owner","admin","manager"]','active','Marketing return percentage.'),
  ('prompt_specificity_score','creator_music','Creator Studio','Prompt specificity score','Prompt strength','key + rhythmic_feel + harmonic_identity + drum_language + vocal_mode','["key","rhythmic_feel","harmonic_identity","drum_language","vocal_mode"]','["creator_prompt_packs","creator_song_blueprints"]','score','["owner","admin","creator"]','active','Mandatory music prompt specificity rule.'),
  ('song_readiness_score','creator_music','Creator Studio','Song readiness score','Song readiness','lyrics_score + production_score + arrangement_score + mix_notes_score + release_fit_score','["lyrics_score","production_score","arrangement_score","mix_notes_score","release_fit_score"]','["creator_song_blueprints"]','score','["owner","admin","creator"]','active','Checks whether a song is ready to package.'),
  ('release_readiness_score','creator_music','Creator Studio','Release readiness score','Release readiness','metadata + cover_art + audio_master + video_assets + distribution_checklist','["metadata","cover_art","audio_master","video_assets","distribution_checklist"]','["creator_release_packages"]','score','["owner","admin","creator"]','active','Release checklist scoring.'),
  ('audio_job_completion','creator_music','Creator Studio','Audio job completion','Audio job progress','(completed_steps / total_steps) * 100','["completed_steps","total_steps"]','["music_ai_jobs","audio_analysis_reports"]','percent','["owner","admin","creator"]','active','Background audio job progress.'),
  ('device_capability_score','ui_device_experience','SONARA UI','Device capability score','Device capability','gpu_score + memory_score + touch_score + motion_support + audio_support','["gpu_score","memory_score","touch_score","motion_support","audio_support"]','["app_experience_settings"]','score','["owner","admin"]','active','Progressive enhancement readiness.'),
  ('setup_readiness_percent','ui_device_experience','SONARA Admin','Setup readiness percent','Setup readiness','(ready_checks / total_checks) * 100','["ready_checks","total_checks"]','["sonara_control_plane_checks"]','percent','["founder","admin","owner"]','active','Control-plane readiness percentage.'),
  ('module_health_score','ui_device_experience','SONARA Admin','Module health score','Tool health','route_score + table_score + permission_score + test_score + integration_score','["route_score","table_score","permission_score","test_score","integration_score"]','["sonara_control_plane_checks"]','score','["founder","admin","owner"]','active','Overall tool health.'),
  ('next_best_step_score','operating_twin','SONARA Admin','Next best step score','Next best step','impact_score + urgency_score + confidence_score - effort_score - risk_score','["impact_score","urgency_score","confidence_score","effort_score","risk_score"]','["module_outputs"]','score','["founder","admin","owner"]','active','Prioritizes work.'),
  ('proof_strength_score','operating_twin','Business Builder','Proof strength score','Proof strength','verified_records + customer_reviews + payment_history + completion_events','["verified_records","customer_reviews","payment_history","completion_events"]','["customer_records","billing_webhook_events","module_outputs"]','score','["owner","admin"]','active','Proof Passport style strength score.')
on conflict (formula_key) do update
set group_key = excluded.group_key,
    product_area = excluded.product_area,
    label = excluded.label,
    public_label = excluded.public_label,
    expression_text = excluded.expression_text,
    required_inputs = excluded.required_inputs,
    target_tables = excluded.target_tables,
    output_unit = excluded.output_unit,
    role_visibility = excluded.role_visibility,
    status = excluded.status,
    notes = excluded.notes,
    updated_at = now();

insert into public.sonara_formula_templates (template_key, formula_key, label, product_area, input_schema, output_schema, ui_hints, status)
values
  ('food_cost_card','food_cost_percent','Food cost card','Business Builder','{"ingredient_cost":"number","menu_price":"number"}'::jsonb,'{"value":"percent"}'::jsonb,'{"component":"metric_card","good_range":"28-35%","plain_label":"Food cost"}'::jsonb,'active'),
  ('shift_pay_card','regular_pay','Shift pay card','Business Builder','{"regular_hours":"number","hourly_rate":"number"}'::jsonb,'{"value":"money"}'::jsonb,'{"component":"employee_pay_card","plain_label":"Regular pay"}'::jsonb,'active'),
  ('campaign_roi_card','campaign_roi','Campaign ROI card','Growth Studio','{"campaign_revenue":"number","campaign_cost":"number"}'::jsonb,'{"value":"percent"}'::jsonb,'{"component":"growth_metric_card","plain_label":"Campaign return"}'::jsonb,'active'),
  ('song_readiness_card','song_readiness_score','Song readiness card','Creator Studio','{"lyrics_score":"number","production_score":"number","arrangement_score":"number","mix_notes_score":"number","release_fit_score":"number"}'::jsonb,'{"value":"score"}'::jsonb,'{"component":"creator_score_card","plain_label":"Song readiness"}'::jsonb,'active'),
  ('module_health_card','module_health_score','Module health card','SONARA Admin','{"route_score":"number","table_score":"number","permission_score":"number","test_score":"number","integration_score":"number"}'::jsonb,'{"value":"score"}'::jsonb,'{"component":"admin_health_card","plain_label":"Tool health"}'::jsonb,'active')
on conflict (template_key) do update
set formula_key = excluded.formula_key,
    label = excluded.label,
    product_area = excluded.product_area,
    input_schema = excluded.input_schema,
    output_schema = excluded.output_schema,
    ui_hints = excluded.ui_hints,
    status = excluded.status,
    updated_at = now();

alter table public.sonara_formula_groups enable row level security;
alter table public.sonara_formula_definitions enable row level security;
alter table public.sonara_formula_variables enable row level security;
alter table public.sonara_formula_templates enable row level security;
alter table public.sonara_formula_results enable row level security;

drop policy if exists "public can read active formula groups" on public.sonara_formula_groups;
create policy "public can read active formula groups"
on public.sonara_formula_groups
for select
using (status = 'active');

drop policy if exists "public can read active formula definitions" on public.sonara_formula_definitions;
create policy "public can read active formula definitions"
on public.sonara_formula_definitions
for select
using (status = 'active');

drop policy if exists "public can read active formula templates" on public.sonara_formula_templates;
create policy "public can read active formula templates"
on public.sonara_formula_templates
for select
using (status = 'active');

drop policy if exists "service role manages formula groups" on public.sonara_formula_groups;
create policy "service role manages formula groups"
on public.sonara_formula_groups
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "service role manages formula definitions" on public.sonara_formula_definitions;
create policy "service role manages formula definitions"
on public.sonara_formula_definitions
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "service role manages formula variables" on public.sonara_formula_variables;
create policy "service role manages formula variables"
on public.sonara_formula_variables
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "service role manages formula templates" on public.sonara_formula_templates;
create policy "service role manages formula templates"
on public.sonara_formula_templates
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "service role manages formula results" on public.sonara_formula_results;
create policy "service role manages formula results"
on public.sonara_formula_results
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

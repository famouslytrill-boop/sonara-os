# SONARA Formula Table Library

This library turns prior SONARA formula discussions into trackable database-ready formulas. The goal is not to make fake dashboards. Each formula must connect to a real table, save a real result, or clearly show `setup_required`.

## Formula categories

### Business and revenue

| Formula key | Plain name | Formula | Inputs | Output | Product area |
|---|---|---|---|---|---|
| gross_revenue | Gross revenue | `sum(order_total)` | sales/orders | money | Business Builder |
| net_revenue | Net revenue | `gross_revenue - refunds - discounts - fees` | gross, refunds, discounts, fees | money | Business Builder |
| monthly_recurring_revenue | Monthly recurring revenue | `sum(active_subscription_monthly_amount)` | subscriptions | money/month | SONARA Admin |
| average_order_value | Average order value | `gross_revenue / order_count` | revenue, order_count | money | Business Builder |
| conversion_rate | Conversion rate | `(conversions / visitors) * 100` | visitors, conversions | percent | Growth Studio |
| churn_rate | Churn rate | `(lost_customers / starting_customers) * 100` | customers | percent | SONARA Admin |
| customer_lifetime_value | Customer lifetime value | `average_order_value * purchase_frequency * customer_lifespan` | aov, frequency, lifespan | money | Business Builder |
| customer_acquisition_cost | Customer acquisition cost | `marketing_spend / new_customers` | spend, customers | money | Growth Studio |
| ltv_to_cac_ratio | LTV to CAC ratio | `customer_lifetime_value / customer_acquisition_cost` | ltv, cac | ratio | Growth Studio |

### Restaurant, food truck, and service margin

| Formula key | Plain name | Formula | Inputs | Output | Product area |
|---|---|---|---|---|---|
| food_cost_percent | Food cost percent | `(ingredient_cost / menu_price) * 100` | ingredient_cost, menu_price | percent | Business Builder |
| gross_margin_percent | Gross margin percent | `((sale_price - cost) / sale_price) * 100` | sale_price, cost | percent | Business Builder |
| recipe_unit_cost | Recipe unit cost | `sum(ingredient_quantity * ingredient_unit_cost)` | recipe ingredients | money | Business Builder |
| menu_item_profit | Menu item profit | `menu_price - recipe_unit_cost - packaging_cost - payment_fee` | price, costs | money | Business Builder |
| waste_cost | Waste cost | `waste_quantity * unit_cost` | waste, unit cost | money | Business Builder |
| prime_cost_percent | Prime cost percent | `((food_cost + labor_cost) / sales) * 100` | food, labor, sales | percent | Business Builder |
| break_even_sales | Break-even sales | `fixed_costs / gross_margin_percent_decimal` | fixed costs, margin | money | Business Builder |

### Employee, payroll, and time clock

| Formula key | Plain name | Formula | Inputs | Output | Product area |
|---|---|---|---|---|---|
| shift_hours | Shift hours | `(clock_out - clock_in) - unpaid_break_hours` | time entries | hours | Business Builder |
| regular_pay | Regular pay | `regular_hours * hourly_rate` | hours, rate | money | Business Builder |
| overtime_pay | Overtime pay | `overtime_hours * hourly_rate * overtime_multiplier` | hours, rate | money | Business Builder |
| labor_cost_percent | Labor cost percent | `(labor_cost / sales) * 100` | labor, sales | percent | Business Builder |
| wage_projection | Wage projection | `scheduled_hours * hourly_rate` | schedule, rate | money | Business Builder |
| employee_productivity | Employee productivity | `sales / labor_hours` | sales, hours | money/hour | Business Builder |

### Inventory, procurement, and operations

| Formula key | Plain name | Formula | Inputs | Output | Product area |
|---|---|---|---|---|---|
| reorder_point | Reorder point | `(average_daily_usage * lead_time_days) + safety_stock` | usage, lead time, safety stock | quantity | Business Builder |
| inventory_turnover | Inventory turnover | `cost_of_goods_sold / average_inventory_value` | cogs, inventory | ratio | Business Builder |
| stockout_risk_score | Stockout risk score | `max(0, reorder_point - current_stock)` | stock, reorder point | score | Business Builder |
| vendor_total_cost | Vendor total cost | `item_cost + shipping + fees - discounts` | invoice/vendor data | money | Business Builder |
| route_cost | Route cost | `(distance_miles * cost_per_mile) + driver_labor + tolls` | route, vehicle, labor | money | Business Builder |
| delivery_profit | Delivery profit | `delivery_revenue - route_cost - packaging_cost` | delivery, route, packaging | money | Business Builder |

### Growth Studio and marketing

| Formula key | Plain name | Formula | Inputs | Output | Product area |
|---|---|---|---|---|---|
| lead_score | Lead score | `fit_score + urgency_score + engagement_score - risk_score` | lead factors | score | Growth Studio |
| campaign_roi | Campaign ROI | `((campaign_revenue - campaign_cost) / campaign_cost) * 100` | revenue, cost | percent | Growth Studio |
| follow_up_priority | Follow-up priority | `lead_score + days_since_contact_weight + value_weight` | lead data | score | Growth Studio |
| email_reply_rate | Email reply rate | `(replies / delivered_messages) * 100` | outreach | percent | Growth Studio |
| booking_conversion | Booking conversion | `(bookings / booking_page_visits) * 100` | visits, bookings | percent | Growth Studio |

### Creator Studio music and release system

| Formula key | Plain name | Formula | Inputs | Output | Product area |
|---|---|---|---|---|---|
| prompt_specificity_score | Prompt specificity score | `key + rhythmic_feel + harmonic_identity + drum_language + vocal_mode` | required prompt fields | score | Creator Studio |
| song_readiness_score | Song readiness score | `lyrics_score + production_score + arrangement_score + mix_notes_score + release_fit_score` | song blueprint | score | Creator Studio |
| originality_guard_score | Originality guard score | `100 - similarity_risk_score` | reference checks | score | Creator Studio |
| release_readiness_score | Release readiness score | `metadata + cover_art + audio_master + video_assets + distribution_checklist` | release package | score | Creator Studio |
| audio_job_completion | Audio job completion | `(completed_steps / total_steps) * 100` | audio jobs | percent | Creator Studio |
| transcript_confidence_average | Transcript confidence average | `avg(segment_confidence)` | ASR segments | percent | Creator Studio |

### UX, device, and experience layer

| Formula key | Plain name | Formula | Inputs | Output | Product area |
|---|---|---|---|---|---|
| device_capability_score | Device capability score | `gpu_score + memory_score + touch_score + motion_support + audio_support` | device checks | score | SONARA UI |
| motion_safety_score | Motion safety score | `reduced_motion_enabled ? 100 : animation_intensity_score` | UI settings | score | SONARA UI |
| setup_readiness_percent | Setup readiness percent | `(ready_checks / total_checks) * 100` | readiness checks | percent | SONARA Admin |
| module_health_score | Module health score | `route_score + table_score + permission_score + test_score + integration_score` | system checks | score | SONARA Admin |

### Decision and operating-twin formulas

| Formula key | Plain name | Formula | Inputs | Output | Product area |
|---|---|---|---|---|---|
| next_best_step_score | Next best step score | `impact_score + urgency_score + confidence_score - effort_score - risk_score` | task factors | score | SONARA Admin |
| workflow_priority_score | Workflow priority score | `business_value + customer_value + deadline_weight - complexity` | workflow factors | score | SONARA Admin |
| risk_adjusted_value | Risk-adjusted value | `expected_value * confidence_percent - risk_cost` | decision data | money/score | SONARA Admin |
| proof_strength_score | Proof strength score | `verified_records + customer_reviews + payment_history + completion_events` | proof data | score | Business Builder |

## Database implementation target

These formulas should be added to:

- `sonara_formula_groups`
- `sonara_formula_definitions`
- `sonara_formula_variables`
- `sonara_formula_results`
- `sonara_formula_templates`

Each formula should track:

1. Product area.
2. Plain-language label.
3. Formula expression.
4. Required inputs.
5. Target tables.
6. Output unit.
7. Status.
8. Setup-required reason if inputs are missing.
9. Owner/admin/staff/customer visibility.

## Public-language rule

Show users the result first and the math second.

Example:

- Good: `Your food cost is 31%. Target: 28% to 35%.`
- Bad: `formula_execution_result: ingredient_cost / menu_price returned 0.31`.

Because apparently users want answers, not a database having a small breakdown in public.

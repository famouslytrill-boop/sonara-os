-- Nine planning tools published as catalog products, three for each product line.
--
-- A separate migration rather than an edit to 20260725180000: that one is
-- applied and frozen by scripts/verify-applied-migrations.mjs, and rewriting an
-- applied migration changes what a fresh database gets without changing any
-- database that already ran it. The generated sync migration keeps these rows
-- from being retired; it updates and never inserts, so the insert has to live
-- somewhere, and this is it.
--
-- Idempotent on service_key, matching the seed migration it extends.

insert into public.service_catalog_items
  (service_key,product_key,name,summary,price_note,status,sort_order,product_type,plan_floor,lifecycle_status,route_path,metadata)
select service_key,product_key,name,summary,price_note,'active',sort_order,'software_product',plan_floor,lifecycle_status,route_path,
       jsonb_build_object('catalogVersion','2026-07-25')
from (values
  ('break-even-runway-planner', 'business_builder', 'Break-Even and Runway', 'How many sales cover your costs, what each sale beyond that is worth, and how many months your cash lasts if the sales do not arrive.', 'No charge.', 2010, 'free', 'active', '/business-builder/tools/break-even'),
  ('shift-rota-cost-planner', 'business_builder', 'Shift Rota Cost Planner', 'Price a week of shifts before the rota goes up, including what share of expected sales the wages take.', 'No charge.', 2020, 'free', 'active', '/business-builder/tools/rota'),
  ('deposit-payment-schedule', 'business_builder', 'Deposit and Payment Schedule', 'Turn an agreed price into a deposit and dated instalments you can put straight on a quote.', 'No charge.', 2030, 'free', 'active', '/business-builder/tools/payment-plan'),
  ('creator-rate-card-builder', 'creator_studio', 'Rate Card Builder', 'Turn a day rate into a rate card that states the licence, the revisions included, and what a rush actually costs.', 'No charge.', 2040, 'free', 'active', '/creator-studio/tools/rate-card'),
  ('split-sheet-and-credits', 'creator_studio', 'Split Sheet and Credits', 'Check that every collaborator''s share of a work adds up to one hundred percent, and produce the credit line, before anybody signs.', 'No charge.', 2050, 'free', 'active', '/creator-studio/tools/split-sheet'),
  ('content-repurposing-planner', 'creator_studio', 'Repurposing Planner', 'Work out how many usable pieces one recording is really worth, and how many weeks of posting that covers.', 'No charge.', 2060, 'free', 'active', '/creator-studio/tools/repurpose'),
  ('campaign-budget-split', 'growth_studio', 'Campaign Budget Split', 'Split a monthly budget across channels and see what it has to return before it is worth spending at all.', 'No charge.', 2070, 'free', 'active', '/growth-studio/tools/budget-split'),
  ('referral-reward-planner', 'growth_studio', 'Referral Reward Planner', 'Check whether a referral reward is affordable at your margin before you promise it to anybody.', 'No charge.', 2080, 'free', 'active', '/growth-studio/tools/referral'),
  ('follow-up-schedule-planner', 'growth_studio', 'Follow-Up Schedule', 'Turn one enquiry into a dated sequence of follow-ups, each with a purpose, and a point where you stop.', 'No charge.', 2090, 'free', 'active', '/growth-studio/tools/follow-up-schedule')
) as seed(service_key,product_key,name,summary,price_note,sort_order,plan_floor,lifecycle_status,route_path)
on conflict (service_key) where service_key is not null do update set
  product_key=excluded.product_key,name=excluded.name,summary=excluded.summary,price_note=excluded.price_note,
  status=excluded.status,sort_order=excluded.sort_order,product_type=excluded.product_type,plan_floor=excluded.plan_floor,
  lifecycle_status=excluded.lifecycle_status,route_path=excluded.route_path,metadata=excluded.metadata,updated_at=now();

notify pgrst, 'reload schema';

-- Nine market-researched products published as catalog rows, three per line.
--
-- Separate migration for the same reason as 20260818060000: the original seed
-- is applied and frozen, and the generated sync migration updates without ever
-- inserting, so an insert has to live in its own file.
--
-- Sources for the research behind these are in
-- docs/market/2026-08-18-PRODUCT-GAP-RESEARCH.md.

insert into public.service_catalog_items
  (service_key,product_key,name,summary,price_note,status,sort_order,product_type,plan_floor,lifecycle_status,route_path,metadata)
select service_key,product_key,name,summary,price_note,'active',sort_order,'software_product',plan_floor,lifecycle_status,route_path,
       jsonb_build_object('catalogVersion','2026-07-25')
from (values
  ('price-rise-planner', 'business_builder', 'Price Rise Planner', 'How many customers you could lose after a price rise and still be better off than you are now.', 'No charge.', 3010, 'free', 'active', '/business-builder/tools/price-rise'),
  ('software-spend-auditor', 'business_builder', 'Software Spend Auditor', 'What your tools cost a year, what the seats nobody uses cost, and what you pay per person actually using them.', 'No charge.', 3020, 'free', 'active', '/business-builder/tools/software-spend'),
  ('quiet-month-cash-plan', 'business_builder', 'Quiet Month Cash Plan', 'Month-by-month takings against fixed costs, naming the month the cash actually runs out.', 'No charge.', 3030, 'free', 'active', '/business-builder/tools/quiet-months'),
  ('deal-memo-recorder', 'creator_studio', 'Deal Memo Recorder', 'A dated record of what was agreed at the moment it was agreed, and a list of what is still missing before work starts.', 'No charge.', 3040, 'free', 'active', '/creator-studio/tools/deal-memo'),
  ('late-payment-escalation', 'creator_studio', 'Late Payment Escalation', 'What a late invoice is costing you including the delay, with a dated ladder of what to send next.', 'No charge.', 3050, 'free', 'active', '/creator-studio/tools/late-payment'),
  ('usage-rights-expiry', 'creator_studio', 'Usage Rights Expiry', 'When a licence you granted runs out, so work still in use becomes a renewal conversation rather than a quiet loss.', 'No charge.', 3060, 'free', 'active', '/creator-studio/tools/rights-expiry'),
  ('referral-source-tracker', 'growth_studio', 'Referral Source Tracker', 'Who actually sends you business, what they are worth, and whether it all rests on one person.', 'No charge.', 3070, 'free', 'active', '/growth-studio/tools/referral-source'),
  ('review-recency-score', 'growth_studio', 'Review Recency Score', 'A strong rating from two years ago reads as a business that used to be good. This scores how current your reviews look.', 'No charge.', 3080, 'free', 'active', '/growth-studio/tools/review-recency'),
  ('enquiry-response-clock', 'growth_studio', 'Enquiry Response Clock', 'A number on what answering enquiries slowly costs you each month, from one stated assumption you can change.', 'No charge.', 3090, 'free', 'active', '/growth-studio/tools/response-time')
) as seed(service_key,product_key,name,summary,price_note,sort_order,plan_floor,lifecycle_status,route_path)
on conflict (service_key) where service_key is not null do update set
  product_key=excluded.product_key,name=excluded.name,summary=excluded.summary,price_note=excluded.price_note,
  status=excluded.status,sort_order=excluded.sort_order,product_type=excluded.product_type,plan_floor=excluded.plan_floor,
  lifecycle_status=excluded.lifecycle_status,route_path=excluded.route_path,metadata=excluded.metadata,updated_at=now();

notify pgrst, 'reload schema';

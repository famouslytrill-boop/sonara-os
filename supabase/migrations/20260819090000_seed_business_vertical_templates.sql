-- Starting points by trade, for a table that has had columns and no rows.
--
-- business_vertical_templates was created with vertical_key, label,
-- plain_language_description and three jsonb arrays of recommendations. Nothing
-- has ever written a row and nothing has ever read one -- it is recorded in
-- lib/sonara-subsystem-registry.cjs as "reference and reporting rather than a
-- workspace", with the note that it "would fit the Business Builder setup flow
-- if that gets built". This is that flow, so the table gets its rows and a page.
--
-- ## Every route named here exists
--
-- recommended_pages holds paths this application actually serves. A template
-- that pointed somebody at /business-builder/scheduling -- which sounds real and
-- is not -- would be a starting point that starts with a 404, and the customer
-- would reasonably conclude the product is broken rather than that the template
-- is wrong. tests/a-starting-point-starts-somewhere.test.js checks every path in
-- every row against the route registry.
--
-- ## The recommendations are a starting point, not a configuration
--
-- Nothing here switches anything on. A template says "a business like yours
-- usually needs these", and the owner decides. That is deliberate: turning
-- features on from a dropdown labelled with somebody's trade is how a customer
-- ends up with pages they did not ask for and cannot find the way out of.

insert into public.business_vertical_templates (vertical_key, label, plain_language_description, recommended_pages, recommended_apps, recommended_modules, status)
values
  (
    'trades_and_home_services',
    'Trades and home services',
    'Plumbers, electricians, roofers, decorators, landscapers -- work priced per job, quoted before it starts, and done at somebody else''s address.',
    '["/business-builder/owner/quotes","/business-builder/owner/receivables","/business-builder/owner/bookings","/business-builder/customers","/business-builder/tools/stop-order"]'::jsonb,
    '["Quotes","Invoices","Appointments","Customer records"]'::jsonb,
    '["quote_to_invoice","round_order","payment_chasing"]'::jsonb,
    'active'
  ),
  (
    'food_and_drink',
    'Food and drink',
    'Cafes, restaurants, bars, food trucks and caterers -- sold by the plate, costed by the ingredient, and judged on what a day made.',
    '["/business-builder/owner/menu","/business-builder/owner/stock-counts","/business-builder/owner/purchase-orders","/business-builder/tools/reorder-point","/business-builder/tools/demand-forecast"]'::jsonb,
    '["Menu costing","Stock counts","Purchase orders","Daily takings"]'::jsonb,
    '["food_cost_percentage","reorder_point","demand_forecast"]'::jsonb,
    'active'
  ),
  (
    'appointment_services',
    'Appointment services',
    'Salons, clinics, therapists, tutors and trainers -- time is the thing being sold, so an empty hour is the thing that costs money.',
    '["/business-builder/owner/bookings","/business-builder/customers","/business-builder/owner/receivables","/growth-studio/tools/response-time","/growth-studio/tools/follow-up-schedule"]'::jsonb,
    '["Appointments","Customer records","Invoices"]'::jsonb,
    '["appointment_reminders","no_show_tracking","response_time"]'::jsonb,
    'active'
  ),
  (
    'retail_and_ecommerce',
    'Retail and online shops',
    'Shops with stock, online or on a street -- the money sits in things on shelves until somebody buys them.',
    '["/business-builder/inventory","/business-builder/owner/stock-counts","/business-builder/tools/reorder-point","/business-builder/tools/break-even","/business-builder/tools/price-rise"]'::jsonb,
    '["Inventory","Stock counts","Suppliers"]'::jsonb,
    '["reorder_point","stock_valuation","price_change"]'::jsonb,
    'active'
  ),
  (
    'professional_services',
    'Professional services',
    'Consultants, bookkeepers, agencies and freelancers -- work quoted as a scope, billed on a schedule, and delivered as a document.',
    '["/business-builder/owner/quotes","/business-builder/owner/receivables","/business-builder/tools/rota","/business-builder/tools/payment-plan","/creator-studio/tools/late-payment"]'::jsonb,
    '["Quotes","Invoices","Payment plans"]'::jsonb,
    '["quote_to_invoice","payment_plan","late_payment"]'::jsonb,
    'active'
  ),
  (
    'creator_and_media',
    'Creators and media',
    'Musicians, video makers, photographers, writers and podcasters -- paid for work that has to stay owned, credited and licensed correctly.',
    '["/creator-studio/tools/rate-card","/creator-studio/tools/split-sheet","/creator-studio/tools/rights-expiry","/creator-studio/artists","/creator-studio/tools/release-checklist"]'::jsonb,
    '["Rate card","Split sheets","Rights tracking","Artist profiles"]'::jsonb,
    '["rate_card","split_sheet","rights_expiry"]'::jsonb,
    'active'
  ),
  (
    'events_and_hire',
    'Events and hire',
    'Venues, equipment hire, event services -- a booking holds a date, and a date held is a date nobody else can have.',
    '["/business-builder/owner/bookings","/business-builder/owner/quotes","/business-builder/owner/receivables","/business-builder/tools/quiet-months"]'::jsonb,
    '["Bookings","Quotes","Deposits"]'::jsonb,
    '["deposit_tracking","seasonal_demand"]'::jsonb,
    'active'
  ),
  (
    'membership_and_subscription',
    'Membership and subscription',
    'Gyms, clubs, studios and anything billed monthly -- the number that matters is how many stay, not how many join.',
    '["/business-builder/customers","/business-builder/owner/receivables","/growth-studio/tools/referral","/growth-studio/tools/goal-tracker","/business-builder/tools/break-even"]'::jsonb,
    '["Members","Recurring invoices","Referrals"]'::jsonb,
    '["retention_tracking","referral_reward","goal_tracking"]'::jsonb,
    'active'
  )
on conflict (vertical_key) do update set
  label = excluded.label,
  plain_language_description = excluded.plain_language_description,
  recommended_pages = excluded.recommended_pages,
  recommended_apps = excluded.recommended_apps,
  recommended_modules = excluded.recommended_modules,
  updated_at = now();

do $report$
begin
  raise notice 'Business vertical templates available: %', (select count(*) from public.business_vertical_templates where status = 'active');
end
$report$;

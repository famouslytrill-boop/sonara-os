create extension if not exists pgcrypto;

-- =========================================================
-- SONARA Ecosystem / Engine / Module Registry
-- Canonical registry of the ecosystems, engines, and user-facing modules discussed during planning.
-- This does not claim a module is live. It tracks status, access, dependencies, and implementation readiness.
-- =========================================================

create table if not exists public.sonara_ecosystem_registry (
  id uuid primary key default gen_random_uuid(),
  ecosystem_key text unique not null,
  name text not null,
  public_label text not null,
  description text not null,
  target_users jsonb not null default '[]'::jsonb,
  product_area text not null check (product_area in ('sonara_industries','business_builder','creator_studio','growth_studio','shared')),
  status text not null default 'planned' check (status in ('planned','active','setup_required','disabled','archived')),
  access_level text not null default 'free' check (access_level in ('public','free','paid','admin','founder')),
  sort_order integer default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.sonara_engine_registry (
  id uuid primary key default gen_random_uuid(),
  engine_key text unique not null,
  ecosystem_key text references public.sonara_ecosystem_registry(ecosystem_key) on delete cascade,
  name text not null,
  public_label text not null,
  description text not null,
  engine_type text not null check (engine_type in ('account','platform','website','app','paywall','billing','publishing','support','admin','employee','operations','restaurant','inventory','vehicle','creator','audio','ai','device','analytics','security','legal','integration','automation','open_source','document','marketing','translation','other')),
  source_tables jsonb not null default '[]'::jsonb,
  required_services jsonb not null default '[]'::jsonb,
  status text not null default 'planned' check (status in ('planned','active','setup_required','disabled','archived')),
  access_level text not null default 'free' check (access_level in ('public','free','paid','admin','founder')),
  sort_order integer default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.sonara_module_registry (
  id uuid primary key default gen_random_uuid(),
  module_key text unique not null,
  engine_key text references public.sonara_engine_registry(engine_key) on delete cascade,
  ecosystem_key text references public.sonara_ecosystem_registry(ecosystem_key) on delete cascade,
  name text not null,
  public_label text not null,
  description text not null,
  module_type text not null check (module_type in ('page','api','form','dashboard','workflow','record','calculation','integration','report','export','worker','setting','device','media','security','other')),
  route_path text,
  api_path text,
  source_tables jsonb not null default '[]'::jsonb,
  produces_result text not null,
  access_level text not null default 'free' check (access_level in ('public','free','paid','admin','founder','employee')),
  billing_required boolean not null default false,
  owner_controlled boolean not null default true,
  employee_visible boolean not null default false,
  customer_visible boolean not null default false,
  status text not null default 'planned' check (status in ('planned','active','setup_required','disabled','archived')),
  sort_order integer default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.sonara_module_dependencies (
  id uuid primary key default gen_random_uuid(),
  module_key text references public.sonara_module_registry(module_key) on delete cascade,
  dependency_type text not null check (dependency_type in ('table','service','env_var','provider','worker','route','policy','storage','secret','other')),
  dependency_key text not null,
  required boolean not null default true,
  status text not null default 'planned' check (status in ('planned','configured','missing','deferred','disabled')),
  notes text,
  created_at timestamptz default now(),
  unique(module_key, dependency_type, dependency_key)
);

create index if not exists sonara_engine_registry_ecosystem_idx on public.sonara_engine_registry(ecosystem_key);
create index if not exists sonara_module_registry_engine_idx on public.sonara_module_registry(engine_key);
create index if not exists sonara_module_registry_ecosystem_idx on public.sonara_module_registry(ecosystem_key);
create index if not exists sonara_module_registry_status_idx on public.sonara_module_registry(status);

alter table public.sonara_ecosystem_registry enable row level security;
alter table public.sonara_engine_registry enable row level security;
alter table public.sonara_module_registry enable row level security;
alter table public.sonara_module_dependencies enable row level security;

drop policy if exists "public read active ecosystem registry" on public.sonara_ecosystem_registry;
create policy "public read active ecosystem registry" on public.sonara_ecosystem_registry for select using (status in ('planned','active','setup_required'));

drop policy if exists "public read active engine registry" on public.sonara_engine_registry;
create policy "public read active engine registry" on public.sonara_engine_registry for select using (status in ('planned','active','setup_required'));

drop policy if exists "public read active module registry" on public.sonara_module_registry;
create policy "public read active module registry" on public.sonara_module_registry for select using (status in ('planned','active','setup_required'));

drop policy if exists "public read module dependencies" on public.sonara_module_dependencies;
create policy "public read module dependencies" on public.sonara_module_dependencies for select using (true);

drop policy if exists "service role manages ecosystem registry" on public.sonara_ecosystem_registry;
create policy "service role manages ecosystem registry" on public.sonara_ecosystem_registry for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service role manages engine registry" on public.sonara_engine_registry;
create policy "service role manages engine registry" on public.sonara_engine_registry for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service role manages module registry" on public.sonara_module_registry;
create policy "service role manages module registry" on public.sonara_module_registry for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service role manages module dependencies" on public.sonara_module_dependencies;
create policy "service role manages module dependencies" on public.sonara_module_dependencies for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

insert into public.sonara_ecosystem_registry (ecosystem_key, name, public_label, description, target_users, product_area, status, access_level, sort_order)
values
('sonara_industries','SONARA Industries','SONARA Industries','Parent company command center for brands, billing, support, legal, readiness, open-source catalog, and system governance.','["founder","admin","support"]'::jsonb,'sonara_industries','planned','admin',10),
('business_builder','Business Builder','Business Builder','Business operating system for service businesses, salons, restaurants, food trucks, ice cream stands, mobile vendors, and local operators.','["business owner","manager","employee","customer"]'::jsonb,'business_builder','planned','free',20),
('creator_studio','Creator Studio','Creator Studio','Creator operating system for music projects, release planning, DAW/audio workflows, assets, prompts, videos, and creator monetization.','["creator","artist","producer","label","designer"]'::jsonb,'creator_studio','planned','free',30),
('growth_studio','Growth Studio','Growth Studio','Growth operating system for campaigns, leads, funnels, experiments, analytics, automations, and field marketing.','["marketer","founder","sales team","campaign manager"]'::jsonb,'growth_studio','planned','free',40),
('shared_platform','Shared Platform','Shared Platform','Shared account, organization, access, paywall, publishing, device, integration, and observability systems.','["all users"]'::jsonb,'shared','planned','free',50)
on conflict (ecosystem_key) do update set
  name = excluded.name,
  public_label = excluded.public_label,
  description = excluded.description,
  target_users = excluded.target_users,
  product_area = excluded.product_area,
  status = excluded.status,
  access_level = excluded.access_level,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.sonara_engine_registry (engine_key, ecosystem_key, name, public_label, description, engine_type, source_tables, required_services, status, access_level, sort_order)
values
('account_org_engine','shared_platform','Account and Business Access Engine','Accounts and Access','Profiles, organizations, memberships, staff, owner, admin, founder, and customer role logic.','account','["profiles","organizations","organization_memberships","user_roles"]'::jsonb,'["supabase_auth"]'::jsonb,'planned','free',10),
('platform_builder_engine','shared_platform','Platform Builder Engine','Platform Builder','Creates websites, pages, apps, subapps, modules, templates, previews, and publishing records.','platform','["sonara_platforms","sonara_platform_pages","sonara_platform_apps","sonara_platform_modules","sonara_platform_publications","sonara_platform_templates"]'::jsonb,'["supabase"]'::jsonb,'planned','free',20),
('website_page_engine','shared_platform','Website and Page Engine','Website Pages','Creates public pages, subpages, sections, SEO fields, previews, and published snapshots.','website','["sonara_platform_pages","sonara_platform_publications"]'::jsonb,'["supabase"]'::jsonb,'planned','free',30),
('app_subapp_engine','shared_platform','App and Subapp Engine','Apps','Creates private app workspaces, app sections, tools, and module records.','app','["sonara_platform_apps","sonara_platform_modules"]'::jsonb,'["supabase"]'::jsonb,'planned','free',40),
('paywall_engine','shared_platform','Paywall and Access Engine','Access and Plans','Controls free, paid, admin, founder, and employee access across all ecosystems.','paywall','["plans","organization_entitlements","subscriptions","purchases","billing_subscriptions"]'::jsonb,'["stripe","supabase"]'::jsonb,'planned','free',50),
('billing_engine','shared_platform','Billing Engine','Payments','Stripe checkout, subscriptions, purchases, customer portal, webhook records, and paid state.','billing','["stripe_customers","subscriptions","purchases","billing_webhook_events","organization_entitlements"]'::jsonb,'["stripe"]'::jsonb,'setup_required','paid',60),
('publishing_engine','shared_platform','Publishing Engine','Publish','Creates preview and published snapshots for public routes.','publishing','["sonara_platform_publications"]'::jsonb,'["supabase"]'::jsonb,'planned','paid',70),
('support_engine','shared_platform','Support Engine','Support','Support request capture, status tracking, admin queue, and optional email notifications.','support','["support_requests","activity_events"]'::jsonb,'["resend"]'::jsonb,'setup_required','free',80),
('admin_observability_engine','sonara_industries','Admin Observability Engine','Admin Dashboard','Readiness, counts, deployment status, billing events, support, users, modules, and system health.','admin','["profiles","organizations","support_requests","billing_webhook_events","sonara_module_registry"]'::jsonb,'["vercel","supabase"]'::jsonb,'planned','admin',90),
('open_source_catalog_engine','sonara_industries','Open Source Catalog Engine','Software Library','Tracks open-source software, capabilities, adapter runs, review state, and risk before activation.','open_source','["open_source_software_catalog","open_source_software_capabilities","open_source_adapter_runs"]'::jsonb,'["supabase"]'::jsonb,'planned','admin',100),
('employee_workforce_engine','business_builder','Employee and Workforce Engine','Staff','Employee profiles, schedules, time entries, pay summaries, announcements, tasks, and job posts.','employee','["business_employee_profiles","employee_schedules","employee_time_entries","employee_pay_statements","employee_announcements","employee_tasks","employee_job_posts"]'::jsonb,'["supabase"]'::jsonb,'planned','paid',110),
('business_operations_engine','business_builder','Business Operations Engine','Business Operations','Locations, services, bookings, customers, orders, support, inventory, assets, and daily business records.','operations','["business_locations","business_service_catalog","business_bookings","customer_records","order_records","support_requests"]'::jsonb,'["supabase"]'::jsonb,'planned','free',120),
('restaurant_margin_engine','business_builder','Restaurant and Margin Engine','Food Costs','Vendors, invoices, recipes, menu costing, inventory counts, waste, sales mix, daily profit, and accounting exports.','restaurant','["vendor_accounts","vendor_invoices","recipe_cards","menu_items","daily_profit_snapshots","waste_logs","accounting_exports"]'::jsonb,'["supabase"]'::jsonb,'planned','paid',130),
('vehicle_route_engine','business_builder','Vehicle and Route Engine','Vehicles and Routes','Vehicles, trailers, food trucks, inspections, maintenance, GPS events, and route tracking.','vehicle','["vehicle_records","vehicle_inspections","maintenance_logs","route_tracking_sessions","route_tracking_points","location_events"]'::jsonb,'["browser_geolocation"]'::jsonb,'planned','paid',140),
('creator_music_system_engine','creator_studio','Music Creation System Engine','Music System','Original artist/project systems, voice profiles, sound maps, story arcs, song blueprints, production notes, prompt packs, QA, and export packages.','creator','["creator_artist_systems","creator_voice_profiles","creator_song_blueprints","creator_prompt_packs","creator_quality_checks","creator_export_packages"]'::jsonb,'["supabase"]'::jsonb,'planned','free',150),
('audio_daw_engine','creator_studio','Audio and DAW Engine','Audio and DAW','Music projects, DAW sessions, audio assets, stems, sound analysis, cue timing, and export metadata.','audio','["music_projects","daw_sessions","audio_assets","sound_analysis_results","vibration_animation_cues"]'::jsonb,'["ffmpeg","essentia","librosa"]'::jsonb,'planned','paid',160),
('ai_integration_engine','creator_studio','AI and Integration Engine','AI Jobs','Tracks AI/audio/music provider jobs, manual exports, API jobs, and provider readiness.','ai','["integration_providers","organization_integrations","integration_jobs"]'::jsonb,'["provider_review"]'::jsonb,'planned','paid',170),
('device_sensory_engine','shared_platform','Device Sensory Engine','Device Feedback','Sound cues, vibration, haptics, GPS, gyroscope/orientation, motion events, and device capability tracking.','device','["device_capability_profiles","sound_cues","haptic_patterns","location_events","motion_sensor_events"]'::jsonb,'["browser_web_audio","browser_vibration","browser_geolocation","browser_device_orientation"]'::jsonb,'planned','free',180),
('growth_campaign_engine','growth_studio','Growth Campaign Engine','Campaigns','Campaign pages, offer pages, funnels, leads, outreach, experiments, analytics, and automations.','marketing','["growth_campaigns","growth_leads","growth_experiments","automation_rules"]'::jsonb,'["supabase"]'::jsonb,'planned','free',190),
('document_ocr_engine','business_builder','Document and OCR Engine','Documents','Invoices, receipts, PDFs, OCR, table extraction, document parsing, and back-office records.','document','["vendor_invoices","vendor_invoice_lines","open_source_adapter_runs"]'::jsonb,'["tesseract","paddleocr","pdfplumber","invoice2data"]'::jsonb,'planned','paid',200),
('legal_security_engine','sonara_industries','Legal and Security Engine','Legal and Security','Legal pages, privacy, terms, policy tracking, audit logs, access controls, and setup-required states.','legal','["admin_audit_logs","sonara_module_dependencies"]'::jsonb,'["supabase","opa"]'::jsonb,'planned','admin',210),
('translation_measurement_engine','shared_platform','Translation and Measurement Engine','Language and Units','Translation preferences, public language rules, metric/imperial settings, and user-friendly terminology.','translation','[]'::jsonb,'["browser_locale"]'::jsonb,'planned','free',220)
on conflict (engine_key) do update set
  ecosystem_key = excluded.ecosystem_key,
  name = excluded.name,
  public_label = excluded.public_label,
  description = excluded.description,
  engine_type = excluded.engine_type,
  source_tables = excluded.source_tables,
  required_services = excluded.required_services,
  status = excluded.status,
  access_level = excluded.access_level,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.sonara_module_registry (module_key, engine_key, ecosystem_key, name, public_label, description, module_type, route_path, api_path, source_tables, produces_result, access_level, billing_required, owner_controlled, employee_visible, customer_visible, status, sort_order)
values
('profile_setup','account_org_engine','shared_platform','Profile Setup','Profile Setup','Creates and updates user profile records.','form','/account','/api/account/profile','["profiles"]'::jsonb,'Saved user profile', 'free', false, true, false, false, 'planned', 10),
('organization_setup','account_org_engine','shared_platform','Business Setup','Business Setup','Creates and updates organization/business records.','form','/account/business','/api/account/organization','["organizations","organization_memberships"]'::jsonb,'Saved business record and membership', 'free', false, true, false, false, 'planned', 20),
('platform_create','platform_builder_engine','shared_platform','Create Platform','Create Platform','Creates a website/app platform from templates.','workflow','/business-builder/platforms/new','/api/platforms','["sonara_platforms","sonara_platform_pages","sonara_platform_apps","sonara_platform_modules"]'::jsonb,'Saved platform with pages/apps/modules', 'free', false, true, false, false, 'planned', 30),
('page_builder','website_page_engine','shared_platform','Page Builder','Pages','Creates pages and subpages with sections and SEO fields.','form','/platform/pages','/api/platforms/:id/pages','["sonara_platform_pages"]'::jsonb,'Saved page or subpage', 'free', false, true, false, true, 'planned', 40),
('app_builder','app_subapp_engine','shared_platform','App Builder','Apps','Creates private apps, app sections, and tools.','workflow','/platform/apps','/api/platforms/:id/apps','["sonara_platform_apps","sonara_platform_modules"]'::jsonb,'Saved app and tool records', 'free', false, true, false, false, 'planned', 50),
('preview_publish','publishing_engine','shared_platform','Preview and Publish','Preview and Publish','Creates previews and published snapshots for public pages.','workflow','/platform/preview','/api/platforms/:id/publish','["sonara_platform_publications"]'::jsonb,'Published snapshot', 'paid', true, true, false, true, 'planned', 60),
('checkout_subscription','billing_engine','shared_platform','Checkout','Checkout','Starts Stripe checkout and records subscription/purchase state through webhook.','workflow','/pricing','/api/checkout','["subscriptions","purchases","billing_webhook_events","organization_entitlements"]'::jsonb,'Paid access record after webhook', 'paid', true, true, false, true, 'setup_required', 70),
('support_queue','support_engine','shared_platform','Support Queue','Support','Creates support requests and shows owner/admin queue.','dashboard','/support','/api/support','["support_requests"]'::jsonb,'Saved support request', 'free', false, true, false, true, 'setup_required', 80),
('owner_dashboard','business_operations_engine','business_builder','Owner Dashboard','Owner Dashboard','Business owner view for daily operations and system counts.','dashboard','/business-builder/owner',null,'["business_locations","business_employee_profiles","inventory_items","vendor_invoices"]'::jsonb,'Business operations overview', 'free', false, true, false, false, 'planned', 90),
('staff_portal','employee_workforce_engine','business_builder','Staff Portal','Staff Portal','Employee view for schedule, tasks, announcements, time entries, and job information.','dashboard','/staff',null,'["business_employee_profiles","employee_schedules","employee_time_entries","employee_tasks"]'::jsonb,'Employee job dashboard', 'employee', false, true, true, false, 'planned', 100),
('time_clock','employee_workforce_engine','business_builder','Time Clock','Time Clock','Starts and stops employee time entries.','workflow','/staff/time','/api/business/time-entries/start','["employee_time_entries"]'::jsonb,'Saved clock-in and clock-out records', 'employee', false, true, true, false, 'planned', 110),
('staff_schedule','employee_workforce_engine','business_builder','Staff Schedule','Schedule','Creates and displays employee schedules.','dashboard','/business-builder/owner/schedules','/api/business/schedules','["employee_schedules"]'::jsonb,'Saved shift schedule records', 'paid', true, true, true, false, 'planned', 120),
('pay_summary','employee_workforce_engine','business_builder','Pay Summary','Pay Info','Shows wage rates and pay summaries where owner allows.','report','/staff/pay','/api/business/pay-statements','["employee_wage_rates","employee_pay_statements"]'::jsonb,'Pay summary records', 'paid', true, true, true, false, 'planned', 130),
('service_catalog','business_operations_engine','business_builder','Service Catalog','Services','Creates services, menu items, offers, durations, and prices.','form','/business-builder/owner/services','/api/business/services','["business_service_catalog"]'::jsonb,'Saved service records', 'free', false, true, false, true, 'planned', 140),
('bookings','business_operations_engine','business_builder','Bookings','Bookings','Creates and manages customer bookings.','workflow','/business-builder/owner/bookings','/api/business/bookings','["business_bookings","customer_records"]'::jsonb,'Saved booking records', 'free', false, true, false, true, 'planned', 150),
('inventory','business_operations_engine','business_builder','Inventory','Inventory','Tracks items, quantities, cost, price, reorder levels, and movements.','dashboard','/business-builder/owner/inventory','/api/business/inventory','["inventory_items","inventory_movements"]'::jsonb,'Inventory records and movement logs', 'paid', true, true, false, false, 'planned', 160),
('vendor_invoices','restaurant_margin_engine','business_builder','Vendor Invoices','Invoices','Tracks vendors, invoices, invoice lines, approvals, payment status, and exports.','workflow','/business-builder/owner/invoices','/api/business/invoices','["vendor_accounts","vendor_invoices","vendor_invoice_lines"]'::jsonb,'Invoice and line-item records', 'paid', true, true, false, false, 'planned', 170),
('recipes_menu_cost','restaurant_margin_engine','business_builder','Recipes and Menu Cost','Recipes and Menu','Tracks recipes, ingredients, menu items, theoretical cost, and margin.','calculation','/business-builder/owner/menu','/api/business/menu-items','["recipe_cards","recipe_ingredients","menu_items"]'::jsonb,'Menu cost and margin data', 'paid', true, true, false, false, 'planned', 180),
('daily_profit','restaurant_margin_engine','business_builder','Daily Profit','Daily Profit','Calculates daily sales, food cost, labor cost, prime cost, and profit snapshots.','report','/business-builder/owner/costs','/api/business/costs','["daily_profit_snapshots","pos_sales_summaries","employee_time_entries"]'::jsonb,'Daily profit report', 'paid', true, true, false, false, 'planned', 190),
('vehicles_trailers','vehicle_route_engine','business_builder','Vehicles and Trailers','Vehicles','Tracks vehicles, trailers, inspections, maintenance, registrations, and assigned routes.','dashboard','/business-builder/owner/vehicles','/api/business/vehicles','["vehicle_records","vehicle_inspections","maintenance_logs"]'::jsonb,'Vehicle and trailer records', 'paid', true, true, true, false, 'planned', 200),
('location_routes','vehicle_route_engine','business_builder','Location and Routes','Routes','Records GPS check-ins, delivery stops, job-site arrivals, and route points.','device','/staff/location','/api/location/events','["location_events","route_tracking_sessions","route_tracking_points"]'::jsonb,'Location and route records', 'paid', true, true, true, false, 'planned', 210),
('music_system','creator_music_system_engine','creator_studio','Music Creation System','Music System','Creates original music/project systems and creative rules.','dashboard','/creator-studio/music-system','/api/creator/artist-systems','["creator_artist_systems"]'::jsonb,'Saved music system record', 'free', false, true, false, false, 'planned', 220),
('song_blueprint','creator_music_system_engine','creator_studio','Song Blueprint','Song Blueprint','Creates song plans with key, rhythm, harmony, drums, vocal mode, structure, and theme.','form','/creator-studio/music-system/song','/api/creator/song-blueprints','["creator_song_blueprints"]'::jsonb,'Saved song blueprint', 'free', false, true, false, false, 'planned', 230),
('prompt_packs','creator_music_system_engine','creator_studio','Instruction Packs','Instruction Packs','Creates reusable music, vocal, mix, video, cover, and sound-design instructions.','form','/creator-studio/music-system/prompts','/api/creator/prompt-packs','["creator_prompt_packs"]'::jsonb,'Saved instruction pack', 'free', false, true, false, false, 'planned', 240),
('production_notes','creator_music_system_engine','creator_studio','Production Notes','Production Notes','Stores production, mix, master, vocal, arrangement, sound design, visual, and release notes.','record',null,'/api/creator/production-notes','["creator_production_notes"]'::jsonb,'Saved production note', 'free', false, true, false, false, 'planned', 250),
('quality_checks','creator_music_system_engine','creator_studio','Quality Checks','Quality Checks','Tracks originality, prompt rules, structure, vocal fit, production fit, release readiness, and safety review.','workflow',null,'/api/creator/quality-checks','["creator_quality_checks"]'::jsonb,'Saved quality review', 'free', false, true, false, false, 'planned', 260),
('export_packages','creator_music_system_engine','creator_studio','Export Packages','Exports','Packages songs, prompts, release data, video notes, DAW notes, and file manifest records.','export',null,'/api/creator/export-packages','["creator_export_packages"]'::jsonb,'Saved export package', 'paid', true, true, false, false, 'planned', 270),
('daw_sessions','audio_daw_engine','creator_studio','DAW Sessions','DAW Sessions','Tracks DAW sessions, stems, file references, tempo, sample rate, and export metadata.','record','/creator-studio/music-projects','/api/creator/music-projects/:id/daw-sessions','["daw_sessions","audio_assets"]'::jsonb,'Saved DAW session metadata', 'paid', true, true, false, false, 'planned', 280),
('audio_analysis','audio_daw_engine','creator_studio','Audio Analysis','Sound Analysis','Analyzes tempo, timbre, rhythm, stems, transcription, fingerprints, and sound features through reviewed workers.','worker',null,'/api/creator/audio-assets/:id/analyze','["sound_analysis_results","open_source_adapter_runs"]'::jsonb,'Saved audio analysis result', 'paid', true, true, false, false, 'planned', 290),
('sound_vibration_cues','device_sensory_engine','shared_platform','Sound and Vibration Cues','Sound and Motion','Creates sound cues, haptic patterns, tactile events, GPS/motion/orientation events, and animation cues.','device','/settings/device-feedback','/api/sensory/events','["sound_cues","haptic_patterns","tactile_events","motion_sensor_events","location_events"]'::jsonb,'Saved device and cue events', 'free', false, true, true, false, 'planned', 300),
('growth_campaigns','growth_campaign_engine','growth_studio','Campaigns','Campaigns','Creates growth campaigns, offers, funnels, leads, experiments, and analytics records.','dashboard','/growth-studio/platforms','/api/growth/campaigns','["growth_campaigns","growth_leads","growth_experiments"]'::jsonb,'Campaign and lead records', 'free', false, true, false, false, 'planned', 310),
('automation_rules','growth_campaign_engine','growth_studio','Automation Rules','Automations','Stores disabled-by-default automation rules until a real worker exists.','setting','/growth-studio/automations','/api/growth/automations','["automation_rules"]'::jsonb,'Saved automation settings', 'paid', true, true, false, false, 'planned', 320),
('document_ocr','document_ocr_engine','business_builder','Document OCR','Document Scan','Extracts invoice, receipt, PDF, and document data through reviewed OCR/document workers.','worker',null,'/api/documents/ocr','["vendor_invoices","open_source_adapter_runs"]'::jsonb,'Extracted document data', 'paid', true, true, false, false, 'planned', 330),
('software_catalog','open_source_catalog_engine','sonara_industries','Open Source Software Catalog','Software Library','Shows open-source tools by product area, status, risk, capability, and adapter readiness.','dashboard','/admin/open-source-software','/api/open-source-software','["open_source_software_catalog","open_source_software_capabilities"]'::jsonb,'Reviewed software catalog', 'admin', false, true, false, false, 'planned', 340),
('legal_center','legal_security_engine','sonara_industries','Legal Center','Legal Center','Tracks terms, privacy, policies, disclaimers, audit logs, and legal setup-required states.','dashboard','/legal','/api/legal','["admin_audit_logs"]'::jsonb,'Legal readiness records', 'admin', false, true, false, true, 'planned', 350),
('language_units','translation_measurement_engine','shared_platform','Language and Units','Language and Units','Stores translation/language preferences, metric/imperial choices, and public terminology rules.','setting','/settings/preferences','/api/settings/preferences','[]'::jsonb,'Saved user preference settings', 'free', false, true, true, true, 'planned', 360)
on conflict (module_key) do update set
  engine_key = excluded.engine_key,
  ecosystem_key = excluded.ecosystem_key,
  name = excluded.name,
  public_label = excluded.public_label,
  description = excluded.description,
  module_type = excluded.module_type,
  route_path = excluded.route_path,
  api_path = excluded.api_path,
  source_tables = excluded.source_tables,
  produces_result = excluded.produces_result,
  access_level = excluded.access_level,
  billing_required = excluded.billing_required,
  owner_controlled = excluded.owner_controlled,
  employee_visible = excluded.employee_visible,
  customer_visible = excluded.customer_visible,
  status = excluded.status,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.sonara_module_dependencies (module_key, dependency_type, dependency_key, required, status, notes)
select module_key, 'table', jsonb_array_elements_text(source_tables), true, 'planned', 'Module requires this database table or compatible view.'
from public.sonara_module_registry
where jsonb_array_length(source_tables) > 0
on conflict (module_key, dependency_type, dependency_key) do update set
  required = excluded.required,
  status = excluded.status,
  notes = excluded.notes;

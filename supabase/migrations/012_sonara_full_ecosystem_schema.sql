create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  plan_key text unique not null,
  company_key text not null,
  name text not null,
  description text,
  price_id text,
  billing_interval text check (billing_interval in ('free','month','year','one_time')),
  access_level text not null default 'free' check (access_level in ('free','paid','admin')),
  limits jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.organization_entitlements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  source_type text not null check (source_type in ('subscription','purchase','manual_admin','founder','trial')),
  source_id text,
  company_key text,
  product_key text,
  access_level text not null check (access_level in ('free','paid','admin','founder')),
  starts_at timestamptz default now(),
  ends_at timestamptz,
  status text not null default 'active' check (status in ('active','expired','revoked')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.sonara_platforms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  company_key text not null check (company_key in ('sonara_industries','business_builder','creator_studio','growth_studio')),
  product_key text not null,
  name text not null,
  slug text not null,
  platform_type text not null default 'custom' check (platform_type in ('business','creator','growth','parent_company','campaign','release','service_business','custom')),
  description text,
  status text not null default 'draft' check (status in ('draft','preview','published','archived')),
  theme jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists sonara_platforms_slug_unique_idx on public.sonara_platforms(slug);
create index if not exists sonara_platforms_org_idx on public.sonara_platforms(organization_id);
create index if not exists sonara_platforms_company_idx on public.sonara_platforms(company_key);

create table if not exists public.sonara_platform_pages (
  id uuid primary key default gen_random_uuid(),
  platform_id uuid references public.sonara_platforms(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  company_key text not null,
  parent_page_id uuid references public.sonara_platform_pages(id) on delete cascade,
  title text not null,
  slug text not null,
  page_type text not null default 'custom' check (page_type in ('home','about','services','pricing','contact','portfolio','release','campaign','offer','funnel','legal','custom')),
  sort_order integer default 0,
  is_home boolean default false,
  status text not null default 'draft' check (status in ('draft','preview','published','archived')),
  seo_title text,
  seo_description text,
  sections jsonb not null default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists sonara_platform_pages_unique_slug_idx on public.sonara_platform_pages(platform_id, slug);
create index if not exists sonara_platform_pages_platform_idx on public.sonara_platform_pages(platform_id);

create table if not exists public.sonara_platform_apps (
  id uuid primary key default gen_random_uuid(),
  platform_id uuid references public.sonara_platforms(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  company_key text not null,
  parent_app_id uuid references public.sonara_platform_apps(id) on delete cascade,
  name text not null,
  slug text not null,
  app_type text not null default 'custom' check (app_type in ('dashboard','intake','customers','orders','payments','support','assets','releases','campaigns','leads','analytics','automations','content','custom')),
  access_level text not null default 'free' check (access_level in ('free','paid','admin')),
  status text not null default 'active' check (status in ('active','inactive','archived')),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists sonara_platform_apps_unique_slug_idx on public.sonara_platform_apps(platform_id, slug);
create index if not exists sonara_platform_apps_platform_idx on public.sonara_platform_apps(platform_id);

create table if not exists public.sonara_platform_modules (
  id uuid primary key default gen_random_uuid(),
  platform_id uuid references public.sonara_platforms(id) on delete cascade,
  app_id uuid references public.sonara_platform_apps(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  company_key text not null,
  name text not null,
  module_key text not null,
  module_type text not null default 'custom' check (module_type in ('form','table','checklist','billing','support','asset_library','release_tracker','campaign_tracker','lead_pipeline','analytics','automation','content','custom')),
  access_level text not null default 'free' check (access_level in ('free','paid','admin')),
  config jsonb not null default '{}'::jsonb,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists sonara_platform_modules_unique_idx on public.sonara_platform_modules(app_id, module_key);

create table if not exists public.sonara_platform_publications (
  id uuid primary key default gen_random_uuid(),
  platform_id uuid references public.sonara_platforms(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  company_key text not null,
  slug text not null,
  version_label text,
  status text not null default 'published' check (status in ('published','rolled_back','archived')),
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists sonara_platform_publications_slug_idx on public.sonara_platform_publications(company_key, slug);

create table if not exists public.sonara_platform_templates (
  id uuid primary key default gen_random_uuid(),
  company_key text not null,
  template_key text not null,
  name text not null,
  description text,
  platform_type text not null default 'custom',
  default_pages jsonb not null default '[]'::jsonb,
  default_apps jsonb not null default '[]'::jsonb,
  default_modules jsonb not null default '[]'::jsonb,
  access_level text not null default 'free' check (access_level in ('free','paid','admin')),
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_at timestamptz default now(),
  unique(company_key, template_key)
);

create table if not exists public.customer_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  platform_id uuid references public.sonara_platforms(id) on delete set null,
  name text not null,
  email text,
  phone text,
  status text not null default 'lead' check (status in ('lead','active','inactive','archived')),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.order_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  platform_id uuid references public.sonara_platforms(id) on delete set null,
  customer_id uuid references public.customer_records(id) on delete set null,
  title text not null,
  amount_cents integer default 0,
  currency text default 'usd',
  status text not null default 'draft' check (status in ('draft','pending','paid','fulfilled','cancelled','refunded')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.creator_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  platform_id uuid references public.sonara_platforms(id) on delete set null,
  title text not null,
  asset_type text not null default 'file' check (asset_type in ('image','video','audio','document','link','file','other')),
  url text,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','ready','published','archived')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.creator_releases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  platform_id uuid references public.sonara_platforms(id) on delete set null,
  title text not null,
  release_type text default 'project',
  release_date date,
  status text not null default 'planning' check (status in ('planning','ready','released','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.growth_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  platform_id uuid references public.sonara_platforms(id) on delete set null,
  name text not null,
  goal text,
  channel text,
  status text not null default 'draft' check (status in ('draft','active','paused','completed','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.growth_leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  platform_id uuid references public.sonara_platforms(id) on delete set null,
  campaign_id uuid references public.growth_campaigns(id) on delete set null,
  name text,
  email text,
  phone text,
  source text,
  status text not null default 'new' check (status in ('new','contacted','qualified','won','lost','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.growth_experiments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  platform_id uuid references public.sonara_platforms(id) on delete set null,
  campaign_id uuid references public.growth_campaigns(id) on delete set null,
  name text not null,
  hypothesis text,
  result text,
  status text not null default 'planned' check (status in ('planned','running','won','lost','inconclusive','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  platform_id uuid references public.sonara_platforms(id) on delete set null,
  name text not null,
  trigger_key text,
  action_key text,
  status text not null default 'disabled' check (status in ('disabled','active','archived')),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.plans enable row level security;
alter table public.organization_entitlements enable row level security;
alter table public.sonara_platforms enable row level security;
alter table public.sonara_platform_pages enable row level security;
alter table public.sonara_platform_apps enable row level security;
alter table public.sonara_platform_modules enable row level security;
alter table public.sonara_platform_publications enable row level security;
alter table public.sonara_platform_templates enable row level security;
alter table public.customer_records enable row level security;
alter table public.order_records enable row level security;
alter table public.creator_assets enable row level security;
alter table public.creator_releases enable row level security;
alter table public.growth_campaigns enable row level security;
alter table public.growth_leads enable row level security;
alter table public.growth_experiments enable row level security;
alter table public.automation_rules enable row level security;

drop policy if exists "public read active plans" on public.plans;
create policy "public read active plans" on public.plans for select using (status = 'active');

drop policy if exists "public read active templates" on public.sonara_platform_templates;
create policy "public read active templates" on public.sonara_platform_templates for select using (status = 'active');

drop policy if exists "public read published platforms" on public.sonara_platforms;
create policy "public read published platforms" on public.sonara_platforms for select using (status = 'published');

drop policy if exists "public read published pages" on public.sonara_platform_pages;
create policy "public read published pages" on public.sonara_platform_pages for select using (status = 'published');

drop policy if exists "public read published publications" on public.sonara_platform_publications;
create policy "public read published publications" on public.sonara_platform_publications for select using (status = 'published');

-- Service role policies are required because the Express server uses SUPABASE_SERVICE_ROLE_KEY server-side.
drop policy if exists "service role manages plans" on public.plans;
create policy "service role manages plans" on public.plans for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service role manages entitlements" on public.organization_entitlements;
create policy "service role manages entitlements" on public.organization_entitlements for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service role manages platforms" on public.sonara_platforms;
create policy "service role manages platforms" on public.sonara_platforms for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service role manages pages" on public.sonara_platform_pages;
create policy "service role manages pages" on public.sonara_platform_pages for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service role manages apps" on public.sonara_platform_apps;
create policy "service role manages apps" on public.sonara_platform_apps for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service role manages modules" on public.sonara_platform_modules;
create policy "service role manages modules" on public.sonara_platform_modules for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service role manages publications" on public.sonara_platform_publications;
create policy "service role manages publications" on public.sonara_platform_publications for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service role manages templates" on public.sonara_platform_templates;
create policy "service role manages templates" on public.sonara_platform_templates for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service role manages customers" on public.customer_records;
create policy "service role manages customers" on public.customer_records for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service role manages orders" on public.order_records;
create policy "service role manages orders" on public.order_records for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service role manages creator assets" on public.creator_assets;
create policy "service role manages creator assets" on public.creator_assets for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service role manages creator releases" on public.creator_releases;
create policy "service role manages creator releases" on public.creator_releases for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service role manages growth campaigns" on public.growth_campaigns;
create policy "service role manages growth campaigns" on public.growth_campaigns for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service role manages growth leads" on public.growth_leads;
create policy "service role manages growth leads" on public.growth_leads for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service role manages growth experiments" on public.growth_experiments;
create policy "service role manages growth experiments" on public.growth_experiments for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service role manages automation rules" on public.automation_rules;
create policy "service role manages automation rules" on public.automation_rules for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

insert into public.plans (plan_key, company_key, name, description, billing_interval, access_level, limits, status)
values
('free','sonara_industries','Free','Starter access for limited platforms and previews.','free','free','{"platforms":1,"pages":5,"apps":2,"modules":2,"publish":false}'::jsonb,'active'),
('business_builder_monthly','business_builder','Business Builder Monthly','Paid access for business platforms, publishing, customer records, orders, support, and billing workflows.','month','paid','{"platforms":10,"pages":100,"apps":25,"modules":100,"publish":true}'::jsonb,'active'),
('creator_studio_monthly','creator_studio','Creator Studio Monthly','Paid access for creator platforms, assets, releases, campaigns, and monetization workflows.','month','paid','{"platforms":10,"pages":100,"apps":25,"modules":100,"publish":true}'::jsonb,'active'),
('growth_studio_monthly','growth_studio','Growth Studio Monthly','Paid access for growth platforms, campaigns, leads, analytics, and experiments.','month','paid','{"platforms":10,"pages":100,"apps":25,"modules":100,"publish":true}'::jsonb,'active'),
('business_builder_onetime','business_builder','Business Builder One-Time Setup','One-time setup package for launch readiness and platform setup.','one_time','paid','{"platforms":3,"pages":30,"apps":10,"modules":30,"publish":true}'::jsonb,'active')
on conflict (plan_key) do update set name = excluded.name, description = excluded.description, billing_interval = excluded.billing_interval, access_level = excluded.access_level, limits = excluded.limits, status = excluded.status, updated_at = now();

insert into public.sonara_platform_templates (company_key, template_key, name, description, platform_type, default_pages, default_apps, default_modules, access_level, status)
values
('business_builder','service_business_platform','Service Business Platform','Website, intake, offers, pricing, customer records, support, and billing readiness for small service businesses.','service_business','[{"title":"Home","slug":"home","page_type":"home"},{"title":"About","slug":"about","page_type":"about"},{"title":"Services","slug":"services","page_type":"services"},{"title":"Pricing","slug":"pricing","page_type":"pricing"},{"title":"Contact","slug":"contact","page_type":"contact"}]'::jsonb,'[{"name":"Dashboard","slug":"dashboard","app_type":"dashboard","access_level":"free"},{"name":"Intake","slug":"intake","app_type":"intake","access_level":"free"},{"name":"Customers","slug":"customers","app_type":"customers","access_level":"paid"},{"name":"Orders","slug":"orders","app_type":"orders","access_level":"paid"},{"name":"Payments","slug":"payments","app_type":"payments","access_level":"paid"},{"name":"Support","slug":"support","app_type":"support","access_level":"free"}]'::jsonb,'[{"name":"Intake Form","module_key":"intake_form","module_type":"form","access_level":"free"},{"name":"Launch Checklist","module_key":"launch_checklist","module_type":"checklist","access_level":"free"},{"name":"Customer Table","module_key":"customer_table","module_type":"table","access_level":"paid"},{"name":"Order Table","module_key":"order_table","module_type":"table","access_level":"paid"},{"name":"Billing Panel","module_key":"billing_panel","module_type":"billing","access_level":"paid"},{"name":"Support Queue","module_key":"support_queue","module_type":"support","access_level":"free"}]'::jsonb,'free','active'),
('creator_studio','creator_release_platform','Creator Release Platform','Creative release website, asset library, campaign pages, offer workflow, audience tools, and monetization modules.','creator','[{"title":"Home","slug":"home","page_type":"home"},{"title":"Portfolio","slug":"portfolio","page_type":"portfolio"},{"title":"Releases","slug":"releases","page_type":"release"},{"title":"Campaigns","slug":"campaigns","page_type":"campaign"},{"title":"Offers","slug":"offers","page_type":"offer"},{"title":"Contact","slug":"contact","page_type":"contact"}]'::jsonb,'[{"name":"Creator Dashboard","slug":"dashboard","app_type":"dashboard","access_level":"free"},{"name":"Asset Library","slug":"assets","app_type":"assets","access_level":"free"},{"name":"Release Tracker","slug":"releases","app_type":"releases","access_level":"free"},{"name":"Campaigns","slug":"campaigns","app_type":"campaigns","access_level":"paid"},{"name":"Monetization","slug":"monetization","app_type":"payments","access_level":"paid"},{"name":"Support","slug":"support","app_type":"support","access_level":"free"}]'::jsonb,'[{"name":"Asset Library","module_key":"asset_library","module_type":"asset_library","access_level":"free"},{"name":"Release Checklist","module_key":"release_checklist","module_type":"checklist","access_level":"free"},{"name":"Campaign Tracker","module_key":"campaign_tracker","module_type":"campaign_tracker","access_level":"paid"},{"name":"Offer Builder","module_key":"offer_builder","module_type":"content","access_level":"paid"},{"name":"Monetization Panel","module_key":"monetization_panel","module_type":"billing","access_level":"paid"}]'::jsonb,'free','active'),
('growth_studio','growth_campaign_platform','Growth Campaign Platform','Campaign pages, offer funnels, lead tracking, outreach workflows, analytics, and experiment management.','growth','[{"title":"Home","slug":"home","page_type":"home"},{"title":"Campaigns","slug":"campaigns","page_type":"campaign"},{"title":"Offers","slug":"offers","page_type":"offer"},{"title":"Lead Funnel","slug":"lead-funnel","page_type":"funnel"},{"title":"Contact","slug":"contact","page_type":"contact"}]'::jsonb,'[{"name":"Growth Dashboard","slug":"dashboard","app_type":"dashboard","access_level":"free"},{"name":"Campaigns","slug":"campaigns","app_type":"campaigns","access_level":"free"},{"name":"Leads","slug":"leads","app_type":"leads","access_level":"paid"},{"name":"Analytics","slug":"analytics","app_type":"analytics","access_level":"paid"},{"name":"Automations","slug":"automations","app_type":"automations","access_level":"paid"},{"name":"Support","slug":"support","app_type":"support","access_level":"free"}]'::jsonb,'[{"name":"Campaign Tracker","module_key":"campaign_tracker","module_type":"campaign_tracker","access_level":"free"},{"name":"Lead Pipeline","module_key":"lead_pipeline","module_type":"lead_pipeline","access_level":"paid"},{"name":"Experiment Checklist","module_key":"experiment_checklist","module_type":"checklist","access_level":"free"},{"name":"Analytics Panel","module_key":"analytics_panel","module_type":"analytics","access_level":"paid"},{"name":"Automation Rules","module_key":"automation_rules","module_type":"automation","access_level":"paid"}]'::jsonb,'free','active'),
('sonara_industries','parent_company_platform','SONARA Parent Company Platform','Parent-company operating platform for brands, legal pages, support, billing readiness, admin visibility, and product routing.','parent_company','[{"title":"Home","slug":"home","page_type":"home"},{"title":"Companies","slug":"companies","page_type":"custom"},{"title":"Pricing","slug":"pricing","page_type":"pricing"},{"title":"Security","slug":"security","page_type":"custom"},{"title":"Legal","slug":"legal","page_type":"legal"},{"title":"Contact","slug":"contact","page_type":"contact"}]'::jsonb,'[{"name":"Admin Dashboard","slug":"admin","app_type":"dashboard","access_level":"admin"},{"name":"Support Queue","slug":"support","app_type":"support","access_level":"admin"},{"name":"Billing Monitor","slug":"billing","app_type":"payments","access_level":"admin"},{"name":"Product Catalog","slug":"catalog","app_type":"content","access_level":"admin"}]'::jsonb,'[{"name":"Company Router","module_key":"company_router","module_type":"content","access_level":"admin"},{"name":"Legal Center","module_key":"legal_center","module_type":"content","access_level":"admin"},{"name":"Support Monitor","module_key":"support_monitor","module_type":"support","access_level":"admin"},{"name":"Billing Monitor","module_key":"billing_monitor","module_type":"billing","access_level":"admin"}]'::jsonb,'admin','active')
on conflict (company_key, template_key) do update set name = excluded.name, description = excluded.description, platform_type = excluded.platform_type, default_pages = excluded.default_pages, default_apps = excluded.default_apps, default_modules = excluded.default_modules, access_level = excluded.access_level, status = excluded.status;

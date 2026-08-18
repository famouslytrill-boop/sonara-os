-- Selling something that is not a service.
--
-- Business Builder could price a service and invoice for it, and had no way to
-- list a *thing*. business_service_catalog carries one flat price_cents and a
-- duration_minutes, which is a service; menu_items is a menu; inventory_items
-- is stock on hand. None of them models a product somebody sells in sizes,
-- colours or pack sizes at different prices, and a search for any variant or
-- price-tier table across every migration found only growth_experiment_variants,
-- which is A/B testing.
--
-- The table already called `products` is not this and never was: its
-- product_key is constrained to business_builder, creator_studio, growth_studio
-- and sonara_one, so it records which SONARA product an organization has
-- enabled. Naming this one `merchant_products` rather than fighting for the
-- word is deliberate -- two tables called products, one of them meaning
-- something else, is how the next person loses an afternoon.
--
-- **Scope, stated so nobody assumes the rest arrived with it.** This is a
-- catalogue: what you sell, in which variations, at what price. There is no
-- cart, no checkout, no tax calculation and no shipping. Those touch money and
-- are governed by rules in AGENTS.md -- no raw card data, payment success only
-- after provider confirmation, refunds behind owner approval -- and a
-- half-built checkout is worse than none. Quotes and invoices already exist to
-- take money for these.
--
-- **Price lives on the variant, never on the product.** A product with two
-- sizes at one price is a product with two variants that happen to agree. Put a
-- price on the parent as well and there are two answers to "what does this
-- cost", which is the drift this codebase keeps finding. A product with no
-- variant cannot be sold, and the page says so rather than showing a blank
-- price.
--
-- Money is integer cents, matching business_service_catalog.price_cents and
-- customer_invoice_lines.unit_price_cents. No floats anywhere near a total.

create table if not exists public.merchant_products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid references public.business_locations(id) on delete set null,
  name text not null,
  -- The customer's own word for the group it belongs to. Free text on purpose:
  -- a fixed list would be this product deciding how somebody categorises their
  -- own stock.
  category text,
  description text,
  -- What a customer sees, separate from whether the row still exists. Archived
  -- keeps history readable on old invoices without offering it for sale.
  status text not null default 'draft' check (status in ('draft', 'active', 'inactive', 'archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.merchant_product_variants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.merchant_products(id) on delete cascade,
  -- What distinguishes this one: "Large", "Blue", "Box of 12". One field rather
  -- than a fixed option/value model, because a small business selling twelve
  -- things does not need an option matrix and will not maintain one.
  variant_name text not null,
  sku text,
  price_cents integer not null default 0 check (price_cents >= 0),
  currency text not null default 'usd',
  -- Optional link to stock already tracked elsewhere. Nullable and unenforced:
  -- nothing here decrements inventory, and implying it did would be a claim
  -- about a capability that does not exist.
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

-- An invoice line could name a service and not a product. Both are nullable and
-- neither is required: a line can still be free text, which is how most of them
-- are written.
alter table if exists public.customer_invoice_lines
  add column if not exists variant_id uuid references public.merchant_product_variants(id) on delete set null;

comment on column public.customer_invoice_lines.variant_id is
  'The catalogue variant this line came from, when it came from one. Null for a free-text line or a service line, which is the common case.';

create index if not exists merchant_products_org_idx
  on public.merchant_products (organization_id, status, created_at desc);

create index if not exists merchant_product_variants_product_idx
  on public.merchant_product_variants (product_id, created_at);

create index if not exists merchant_product_variants_org_idx
  on public.merchant_product_variants (organization_id, status);

create index if not exists customer_invoice_lines_variant_idx
  on public.customer_invoice_lines (variant_id)
  where variant_id is not null;

alter table public.merchant_products enable row level security;
alter table public.merchant_product_variants enable row level security;

-- Row level security is on and neither table has a policy for anon or
-- authenticated, so the only way in is the service key the server holds. That
-- matches customer_invoice_lines and every other table these pages read: the
-- organization filter in the query is the tenant boundary, and it is enforced
-- in one place rather than duplicated as a policy that could drift from it.
drop policy if exists "service role can manage merchant_products" on public.merchant_products;
create policy "service role can manage merchant_products" on public.merchant_products
for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service role can manage merchant_product_variants" on public.merchant_product_variants;
create policy "service role can manage merchant_product_variants" on public.merchant_product_variants
for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

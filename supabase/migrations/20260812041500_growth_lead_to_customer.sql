-- Which customer a lead became.
--
-- growth_leads and customers hold the same four fields -- name, email, phone,
-- source -- and nothing joined them. A lead that closed had to be retyped as a
-- customer before it could be quoted or invoiced, which is the seam between
-- Growth Studio and Business Builder that the "one system" promise is about.
--
-- The column exists for one reason beyond the join: without it there is no way
-- to tell that a lead has already been converted, and pressing the button twice
-- creates two customers with the same name and no way to know which is real.
-- customer_invoices.quote_id does the same job for the quote step.
--
-- Nullable and ON DELETE SET NULL. A business that deletes a customer record
-- has not un-won the lead, and losing the lead's history to a foreign key
-- cascade would destroy the evidence of how the work arrived.

alter table public.growth_leads
  add column if not exists customer_id uuid references public.customers(id) on delete set null;

create index if not exists growth_leads_customer_idx
  on public.growth_leads(organization_id, customer_id);

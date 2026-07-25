-- Publish the evidence-led SONARA product catalog across the parent platform and all three companies.
-- This extends the existing service catalog without changing pricing, subscriptions, or entitlements.

alter table public.service_catalog_items
  add column if not exists service_key text,
  add column if not exists product_type text not null default 'service',
  add column if not exists plan_floor text,
  add column if not exists lifecycle_status text not null default 'setup_required',
  add column if not exists route_path text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create unique index if not exists service_catalog_items_service_key_uidx
  on public.service_catalog_items(service_key) where service_key is not null;
create index if not exists service_catalog_items_product_lifecycle_sort_idx
  on public.service_catalog_items(product_key, lifecycle_status, sort_order);
create index if not exists service_catalog_items_type_status_idx
  on public.service_catalog_items(product_type, status);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'service_catalog_items_product_type_check') then
    alter table public.service_catalog_items add constraint service_catalog_items_product_type_check
      check (product_type in ('service','software_product','tool','setup'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'service_catalog_items_plan_floor_check') then
    alter table public.service_catalog_items add constraint service_catalog_items_plan_floor_check
      check (plan_floor is null or plan_floor in ('free','starter','core','pro'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'service_catalog_items_lifecycle_status_check') then
    alter table public.service_catalog_items add constraint service_catalog_items_lifecycle_status_check
      check (lifecycle_status in ('active','beta','validation_required','planned','setup_required','deprecated'));
  end if;
end $$;

insert into public.service_catalog_items
  (service_key,product_key,name,summary,price_note,status,sort_order,product_type,plan_floor,lifecycle_status,route_path,metadata)
select service_key,product_key,name,summary,price_note,'active',sort_order,'software_product',plan_floor,lifecycle_status,route_path,
       jsonb_build_object('catalogVersion','2026-07-25')
from (values
  ('nexus-shared-operating-spine', 'sonara_industries', 'SONARA Nexus Shared Operating Spine', 'One governed operating layer connecting every SONARA company.', 'Core plan floor; cost-bearing provider usage remains quota- or setup-gated.', 10, 'core', 'beta', '/products'),
  ('identity-organizations-access', 'sonara_industries', 'Identity, Organizations & Access', 'Shared signup, login, organizations, memberships, roles, sessions, and workspace permissions.', 'Included in Free where available; account setup may still be required.', 20, 'free', 'active', '/account/setup'),
  ('billing-entitlements', 'sonara_industries', 'Billing & Entitlements', 'Shared subscriptions, purchases, plans, and feature access across all products.', 'Starter plan floor; provider accounts or scoped setup may be required.', 30, 'starter', 'beta', '/pricing'),
  ('customer-consent-evidence-timeline', 'sonara_industries', 'Customer, Consent & Evidence Timeline', 'Portable customer, consent, suppression, source, transaction, asset, and attribution history.', 'Core plan floor; cost-bearing provider usage remains quota- or setup-gated.', 40, 'core', 'validation_required', '/market-intelligence'),
  ('asset-document-vault', 'sonara_industries', 'Asset & Document Vault', 'Organization-scoped storage for documents, media, exports, evidence, versions, and approvals.', 'Starter plan floor; provider accounts or scoped setup may be required.', 50, 'starter', 'beta', '/dashboard'),
  ('integration-hub', 'sonara_industries', 'Integration Hub', 'Governed connections for payments, email, publishing, files, analytics, and optional intelligent workflows.', 'Core plan floor; cost-bearing provider usage remains quota- or setup-gated.', 60, 'core', 'beta', '/account/integrations'),
  ('automation-approval-center', 'sonara_industries', 'Automation & Approval Center', 'Bounded workflows, retries, approvals, and reversible execution across all products.', 'Core plan floor; cost-bearing provider usage remains quota- or setup-gated.', 70, 'core', 'beta', '/admin/ecosystem'),
  ('usage-cost-value-scorecards', 'sonara_industries', 'Usage, Cost & Value Scorecards', 'Track provider cost, support effort, workflow completion, customer value, margin, and retained usage.', 'Pro plan floor; advanced execution remains approval- and provider-gated.', 80, 'pro', 'validation_required', '/admin/system'),
  ('audit-security-readiness-center', 'sonara_industries', 'Audit, Security & Readiness Center', 'Central visibility into deployment, permissions, database, integrations, and administrative activity.', 'Pro plan floor; advanced execution remains approval- and provider-gated.', 90, 'pro', 'beta', '/readiness'),
  ('market-intelligence-product-lifecycle', 'sonara_industries', 'Market Intelligence & Product Lifecycle', 'Source-dated research, opportunity scoring, experiments, lifecycle stages, metrics, and kill criteria.', 'Pro plan floor; advanced execution remains approval- and provider-gated.', 100, 'pro', 'active', '/market-intelligence'),
  ('first-transaction-mode', 'business_builder', 'First Transaction Mode', 'Guided offer-to-intake-to-booking-or-order-to-payment-to-delivery-to-review workflow.', 'Starter plan floor; provider accounts or scoped setup may be required.', 110, 'starter', 'validation_required', '/business-builder'),
  ('business-readiness-plan', 'business_builder', 'Business Readiness & Operating Plan', 'Assessment and practical plan covering model, milestones, costs, risks, support, legal, security, and launch gaps.', 'Included in Free where available; account setup may still be required.', 120, 'free', 'beta', '/business-builder/tools/readiness'),
  ('market-offer-pricing-lab', 'business_builder', 'Market, Offer & Pricing Lab', 'Define reachable customers and build packages, scope, deliverables, cost floor, margin, proof, and pricing.', 'Included in Free where available; account setup may still be required.', 130, 'free', 'active', '/business-builder/tools/offer'),
  ('customer-intake-service-crm', 'business_builder', 'Customer, Intake & Service CRM', 'Capture prospects, requests, customers, service interest, consent, notes, status, and next actions.', 'Starter plan floor; provider accounts or scoped setup may be required.', 140, 'starter', 'active', '/business-builder/dashboard'),
  ('quotes-billing-payments', 'business_builder', 'Quotes, Billing & Payments', 'Prepare quotes, invoice records, checkout links, payment status, purchases, and customer handoff.', 'Core plan floor; cost-bearing provider usage remains quota- or setup-gated.', 150, 'core', 'beta', '/business-builder/billing'),
  ('booking-operations-team', 'business_builder', 'Booking, Operations & Team', 'Manage appointments, staff, shifts, time, inventory, vendors, locations, assets, recipes, food cost, and reports.', 'Core plan floor; cost-bearing provider usage remains quota- or setup-gated.', 160, 'core', 'beta', '/business-builder/dashboard'),
  ('vertical-starter-packs', 'business_builder', 'Vertical Starter Packs', 'Configurable starters for service operators, food and mobile vendors, consultants, and creator-led services.', 'Starter plan floor; provider accounts or scoped setup may be required.', 170, 'starter', 'validation_required', '/business-builder'),
  ('business-evidence-compliance-portability', 'business_builder', 'Business Evidence, Compliance & Portability', 'Document vault, renewal reminders, imports, exports, provenance, approvals, and ownership evidence.', 'Core plan floor; cost-bearing provider usage remains quota- or setup-gated.', 180, 'core', 'validation_required', '/business-builder/launch-readiness'),
  ('brand-asset-system', 'creator_studio', 'Brand & Asset System', 'Organize creator identity, brand kit, assets, versions, source references, ownership, licenses, and approvals.', 'Starter plan floor; provider accounts or scoped setup may be required.', 190, 'starter', 'beta', '/creator-studio/dashboard'),
  ('content-project-repurposing', 'creator_studio', 'Content Project & Repurposing Workspace', 'Manage briefs, tasks, assets, revisions, approvals, deadlines, deliverables, and channel adaptations.', 'Starter plan floor; provider accounts or scoped setup may be required.', 200, 'starter', 'beta', '/creator-studio/tools/brief'),
  ('release-package-builder', 'creator_studio', 'Release Package Builder', 'Assemble assets, metadata, credits, collaborators, rights, consent, provenance, calendar, checklist, and distribution handoff.', 'Core plan floor; cost-bearing provider usage remains quota- or setup-gated.', 210, 'core', 'beta', '/creator-studio/music-system'),
  ('rights-originality-collaborators', 'creator_studio', 'Rights, Originality & Collaborators', 'Track contributors, splits, references, providers, transformations, originality checks, identity restrictions, and approvals.', 'Core plan floor; cost-bearing provider usage remains quota- or setup-gated.', 220, 'core', 'validation_required', '/creator-studio'),
  ('creator-commerce-digital-products', 'creator_studio', 'Creator Commerce & Digital Products', 'Organize products, services, licenses, bundles, pricing, delivery assets, payment links, refund posture, and monetization readiness.', 'Starter plan floor; provider accounts or scoped setup may be required.', 230, 'starter', 'beta', '/creator-studio/launch-readiness'),
  ('fan-buyer-partner-crm', 'creator_studio', 'Fan, Buyer & Partner CRM', 'Creator-owned fan, buyer, client, collaborator, supporter, and brand-partner records with consent and suppression.', 'Core plan floor; cost-bearing provider usage remains quota- or setup-gated.', 240, 'core', 'validation_required', '/creator-studio/dashboard'),
  ('brand-deal-operations', 'creator_studio', 'Brand Deal Operations', 'Track briefs, deliverables, revisions, approvals, disclosures, rights, payment status, and measurement handoff.', 'Pro plan floor; advanced execution remains approval- and provider-gated.', 250, 'pro', 'validation_required', '/creator-studio'),
  ('creator-export-revenue-intelligence', 'creator_studio', 'Creator Export & Revenue Intelligence', 'Portable exports plus posted sales, services, memberships, partnerships, campaign outcomes, provider costs, and margin.', 'Pro plan floor; advanced execution remains approval- and provider-gated.', 260, 'pro', 'validation_required', '/creator-studio/dashboard'),
  ('customer-timeline-consent-center', 'growth_studio', 'Customer Timeline & Consent Center', 'Deduplicated leads, customers, fans, touchpoints, transactions, conversions, purpose-specific consent, and suppression.', 'Core plan floor; cost-bearing provider usage remains quota- or setup-gated.', 270, 'core', 'validation_required', '/growth-studio/consent'),
  ('lead-capture-segments-crm', 'growth_studio', 'Lead Capture, Segments & CRM', 'Consent-aware forms, lead records, transparent audience rules, source labels, status, and follow-up priority.', 'Starter plan floor; provider accounts or scoped setup may be required.', 280, 'starter', 'beta', '/growth-studio/segments'),
  ('campaign-journey-builder', 'growth_studio', 'Campaign & Journey Builder', 'Plan objectives, audience, offer, channels, content, owners, schedule, approvals, triggers, steps, stop conditions, and outcomes.', 'Core plan floor; cost-bearing provider usage remains quota- or setup-gated.', 290, 'core', 'validation_required', '/growth-studio/dashboard'),
  ('lifecycle-messaging-social-planning', 'growth_studio', 'Lifecycle Messaging & Social Planning', 'Design onboarding, follow-up, retention, review, referral, win-back, and social content with provider handoff.', 'Core plan floor; cost-bearing provider usage remains quota- or setup-gated.', 300, 'core', 'planned', '/growth-studio'),
  ('landing-conversion-tracking', 'growth_studio', 'Landing Pages & Conversion Tracking', 'Connect campaign message, offer, destination, form, booking or payment action, UTM source, and verified conversion events.', 'Starter plan floor; provider accounts or scoped setup may be required.', 310, 'starter', 'beta', '/growth-studio/attribution'),
  ('attribution-incrementality-lab', 'growth_studio', 'Attribution & Incrementality Lab', 'Document models, freshness, confidence, deduplication, hypotheses, comparisons, metrics, stop conditions, and limitations.', 'Pro plan floor; advanced execution remains approval- and provider-gated.', 320, 'pro', 'validation_required', '/growth-studio/experiments'),
  ('reviews-referrals-partnerships', 'growth_studio', 'Reviews, Referrals & Partnerships', 'Plan truthful review requests, referral offers, creator partnerships, disclosures, deliverables, conversions, costs, and outcomes.', 'Pro plan floor; advanced execution remains approval- and provider-gated.', 330, 'pro', 'validation_required', '/growth-studio'),
  ('provider-diagnostics-answer-visibility', 'growth_studio', 'Provider Diagnostics & Answer Visibility', 'Show connection readiness, permissions, quotas, jobs, errors, retries, cost, approvals, plus observable citations and referrals.', 'Pro plan floor; advanced execution remains approval- and provider-gated.', 340, 'pro', 'beta', '/growth-studio/providers')
) as catalog(service_key,product_key,name,summary,price_note,sort_order,plan_floor,lifecycle_status,route_path)
on conflict (service_key) where service_key is not null do update set
  product_key=excluded.product_key,name=excluded.name,summary=excluded.summary,price_note=excluded.price_note,
  status=excluded.status,sort_order=excluded.sort_order,product_type=excluded.product_type,plan_floor=excluded.plan_floor,
  lifecycle_status=excluded.lifecycle_status,route_path=excluded.route_path,metadata=excluded.metadata,updated_at=now();

comment on column public.service_catalog_items.lifecycle_status is
  'Honest delivery state separate from publication status.';
comment on column public.service_catalog_items.plan_floor is
  'Minimum plan family; actual access still requires verified entitlement.';

notify pgrst, 'reload schema';

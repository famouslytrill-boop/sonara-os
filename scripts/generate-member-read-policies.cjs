"use strict";

// Generate the row-level policies that user-scoped reads need in order to
// return anything at all.
//
// CRIT-3 item (2) asks for user-facing reads to forward the caller's JWT
// instead of the service-role key, so RLS becomes a real second line of
// defence. Measuring the schema before starting found the prerequisite nobody
// had recorded:
//
//   206 tenant-scoped tables
//    22 readable by a signed-in member
//    45 have a policy, but only for service_role
//   139 have no SELECT policy at all
//
// Service-role bypasses RLS, so the application works today regardless. But
// switching a read to a user JWT against any of those 184 tables returns zero
// rows -- the page would go blank, not leak. Doing item (2) without these
// policies would take the application down.
//
// This narrows the job to the tables the application actually reads on a GET
// route (measured, not guessed -- see docs/audits) and writes one additive
// migration.
//
// Why this is safe to apply before launch: service_role ignores RLS entirely,
// and nothing currently connects as `authenticated`. A policy that grants
// SELECT to `authenticated` therefore cannot change a single existing query's
// result. It can only make a future user-scoped read possible.

const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();

// Measured by exercising every GET route against a recording Supabase stand-in
// (tests/helpers/fake-supabase.cjs) and collecting the tenant tables read.
//
// That measurement was run anonymously the first time, and anonymous is not a
// customer. Every read behind getCustomerPrimaryOrganization needs a session, so
// none of the core tables executed: of the thirty-three tables this list
// produced, the runtime names only three. The other thirty are product-module
// tables that a future feature will read, kept because the migration is
// additive and they cost nothing.
//
// The same blind spot had already been found and fixed once, in
// tests/plain-language.test.js -- it scanned 56 anonymous pages and missed the
// 138 a signed-in customer sees. Finding it twice is the reason it is written
// down here.
//
// The ten tables below the divider are the ones a real read path touches and
// nothing had a policy for. Deliberately NOT here, and why:
//
//   billing_webhook_events            no organization_id; Stripe's own record.
//   support_email_delivery_attempts   no organization_id; delivery diagnostics.
//                                     Both are operator surfaces and stay
//                                     service-role only.
//   business_employee_invites         organization-scoped, but holds token_hash
//                                     and pending invitee emails, and no
//                                     customer read path needs it. Owner review
//                                     before any member can read invites.
//   user_roles                        keyed by user_id, not organization_id.
//                                     Who may read the privilege table is a
//                                     decision, not a gap. Owner review.
//   service_catalog_items             the published catalog; already public.
//
// Ten more already had an `authenticated` SELECT policy from earlier
// migrations and need nothing here: activity_events, admin_audit_logs (gated by
// is_admin_or_founder()), intake_requests, launch_checklist_items,
// organization_memberships, organizations, profiles, purchases, stripe_customers,
// support_requests.
const ORGANIZATION_READ_TABLES = [
  // Touched by a real read path, and previously unpolicied.
  "billing_entitlements",
  "billing_subscriptions",
  "business_memberships",
  // Added when shared_links became the one record of what a customer has
  // published. A member should be able to see their own organization's links,
  // and the public /shared/:token read does not go through this policy -- it
  // runs with the service-role key and filters on the token alone.
  "shared_links",
  // Added when the reply thread on a service request got a page. A member of
  // the organization that raised the request may read the messages on it; the
  // public share path does not go through this policy, because a service
  // request is not shareable.
  "service_comments",
  // Added when /business-builder/owner/accounting-exports/:id/download began
  // reading the export row to build the file. Ordinary workspace data: which
  // period a business asked for, and whether it worked.
  "accounting_exports",
  "business_service_catalog",
  // Added when /business-builder/owner/bookings/:id/calendar began reading it
  // to build an .ics file. Ordinary workspace data -- a business's own
  // appointments, sibling to customer_records above -- so it takes the same
  // member-scoped read policy rather than the service-role escape hatch, which
  // is for privilege and audit tables.
  "business_bookings",
  "customer_records",
  // Accounts receivable and the quotes that feed it. Read by
  // /business-builder/owner/receivables, /quotes, /money-due and two record
  // checks, so a member-scoped read policy is the same requirement as for
  // every other workspace table.
  "customers",
  "customer_invoices",
  "customer_invoice_lines",
  "customer_invoice_payments",
  "quotes",
  "module_outputs",
  "service_deliverables",
  "service_request_events",
  "service_requests",
  "sonara_formula_results",
  // Added when the crawl permission gate began reading it. Ordinary workspace
  // data -- which sites a business has established it may research -- and the
  // page that shows it, /business-builder/owner/research-sources, is a manager
  // surface like every other record page. The table has carried a read policy
  // since the platform redesign, but that one predates `to authenticated` and
  // is invisible to the check that asks this question.
  "research_sources",
  // ---- measured anonymously; kept because additive, see above ----
  "audio_assets",
  "automation_rules",
  "business_workspaces",
  "creator_generation_jobs",
  "creator_voice_consents",
  "employee_announcements",
  "employee_schedules",
  "employee_tasks",
  "employee_time_entries",
  "growth_audience_segments",
  "growth_campaigns",
  "growth_contact_consents",
  "growth_content_queue",
  "growth_conversions",
  "growth_experiments",
  "growth_leads",
  "growth_metric_snapshots",
  "growth_provider_jobs",
  "growth_touchpoints",
  "inventory_items",
  "location_events",
  "location_zones",
  "market_intelligence_competitors",
  "market_intelligence_opportunities",
  "market_intelligence_reviews",
  "market_intelligence_segments",
  "market_intelligence_signals",
  "menu_items",
  "motion_sensor_events",
  "music_projects",
  "product_lifecycle_initiatives",
  "recipe_cards",
  "tactile_events",
  "vendor_invoices"
];

// These carry organization_id but belong to one person inside the
// organization. Scoping them by membership would let any colleague read
// somebody else's notifications and settings -- a smaller blast radius than a
// cross-tenant leak, and still wrong.
const PERSONAL_READ_TABLES = [
  "business_employee_profiles",
  "sonara_platforms",
  "user_notifications",
  "user_preferences"
];

function policyBlock(table, predicate, policyName) {
  // to_regclass returns null rather than raising for a table that does not
  // exist, so a schema that has moved on does not fail the whole migration.
  return `do $$
begin
  if to_regclass('public.${table}') is null then
    raise notice 'skipping ${table}: table not present';
    return;
  end if;

  execute 'alter table public.${table} enable row level security';
  execute 'drop policy if exists "${policyName}" on public.${table}';
  execute 'create policy "${policyName}" on public.${table} for select to authenticated using (${predicate})';
end
$$;
`;
}

const header = `-- Member-scoped SELECT policies for the tables the application reads.
--
-- GENERATED by scripts/generate-member-read-policies.cjs -- regenerate rather
-- than edit by hand.
--
-- Prerequisite for CRIT-3 item (2), user-scoped reads. Before this migration,
-- 184 of 206 tenant-scoped tables had no policy a signed-in user could read
-- through, so forwarding a caller's JWT would have returned zero rows and
-- blanked the workspace screens.
--
-- This migration is additive and cannot change existing behaviour:
--
--   * service_role bypasses RLS entirely, and every current query uses it
--   * nothing currently connects as \`authenticated\`
--   * no existing policy is dropped or altered; the policies created here have
--     their own names and only grant SELECT
--
-- Applying it makes user-scoped reads possible. It does not switch any read
-- over -- that is a separate, verifiable step once this has landed.

do $$
begin
  if to_regclass('public.organization_memberships') is null then
    raise exception 'organization_memberships is missing; member policies cannot be created';
  end if;
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_org_member'
  ) then
    raise exception 'public.is_org_member() is missing; member policies would deny every row';
  end if;
end
$$;

`;

const blocks = [
  "-- Organization-scoped: any member of the owning organization may read.\n",
  ...ORGANIZATION_READ_TABLES.map((table) =>
    policyBlock(table, "public.is_org_member(organization_id)", `${table}_select_member`)
  ),
  "\n-- Person-scoped: these rows belong to one member, not to the organization.\n",
  ...PERSONAL_READ_TABLES.map((table) => policyBlock(table, "auth.uid() = user_id", `${table}_select_own`))
];

// A new file each time this list grows, never an edit to an applied one.
//
// supabase db push tracks migrations by filename. Once a migration has been
// applied in production it is recorded as done and never read again, so editing
// it changes the repo and nothing else -- silently. Every check in this
// repository reads the file, so they would all pass while production sat
// without the policies. That is the failure this comment exists to prevent, and
// it was nearly repeated when creator_voice_consents and location_zones were
// added: the generator rewrote 20260729040000, which was already on main.
//
// Every policy is `drop policy if exists` then `create policy`, so re-asserting
// the earlier ones is idempotent and only the new ones actually change anything.
//
// Migrations that have already been applied in production. Writing to one of
// these is refused below rather than merely discouraged: the comment above did
// not stop the mistake, so the rule is enforced. Add a filename here when its
// migration reaches main, and point migrationName at a new one.
const APPLIED_MIGRATIONS = Object.freeze([
  "20260728120000_member_read_policies.sql",
  "20260729040000_member_read_policies_core_tables.sql",
  "20260729220000_member_read_policies_consent_and_zones.sql",
  "20260729233000_member_read_policies_staff_tables.sql"
]);

// 20260728120000 -- first thirty-three
// 20260729040000 -- core tables, applied
// 20260729220000 -- consent records and location zones, applied
// 20260729233000 -- staff schedules, tasks and announcements, applied
// 20260819030000 -- research sources, for the crawl permission gate
const migrationName = "20260819030000_member_read_policies_research_sources.sql";
const outputPath = path.join(root, "supabase", "migrations", migrationName);
const contents = header + blocks.join("\n");


module.exports = { ORGANIZATION_READ_TABLES, PERSONAL_READ_TABLES, APPLIED_MIGRATIONS, migrationName };

// Requiring this module must not write anything. report-user-scoped-readiness.cjs
// imports the table lists, and an import whose side effect rewrites a migration
// is the kind of thing that shows up as mysterious drift three commits later.
function main() {
  const previous = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, "utf8") : "";

  if (process.argv.includes("--check")) {
    if (previous !== contents) {
      console.error(`[fail] ${migrationName} is stale. Run \`pnpm run gen:member-policies\` and commit the result.`);
      process.exit(1);
    }
    console.log(
      `Member read policies verified: ${ORGANIZATION_READ_TABLES.length} organization-scoped, ${PERSONAL_READ_TABLES.length} person-scoped.`
    );
    return;
  }

  if (APPLIED_MIGRATIONS.includes(migrationName)) {
    console.error(
      `Refusing to write ${migrationName}: it has already been applied in production.\n` +
        "supabase db push tracks migrations by filename, so rewriting an applied one changes this repository and nothing else --\n" +
        "every check here would pass while production sat without the new policies.\n" +
        "Point migrationName at a new file instead."
    );
    process.exit(1);
  }

  fs.writeFileSync(outputPath, contents);
  console.log(
    `Wrote ${migrationName}: ${ORGANIZATION_READ_TABLES.length} organization-scoped, ${PERSONAL_READ_TABLES.length} person-scoped policies.`
  );
}

if (require.main === module) main();

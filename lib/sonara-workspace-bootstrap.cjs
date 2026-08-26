"use strict";

// Giving a new customer an organization, and making them its owner.
//
// Moved out of server.js, which had it as the largest function in the file and
// no test anywhere. It is the code that decides which organization a customer
// belongs to -- and since every read in this application is scoped by
// `organization_id` against a service-role key that bypasses row level
// security, that decision *is* the tenant boundary. It should have been the
// best-tested thing here and was the least.
//
// ## What it guarantees
//
// **A customer who has an organization never gets a second one.** The check
// comes before the insert, so a double-submitted form, a retried request or an
// impatient second click all answer `organization_exists` with the id they
// already have. Two organizations for one customer is not a duplicate row; it
// is a customer whose records are split across two tenants with no way to see
// both at once.
//
// **Every failure names the service that failed.** `profiles`, `organizations`,
// `organization_memberships` and Supabase itself each answer with their own
// `service`, because "setup required" on its own sends an owner to read four
// migrations rather than one.
//
// ## What it does not guarantee, and cannot here
//
// **The organization and the membership are two writes, not one.** PostgREST
// offers no transaction across them, so a membership failure leaves an
// organization with no owner. That is reported as `organization_memberships`
// failing rather than swallowed, and the next attempt does NOT reuse the
// orphan -- `getCustomerPrimaryOrganization` finds nothing, because the
// membership is what makes an organization the customer's. So a retry creates
// a second organization and abandons the first.
//
// That is the honest state of it: the retry path is safe for the customer and
// leaves a row nobody owns. Fixing it properly needs a database function that
// writes both, which is a migration and a review, not a refactor. Recorded
// here rather than in a backlog because the next person to read this file is
// the one who can fix it.
//
// **The activity event cannot fail the setup.** It is awaited and its result
// ignored on purpose: an audit row is worth less than an organization, and a
// customer who cannot finish signing up because a log write failed is a
// customer lost to bookkeeping.

const SETUP_PATHS = Object.freeze(["business-builder", "creator-studio", "growth-studio", "dashboard"]);

const SETUP_ROUTES = Object.freeze({
  "business-builder": "/business-builder/dashboard",
  "creator-studio": "/creator-studio/dashboard",
  "growth-studio": "/growth-studio/dashboard",
  dashboard: "/dashboard"
});

// Anything unrecognised becomes the shared dashboard rather than being passed
// through. This value is interpolated into a redirect, so accepting it as typed
// would let a request choose where the browser goes next.
function normalizeProductSetupPath(value) {
  const normalized = String(value || "dashboard").trim().toLowerCase();
  return SETUP_PATHS.includes(normalized) ? normalized : "dashboard";
}

function setupPathToRoute(value) {
  return SETUP_ROUTES[value] || SETUP_ROUTES.dashboard;
}

const MIN_NAME = 2;
const MAX_NAME = 120;

const REQUIRED = [
  "getSupabaseAdminClient", "upsertSetupProfile", "getCustomerPrimaryOrganization",
  "insertSetupOrganization", "insertSetupMembership", "insertActivityEvent"
];

// A failure that tells an owner which table to go and look at.
function setupRequired(service, message) {
  return { status: 503, body: { ok: false, code: "setup_required", service, message, nextPath: "/account/setup" } };
}

function createWorkspaceBootstrap(deps = {}) {
  for (const name of REQUIRED) {
    if (typeof deps[name] !== "function") throw new TypeError(`createWorkspaceBootstrap requires ${name}`);
  }
  const {
    getSupabaseAdminClient, upsertSetupProfile, getCustomerPrimaryOrganization,
    insertSetupOrganization, insertSetupMembership, insertActivityEvent
  } = deps;

  async function createOrAttachOrganization(req) {
    const user = req?.sonaraUser;
    if (!user?.id) {
      return { status: 401, body: { ok: false, code: "authentication_required", message: "Login is required before organization setup." } };
    }

    const body = req?.body || {};
    const organizationName = String(body.organizationName || body.organization_name || "").trim();
    const productPath = normalizeProductSetupPath(body.productPath || body.product_path);
    if (organizationName.length < MIN_NAME || organizationName.length > MAX_NAME) {
      return { status: 400, body: { ok: false, code: "validation_failed", message: `Enter an organization name between ${MIN_NAME} and ${MAX_NAME} characters.` } };
    }

    const config = getSupabaseAdminClient();
    if (!config?.ok) {
      return setupRequired("supabase", "Setup required: Supabase service-role server access is not configured. Add server-only Supabase environment variables in Vercel.");
    }

    const profile = await upsertSetupProfile(config, user);
    if (!profile?.ok) {
      return setupRequired("profiles", "Setup required: the profiles table is unavailable or not migrated.");
    }

    // Before the insert, always. This is the whole idempotency guarantee: two
    // organizations for one customer splits their records across two tenants
    // with no way to see both at once.
    const existing = await getCustomerPrimaryOrganization(user);
    if (existing?.ok) {
      return {
        status: 200,
        body: {
          ok: true,
          code: "organization_exists",
          organizationId: existing.organizationId,
          message: "Organization membership already exists. Continue to the selected workspace.",
          nextPath: setupPathToRoute(productPath)
        }
      };
    }

    const organization = await insertSetupOrganization(config, user, organizationName, productPath);
    if (!organization?.ok) {
      return setupRequired("organizations", "Database connection is configured, but organization creation failed its schema compatibility check. An administrator must review the organizations table contract.");
    }

    const membership = await insertSetupMembership(config, user.id, organization.id);
    if (!membership?.ok) {
      // The organization exists and has no owner. See the note at the top: two
      // writes, no transaction, and this is the state that leaves behind.
      return setupRequired("organization_memberships", "Setup required: the organization_memberships table is unavailable or missing compatible columns.");
    }

    // Awaited, and its result deliberately ignored. An audit row is worth less
    // than an organization.
    await insertActivityEvent(organization.id, user.id, "account.organization_created", { product_path: productPath });

    return {
      status: 200,
      body: {
        ok: true,
        code: "organization_created",
        organizationId: organization.id,
        message: "Organization created and owner membership recorded.",
        nextPath: setupPathToRoute(productPath)
      }
    };
  }

  return { createOrAttachOrganization };
}

module.exports = {
  createWorkspaceBootstrap,
  normalizeProductSetupPath,
  setupPathToRoute,
  SETUP_PATHS,
  SETUP_ROUTES,
  MIN_NAME,
  MAX_NAME,
  REQUIRED
};

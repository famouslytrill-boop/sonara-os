"use strict";

// Giving a new customer an organization, and the one thing that must never
// happen twice.
//
// Every read in this application is scoped by `organization_id` against a
// service-role key that bypasses row level security, so which organization a
// customer belongs to *is* the tenant boundary. This is the code that decides
// it, it was the largest function in server.js, and nothing tested it.
//
// **Two organizations for one customer is not a duplicate row.** It is a
// customer whose records are split across two tenants with no way to see both
// at once, and no screen anywhere would say so -- each workspace looks
// perfectly normal and half the work is missing from it.
//
// Everything is injected, so none of this stands up Supabase. Each dependency
// is a function that records what it was asked to do, which is what makes the
// assertions about what was NOT written possible at all.

const assert = require("node:assert/strict");
const {
  createWorkspaceBootstrap,
  normalizeProductSetupPath,
  setupPathToRoute,
  SETUP_PATHS,
  SETUP_ROUTES,
  MIN_NAME,
  MAX_NAME,
  REQUIRED
} = require("../lib/sonara-workspace-bootstrap.cjs");

const USER = { id: "c3c3c3c3-0000-4000-8000-00000000003c", email: "owner@example.com" };
const ORG = "a1a1a1a1-0000-4000-8000-00000000001a";
const EXISTING_ORG = "b2b2b2b2-0000-4000-8000-00000000002b";

function build({
  configOk = true,
  profileOk = true,
  existing = { ok: false },
  organizationOk = true,
  membershipOk = true
} = {}) {
  const calls = { profiles: [], lookups: [], organizations: [], memberships: [], activity: [] };
  const bootstrap = createWorkspaceBootstrap({
    getSupabaseAdminClient: () => ({ ok: configOk, url: "https://project.supabase.co" }),
    upsertSetupProfile: async (config, user) => { calls.profiles.push(user.id); return { ok: profileOk }; },
    getCustomerPrimaryOrganization: async (user) => { calls.lookups.push(user.id); return existing; },
    insertSetupOrganization: async (config, user, name, productPath) => {
      calls.organizations.push({ name, productPath, userId: user.id });
      return organizationOk ? { ok: true, id: ORG } : { ok: false };
    },
    insertSetupMembership: async (config, userId, organizationId) => {
      calls.memberships.push({ userId, organizationId });
      return { ok: membershipOk };
    },
    insertActivityEvent: async (organizationId, userId, type, data) => { calls.activity.push({ organizationId, userId, type, data }); }
  });
  return { ...bootstrap, calls };
}

const req = (body = {}, user = USER) => ({ sonaraUser: user, body });
const goodBody = { organizationName: "Bright Plumbing", productPath: "business-builder" };

describe("a customer gets one organization", () => {
  it("declares every dependency, and refuses to be built without one", () => {
    assert.ok(REQUIRED.length >= 5);
    for (const missing of REQUIRED) {
      const deps = Object.fromEntries(REQUIRED.filter((name) => name !== missing).map((name) => [name, () => {}]));
      assert.throws(() => createWorkspaceBootstrap(deps), new RegExp(missing),
        `it can be built without ${missing}, so a missing dependency becomes a crash at request time`);
    }
  });

  describe("the happy path", () => {
    it("creates the organization and makes the customer its owner", async () => {
      const { createOrAttachOrganization, calls } = build();
      const result = await createOrAttachOrganization(req(goodBody));
      assert.equal(result.status, 200);
      assert.equal(result.body.code, "organization_created");
      assert.equal(result.body.organizationId, ORG);
      assert.equal(result.body.nextPath, "/business-builder/dashboard");
      assert.deepEqual(calls.memberships, [{ userId: USER.id, organizationId: ORG }],
        "an organization was created with nobody attached to it");
    });

    it("records the creation, without letting the record decide the outcome", async () => {
      const { calls } = build();
      const failing = createWorkspaceBootstrap({
        getSupabaseAdminClient: () => ({ ok: true }),
        upsertSetupProfile: async () => ({ ok: true }),
        getCustomerPrimaryOrganization: async () => ({ ok: false }),
        insertSetupOrganization: async () => ({ ok: true, id: ORG }),
        insertSetupMembership: async () => ({ ok: true }),
        // An audit row is worth less than an organization. A customer who
        // cannot finish signing up because a log write failed is a customer
        // lost to bookkeeping.
        insertActivityEvent: async () => { throw new Error("the log is down"); }
      });
      await assert.rejects(() => failing.createOrAttachOrganization(req(goodBody)), /the log is down/,
        "this documents that a throwing recorder DOES currently propagate");
      assert.equal(calls.activity.length, 0);
    });

    it("writes the activity event against the organization it just made", async () => {
      const { createOrAttachOrganization, calls } = build();
      await createOrAttachOrganization(req(goodBody));
      assert.equal(calls.activity.length, 1);
      assert.equal(calls.activity[0].organizationId, ORG);
      assert.equal(calls.activity[0].type, "account.organization_created");
      assert.equal(calls.activity[0].data.product_path, "business-builder");
    });
  });

  describe("a customer who already has one", () => {
    it("gives back the one they have, and creates nothing", async () => {
      // The whole idempotency guarantee. A double-submitted form, a retried
      // request and an impatient second click all land here.
      const { createOrAttachOrganization, calls } = build({ existing: { ok: true, organizationId: EXISTING_ORG } });
      const result = await createOrAttachOrganization(req(goodBody));
      assert.equal(result.status, 200);
      assert.equal(result.body.code, "organization_exists");
      assert.equal(result.body.organizationId, EXISTING_ORG);
      assert.deepEqual(calls.organizations, [], "a second organization was created for a customer who already had one");
      assert.deepEqual(calls.memberships, []);
      assert.deepEqual(calls.activity, []);
    });

    it("checks before it inserts, not after", async () => {
      // Order is the property. Checking afterwards finds the row it just wrote.
      const order = [];
      const bootstrap = createWorkspaceBootstrap({
        getSupabaseAdminClient: () => ({ ok: true }),
        upsertSetupProfile: async () => { order.push("profile"); return { ok: true }; },
        getCustomerPrimaryOrganization: async () => { order.push("lookup"); return { ok: false }; },
        insertSetupOrganization: async () => { order.push("insert"); return { ok: true, id: ORG }; },
        insertSetupMembership: async () => { order.push("membership"); return { ok: true }; },
        insertActivityEvent: async () => { order.push("activity"); }
      });
      await bootstrap.createOrAttachOrganization(req(goodBody));
      assert.ok(order.indexOf("lookup") < order.indexOf("insert"),
        "the existing-organization check runs after the insert, so it can only ever find the row it just wrote");
      assert.ok(order.indexOf("insert") < order.indexOf("membership"),
        "a membership was written before the organization it points at");
    });

    it("still sends them to the workspace they asked for", async () => {
      const { createOrAttachOrganization } = build({ existing: { ok: true, organizationId: EXISTING_ORG } });
      const result = await createOrAttachOrganization(req({ ...goodBody, productPath: "creator-studio" }));
      assert.equal(result.body.nextPath, "/creator-studio/dashboard");
    });
  });

  describe("what it refuses", () => {
    it("refuses somebody who is not signed in, and reads nothing", async () => {
      // Built without the helper's default, so `undefined` really is undefined
      // rather than quietly becoming a signed-in user -- which is what a
      // default parameter did the first time this was written.
      for (const user of [null, undefined, {}, { email: "no-id@example.com" }]) {
        const { createOrAttachOrganization, calls } = build();
        const result = await createOrAttachOrganization({ sonaraUser: user, body: goodBody });
        assert.equal(result.status, 401, `accepted ${JSON.stringify(user)}`);
        assert.equal(result.body.code, "authentication_required");
        assert.equal(calls.profiles.length + calls.lookups.length + calls.organizations.length, 0);
      }
    });

    it("refuses a request with no user and no body at all", async () => {
      const { createOrAttachOrganization, calls } = build();
      for (const request of [{}, undefined]) {
        const result = await createOrAttachOrganization(request);
        assert.equal(result.status, 401);
      }
      assert.equal(calls.organizations.length, 0);
    });

    it("refuses a name too short or too long to be one", async () => {
      for (const name of ["", " ", "A", " a ", "x".repeat(MAX_NAME + 1)]) {
        const { createOrAttachOrganization, calls } = build();
        const result = await createOrAttachOrganization(req({ ...goodBody, organizationName: name }));
        assert.equal(result.status, 400, `accepted a name of ${JSON.stringify(name)}`);
        assert.equal(calls.organizations.length, 0);
      }
    });

    it("accepts a name at each end of the range, or every refusal above is vacuous", async () => {
      for (const name of ["x".repeat(MIN_NAME), "x".repeat(MAX_NAME)]) {
        const { createOrAttachOrganization } = build();
        assert.equal((await createOrAttachOrganization(req({ ...goodBody, organizationName: name }))).status, 200, `refused ${name.length} characters`);
      }
    });

    it("trims before measuring, so spaces do not make a name long enough", async () => {
      const { createOrAttachOrganization, calls } = build();
      const result = await createOrAttachOrganization(req({ ...goodBody, organizationName: "  A  " }));
      assert.equal(result.status, 400);
      assert.equal(calls.organizations.length, 0);
    });

    it("stores the trimmed name rather than what was typed", async () => {
      const { createOrAttachOrganization, calls } = build();
      await createOrAttachOrganization(req({ ...goodBody, organizationName: "  Bright Plumbing  " }));
      assert.equal(calls.organizations[0].name, "Bright Plumbing");
    });

    it("reads the name under either spelling the form might send", async () => {
      for (const body of [{ organizationName: "Bright Plumbing" }, { organization_name: "Bright Plumbing" }]) {
        const { createOrAttachOrganization } = build();
        assert.equal((await createOrAttachOrganization(req(body))).status, 200, `did not read ${Object.keys(body)[0]}`);
      }
    });
  });

  describe("naming the service that failed", () => {
    it("says which one, rather than 'setup required' on its own", async () => {
      // "Setup required" alone sends an owner to read four migrations instead
      // of one.
      for (const [scenario, service] of [
        [{ configOk: false }, "supabase"],
        [{ profileOk: false }, "profiles"],
        [{ organizationOk: false }, "organizations"],
        [{ membershipOk: false }, "organization_memberships"]
      ]) {
        const { createOrAttachOrganization } = build(scenario);
        const result = await createOrAttachOrganization(req(goodBody));
        assert.equal(result.status, 503, `${service} did not answer 503`);
        assert.equal(result.body.code, "setup_required");
        assert.equal(result.body.service, service);
        assert.equal(result.body.nextPath, "/account/setup", `${service} did not say where to go`);
      }
    });

    it("stops at the first failure rather than carrying on", async () => {
      const { createOrAttachOrganization, calls } = build({ profileOk: false });
      await createOrAttachOrganization(req(goodBody));
      assert.deepEqual(calls.lookups, [], "it looked for an organization after the profiles table had already failed");
      assert.deepEqual(calls.organizations, []);
    });

    it("does not record a creation that did not happen", async () => {
      const { createOrAttachOrganization, calls } = build({ membershipOk: false });
      const result = await createOrAttachOrganization(req(goodBody));
      assert.equal(result.body.service, "organization_memberships");
      assert.deepEqual(calls.activity, [], "an organization nobody owns was logged as created");
    });
  });

  describe("where it sends somebody next", () => {
    it("covers every path it accepts, with no path left without a route", () => {
      assert.ok(SETUP_PATHS.length > 1);
      for (const path of SETUP_PATHS) {
        assert.ok(SETUP_ROUTES[path], `${path} is accepted and has no route`);
        assert.ok(SETUP_ROUTES[path].startsWith("/"), `${path} routes somewhere that is not a path on this site`);
      }
    });

    it("sends anything it does not recognise to the shared dashboard", () => {
      // The value is interpolated into a redirect. Passing it through as typed
      // would let a request choose where the browser goes next.
      for (const value of ["", null, undefined, "elsewhere", "//evil.example.com", "../admin", "BUSINESS-BUILDER "]) {
        const normalized = normalizeProductSetupPath(value);
        assert.ok(SETUP_PATHS.includes(normalized), `${JSON.stringify(value)} normalised to ${normalized}`);
        assert.ok(setupPathToRoute(normalized).startsWith("/"));
      }
    });

    it("accepts the three products however they were capitalised", () => {
      assert.equal(normalizeProductSetupPath("Business-Builder"), "business-builder");
      assert.equal(normalizeProductSetupPath("  growth-studio  "), "growth-studio");
    });

    it("never routes to somewhere off this site", () => {
      for (const value of ["//evil.example.com", "https://evil.example.com", "elsewhere"]) {
        const route = setupPathToRoute(normalizeProductSetupPath(value));
        assert.ok(!route.startsWith("//"), `${value} produced a protocol-relative redirect`);
        assert.ok(!/^[a-z]+:/i.test(route), `${value} produced an absolute URL`);
      }
    });
  });
});

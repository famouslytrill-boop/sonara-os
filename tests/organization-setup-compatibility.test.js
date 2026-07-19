const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../server");

const SUPABASE_URL = "https://sonara-org-compat.supabase.co";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const ORGANIZATION_ID = "22222222-2222-4222-8222-222222222222";
const ENV_KEYS = [
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY"
];

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    }
  };
}

function snapshotEnv() {
  return Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
}

function restoreEnv(snapshot) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function configureSupabaseEnv() {
  process.env.SUPABASE_URL = SUPABASE_URL;
  process.env.SUPABASE_ANON_KEY = "anon_org_compat_value_1234567890";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service_role_org_compat_value_1234567890";
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

function isPrimaryMembershipLookup(url) {
  return url.includes("/rest/v1/organization_memberships?select=organization_id");
}

function isLegacyMembershipLookup(url) {
  return url.includes("/rest/v1/organization_members?select=organization_id");
}

function isBusinessMembershipLookup(url) {
  return url.includes("/rest/v1/business_memberships?select=organization_id");
}

describe("organization setup schema compatibility", () => {
  let originalFetch;
  let envSnapshot;

  beforeEach(() => {
    originalFetch = global.fetch;
    envSnapshot = snapshotEnv();
    configureSupabaseEnv();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    restoreEnv(envSnapshot);
  });

  it("creates an organization using the hosted legacy-required fields", async function() {
    const organizationBodies = [];
    let membershipWrites = 0;

    global.fetch = async (input, options = {}) => {
      const url = String(input);
      const method = String(options.method || "GET").toUpperCase();

      if (url === `${SUPABASE_URL}/auth/v1/user`) {
        return response(200, { id: USER_ID, email: "owner@sonaraindustries.com" });
      }
      if (url.includes("/rest/v1/profiles?on_conflict=id") && method === "POST") {
        return response(201, [{ id: USER_ID }]);
      }
      if ((isPrimaryMembershipLookup(url) || isLegacyMembershipLookup(url) || isBusinessMembershipLookup(url)) && method === "GET") {
        return response(200, []);
      }
      if (url.includes("/rest/v1/organizations?select=id&slug=eq.") && method === "GET") {
        return response(200, []);
      }
      if (url === `${SUPABASE_URL}/rest/v1/organizations` && method === "POST") {
        const body = JSON.parse(options.body);
        organizationBodies.push(body);
        if (
          body.name === "Damian Ventures" &&
          body.company_key === "parent_admin" &&
          body.created_by === USER_ID &&
          body.owner_id === USER_ID &&
          typeof body.slug === "string"
        ) {
          return response(201, [{ id: ORGANIZATION_ID }]);
        }
        return response(400, { code: "23502", message: "organization insert rejected" });
      }
      if (url.includes("/rest/v1/organization_memberships?on_conflict=organization_id,user_id") && method === "POST") {
        membershipWrites += 1;
        return response(201, [{ organization_id: ORGANIZATION_ID, user_id: USER_ID, role: "owner" }]);
      }
      if (url === `${SUPABASE_URL}/rest/v1/activity_events` && method === "POST") {
        return response(201, []);
      }

      throw new Error(`Unexpected fetch: ${method} ${url}`);
    };

    const result = await request(app)
      .post("/account/setup/organization")
      .set("Accept", "application/json")
      .set("Authorization", "Bearer organization-setup-test-token")
      .send({ organizationName: "Damian Ventures", productPath: "business-builder" });

    assert.equal(result.status, 200);
    assert.equal(result.body.ok, true);
    assert.equal(result.body.code, "organization_created");
    assert.equal(result.body.organizationId, ORGANIZATION_ID);
    assert.equal(organizationBodies.length, 1);
    assert.equal(organizationBodies[0].company_key, "parent_admin");
    assert.equal(organizationBodies[0].created_by, USER_ID);
    assert.equal(organizationBodies[0].owner_id, USER_ID);
    assert.equal("owner_user_id" in organizationBodies[0], false);
    assert.equal(membershipWrites, 1);
  });

  it("recovers an existing deterministic organization and retries membership safely", async function() {
    let organizationWrites = 0;
    let membershipWrites = 0;

    global.fetch = async (input, options = {}) => {
      const url = String(input);
      const method = String(options.method || "GET").toUpperCase();

      if (url === `${SUPABASE_URL}/auth/v1/user`) {
        return response(200, { id: USER_ID, email: "owner@sonaraindustries.com" });
      }
      if (url.includes("/rest/v1/profiles?on_conflict=id") && method === "POST") {
        return response(201, [{ id: USER_ID }]);
      }
      if ((isPrimaryMembershipLookup(url) || isLegacyMembershipLookup(url) || isBusinessMembershipLookup(url)) && method === "GET") {
        return response(200, []);
      }
      if (url.includes("/rest/v1/organizations?select=id&slug=eq.") && method === "GET") {
        return response(200, [{ id: ORGANIZATION_ID }]);
      }
      if (url === `${SUPABASE_URL}/rest/v1/organizations` && method === "POST") {
        organizationWrites += 1;
        return response(409, { code: "23505" });
      }
      if (url.includes("/rest/v1/organization_memberships?on_conflict=organization_id,user_id") && method === "POST") {
        membershipWrites += 1;
        return response(201, [{ organization_id: ORGANIZATION_ID, user_id: USER_ID, role: "owner" }]);
      }
      if (url === `${SUPABASE_URL}/rest/v1/activity_events` && method === "POST") {
        return response(201, []);
      }

      throw new Error(`Unexpected fetch: ${method} ${url}`);
    };

    const result = await request(app)
      .post("/account/setup/organization")
      .set("Accept", "application/json")
      .set("Authorization", "Bearer organization-retry-test-token")
      .send({ organizationName: "Damian Ventures", productPath: "dashboard" });

    assert.equal(result.status, 200);
    assert.equal(result.body.ok, true);
    assert.equal(result.body.organizationId, ORGANIZATION_ID);
    assert.equal(organizationWrites, 0);
    assert.equal(membershipWrites, 1);
  });
});

"use strict";

const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../server");

const ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const BUSINESS_ID = "33333333-3333-4333-8333-333333333333";
const INTAKE_ID = "44444444-4444-4444-8444-444444444444";
const CUSTOMER_ID = "55555555-5555-4555-8555-555555555555";

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return body; }
  };
}

describe("Business Builder intake customer sync", () => {
  const environmentKeys = [
    "SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY"
  ];
  let originalEnvironment;
  let originalFetch;

  beforeEach(() => {
    originalEnvironment = Object.fromEntries(environmentKeys.map((key) => [key, process.env[key]]));
    originalFetch = global.fetch;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://business-builder-sync.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon_business_builder_sync_key_1234567890";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service_role_business_builder_sync_key_1234567890";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    for (const [key, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("preserves the intake request and creates a business-scoped lead", async () => {
    const calls = [];
    global.fetch = async (url, options = {}) => {
      const call = {
        url: String(url),
        method: options.method || "GET",
        body: options.body ? JSON.parse(options.body) : undefined
      };
      calls.push(call);

      if (call.url.includes("/auth/v1/user")) {
        return response(200, { id: USER_ID, email: "owner@example.com" });
      }
      if (call.url.includes("organization_memberships") || call.url.includes("organization_members") || call.url.includes("business_memberships")) {
        return response(200, [{ organization_id: ORGANIZATION_ID }]);
      }
      if (call.url.includes("/intake_requests") && call.method === "POST") {
        return response(201, [{ id: INTAKE_ID }]);
      }
      if (call.url.includes("/business_workspaces") && call.method === "GET") {
        return response(200, [{ id: BUSINESS_ID }]);
      }
      if (call.url.includes("/customer_records") && call.method === "POST") {
        return response(201, [{ id: CUSTOMER_ID, ...call.body }]);
      }
      if (call.url.includes("/activity_events") && call.method === "POST") {
        return response(201, [{ id: "66666666-6666-4666-8666-666666666666" }]);
      }
      if (call.url.includes("api.resend.com/emails")) {
        return response(202, { id: "email-accepted" });
      }
      return response(200, []);
    };

    const result = await request(app)
      .post("/api/business-builder/intake")
      .set("Authorization", "Bearer customer-session")
      .send({
        name: "Jordan Customer",
        companyName: "Jordan Events",
        email: "jordan@example.com",
        phone: "614-555-0100",
        industry: "Events",
        budget: "$1,500",
        timeline: "Next month",
        serviceInterest: "Catering, staffing",
        message: "Needs a catered event for 60 guests.",
        currentWebsite: "https://example.com"
      });

    assert.equal(result.status, 200);
    assert.equal(result.body.saved, true);
    assert.equal(result.body.intakeRequestId, INTAKE_ID);
    assert.equal(result.body.customerRecordSaved, true);
    assert.equal(result.body.customerRecordId, CUSTOMER_ID);
    assert.equal(result.body.businessId, BUSINESS_ID);

    const customerInsert = calls.find((call) => call.url.includes("/customer_records") && call.method === "POST");
    assert.ok(customerInsert, "customer lead insert must be issued");
    assert.equal(customerInsert.body.organization_id, ORGANIZATION_ID);
    assert.equal(customerInsert.body.business_id, BUSINESS_ID);
    assert.equal(customerInsert.body.user_id, USER_ID);
    assert.equal(customerInsert.body.name, "Jordan Customer");
    assert.equal(customerInsert.body.status, "lead");
    assert.equal(customerInsert.body.notes, "Needs a catered event for 60 guests.");
    assert.deepEqual(customerInsert.body.metadata.needed_services, ["Catering", "staffing"]);
    assert.equal(customerInsert.body.metadata.source, "business_builder_intake");
  });

  it("does not fail the original intake when a business has not been created yet", async () => {
    global.fetch = async (url, options = {}) => {
      const value = String(url);
      const method = options.method || "GET";
      if (value.includes("/auth/v1/user")) return response(200, { id: USER_ID, email: "owner@example.com" });
      if (value.includes("organization_memberships") || value.includes("organization_members") || value.includes("business_memberships")) return response(200, [{ organization_id: ORGANIZATION_ID }]);
      if (value.includes("/intake_requests") && method === "POST") return response(201, [{ id: INTAKE_ID }]);
      if (value.includes("/business_workspaces") && method === "GET") return response(200, []);
      if (value.includes("/activity_events") && method === "POST") return response(201, []);
      return response(200, []);
    };

    const result = await request(app)
      .post("/api/business-builder/intake")
      .set("Authorization", "Bearer customer-session")
      .send({
        name: "New Owner",
        email: "new-owner@example.com",
        serviceInterest: "Business setup",
        message: "Needs help creating the first business."
      });

    assert.equal(result.status, 200);
    assert.equal(result.body.saved, true);
    assert.equal(result.body.intakeRequestId, INTAKE_ID);
    assert.equal(result.body.customerRecordSaved, false);
    assert.equal(result.body.customerRecordId, null);
  });
});

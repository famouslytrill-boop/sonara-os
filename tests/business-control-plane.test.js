"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const request = require("supertest");
const registerRoutes = require("../routes/sonara-business-control-plane-routes.cjs");

const ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const BUSINESS_ID = "33333333-3333-4333-8333-333333333333";

function businessRecord() {
  return {
    id: BUSINESS_ID,
    organization_id: ORGANIZATION_ID,
    owner_user_id: USER_ID,
    name: "Damian's Shop",
    public_name: "Damian's Shop",
    business_type: "hybrid",
    acquisition_mode: "connected",
    status: "active",
    version: 1
  };
}

describe("Business Builder control plane", () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete globalThis.__sonaraBusinessControlRest;
  });

  function response(status, body) {
    return {
      ok: status >= 200 && status < 300,
      status,
      async json() { return body; }
    };
  }

  function buildApp({ paid = true } = {}) {
    const app = express();
    app.use(express.urlencoded({ extended: false }));
    app.use(express.json());

    registerRoutes(app, {
      layout: ({ title, heading, body, sections = [] }) => `<html><title>${title}</title><h1>${heading}</h1><p>${body}</p>${sections.join("")}</html>`,
      brandCard: (title, body) => `<article><h2>${title}</h2><p>${body}</p></article>`,
      linkAction: (href, label) => `<a href="${href}">${label}</a>`,
      escapeHtml: (value) => String(value).replace(/[&<>"']/g, ""),
      requirePaidOrOwnerAccess: () => (req, res, next) => {
        if (!paid) return res.status(402).json({ ok: false, code: "upgrade_required" });
        req.sonaraUser = { id: USER_ID, email: "owner@example.com" };
        req.sonaraAccess = { ownerOverride: true, roles: ["owner"] };
        return next();
      },
      getCustomerPrimaryOrganization: async () => ({ ok: true, organizationId: ORGANIZATION_ID }),
      getSupabaseServerConfig: () => ({ ok: true, url: "https://example.supabase.co", serviceRoleKey: "server-only" }),
      supabaseHeaders: () => ({ "Content-Type": "application/json" })
    });

    return app;
  }

  it("registers a paid, authenticated business list endpoint", async () => {
    global.fetch = async (url) => {
      assert.match(String(url), /business_workspaces/);
      return response(200, []);
    };

    const result = await request(buildApp()).get("/api/business-builder/businesses").set("Accept", "application/json");
    assert.equal(result.status, 200);
    assert.equal(result.body.ok, true);
    assert.deepEqual(result.body.businesses, []);
  });

  it("rejects business control when paid entitlement is unavailable", async () => {
    const result = await request(buildApp({ paid: false })).get("/api/business-builder/control-plane").set("Accept", "application/json");
    assert.equal(result.status, 402);
    assert.equal(result.body.code, "upgrade_required");
  });

  it("creates a physical or online business and writes an audit event", async () => {
    const calls = [];
    global.fetch = async (url, options = {}) => {
      calls.push({ url: String(url), method: options.method || "GET", body: options.body ? JSON.parse(options.body) : undefined });
      if (String(url).includes("/rest/v1/business_workspaces") && options.method === "POST") {
        return response(201, [businessRecord()]);
      }
      if (String(url).includes("/rest/v1/business_control_audit_events")) return response(201, []);
      return response(200, []);
    };

    const result = await request(buildApp())
      .post("/api/business-builder/businesses")
      .set("Accept", "application/json")
      .send({ name: "Damian's Shop", business_type: "hybrid", acquisition_mode: "connected", website_url: "https://example.com" });

    assert.equal(result.status, 201);
    assert.equal(result.body.ok, true);
    assert.equal(result.body.business.id, BUSINESS_ID);
    const createCall = calls.find((call) => call.url.includes("business_workspaces") && call.method === "POST");
    assert.equal(createCall.body.organization_id, ORGANIZATION_ID);
    assert.equal(createCall.body.owner_user_id, USER_ID);
    assert.equal(createCall.body.business_type, "hybrid");
    assert.equal(createCall.body.acquisition_mode, "connected");
    assert.ok(calls.some((call) => call.url.includes("business_control_audit_events")));
  });

  it("uses resource-specific lifecycle transitions for integrations and permissions", async () => {
    const scenarios = [
      {
        resource: "integrations",
        table: "business_integration_connections",
        id: "44444444-4444-4444-8444-444444444444",
        expected: { connection_status: "disabled" },
        forbiddenField: "status"
      },
      {
        resource: "permissions",
        table: "business_permission_grants",
        id: "55555555-5555-4555-8555-555555555555",
        expected: { status: "revoked" },
        forbiddenField: "connection_status"
      }
    ];

    for (const scenario of scenarios) {
      const calls = [];
      global.fetch = async (url, options = {}) => {
        const call = {
          url: String(url),
          method: options.method || "GET",
          body: options.body ? JSON.parse(options.body) : undefined
        };
        calls.push(call);
        if (call.url.includes("/rest/v1/business_workspaces") && call.method === "GET") {
          return response(200, [businessRecord()]);
        }
        if (call.url.includes(`/rest/v1/${scenario.table}`) && call.method === "PATCH") {
          return response(200, [{ id: scenario.id, business_id: BUSINESS_ID, ...scenario.expected }]);
        }
        if (call.url.includes("/rest/v1/business_control_audit_events") && call.method === "POST") {
          return response(201, []);
        }
        return response(200, []);
      };

      const result = await request(buildApp())
        .delete(`/api/business-builder/businesses/${BUSINESS_ID}/${scenario.resource}/${scenario.id}`)
        .set("Accept", "application/json");

      assert.equal(result.status, 200, scenario.resource);
      assert.equal(result.body.ok, true, scenario.resource);
      const patchCall = calls.find((call) => call.url.includes(`/rest/v1/${scenario.table}`) && call.method === "PATCH");
      assert.ok(patchCall, `${scenario.resource} patch was not issued`);
      for (const [field, value] of Object.entries(scenario.expected)) assert.equal(patchCall.body[field], value, scenario.resource);
      assert.equal(Object.hasOwn(patchCall.body, scenario.forbiddenField), false, scenario.resource);
      assert.equal(typeof patchCall.body.updated_at, "string", scenario.resource);
      assert.ok(calls.some((call) => call.url.includes("business_control_audit_events") && call.method === "POST"), scenario.resource);
    }
  });

  it("uses an allowlisted resource registry rather than arbitrary table names", () => {
    const source = fs.readFileSync(path.join(__dirname, "..", "routes", "sonara-business-control-plane-routes.cjs"), "utf8");
    assert.match(source, /const RESOURCES = Object\.freeze/);
    assert.match(source, /business_locations/);
    assert.match(source, /business_permission_grants/);
    assert.match(source, /archivePatch: \{ connection_status: "disabled" \}/);
    assert.match(source, /archivePatch: \{ status: "revoked" \}/);
    assert.doesNotMatch(source, /req\.params\.table/);
    assert.match(source, /organization_id=eq\./);
    assert.match(source, /business_id=eq\./);
  });

  it("ships tenant-scoped RLS, permissions, ownership transfer, audit, and business integrations", () => {
    const first = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "20260723060000_business_builder_control_plane.sql"), "utf8");
    const second = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "20260723060500_business_integration_connections.sql"), "utf8");
    assert.match(first, /business_permission_grants/);
    assert.match(first, /business_ownership_transfers/);
    assert.match(first, /business_control_audit_events/);
    assert.match(first, /enable row level security/);
    assert.match(first, /sonara_is_org_member/);
    assert.match(first, /is_org_owner_or_admin/);
    assert.doesNotMatch(first, /inventory_movements/);
    assert.match(second, /business_integration_connections/);
    assert.match(second, /credential_reference/);
    assert.match(second, /revoke select \(credential_reference\)/);
  });
});
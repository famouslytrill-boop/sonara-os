"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const request = require("supertest");
const registerLastNineHoursRoutes = require("../routes/sonara-last9-routes.cjs");
const {
  evaluateIntegrationActivation
} = require("../lib/sonara-integration-activation-policy.cjs");
const {
  decideApprovalTransition,
  mayAdvanceOrderStatus
} = require("../lib/sonara-procurement-workflow.cjs");

const ORG = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";
const ORDER = "33333333-3333-4333-8333-333333333333";

function approvedGovernance(overrides = {}) {
  return {
    governance: {
      organizationScoped: true,
      secrets: "server_only",
      commercial: {
        status: "approved",
        termsUrl: "https://provider.example/terms",
        reviewedAt: "2026-09-13T12:00:00Z"
      },
      rateLimit: { mode: "provider_headers", honorsRetryAfter: true },
      operator: { mode: "human_approval", externalActionsAllowed: false },
      ai: { mode: "disabled", required: false },
      ...overrides
    }
  };
}

describe("commercial integration activation policy", () => {
  it("allows an organization-scoped, reviewed, rate-aware connection without AI", () => {
    const result = evaluateIntegrationActivation({ settings: approvedGovernance() });
    assert.equal(result.allowed, true);
    assert.equal(result.policy.aiRequired, false);
    assert.equal(result.policy.aiMode, "disabled");
  });

  it("fails closed when commercial terms, retry behavior, or secret boundaries are missing", () => {
    const result = evaluateIntegrationActivation({
      settings: {
        governance: {
          commercial: { status: "review_required" },
          rateLimit: { mode: "provider_headers", honorsRetryAfter: false },
          operator: { mode: "automatic_internal", externalActionsAllowed: true },
          ai: { mode: "optional_external", required: true }
        }
      }
    });
    assert.equal(result.allowed, false);
    for (const code of [
      "commercial_use_not_approved",
      "retry_after_handling_required",
      "automatic_external_actions_must_be_disabled",
      "ai_cannot_be_required",
      "server_only_secret_boundary_required",
      "organization_scope_required"
    ]) assert.ok(result.reasons.includes(code), code);
  });
});

describe("deterministic procurement approval", () => {
  it("lets managers submit but reserves approval for owners", () => {
    assert.deepEqual(
      decideApprovalTransition({ currentState: "draft", action: "submit", actorRole: "manager" }).nextState,
      "pending"
    );
    assert.equal(
      decideApprovalTransition({ currentState: "pending", action: "approve", actorRole: "manager" }).code,
      "owner_role_required"
    );
    assert.equal(
      decideApprovalTransition({ currentState: "pending", action: "approve", actorRole: "owner" }).nextState,
      "approved"
    );
  });

  it("blocks fulfillment until approval and rejects impossible transitions", () => {
    assert.equal(mayAdvanceOrderStatus("pending", "sent").allowed, false);
    assert.equal(mayAdvanceOrderStatus("approved", "received").allowed, true);
    assert.equal(decideApprovalTransition({ currentState: "draft", action: "approve", actorRole: "owner" }).code, "invalid_procurement_transition");
  });

  function buildApp(role = "owner") {
    const app = express();
    app.use(express.urlencoded({ extended: false }));
    app.use(express.json());
    registerLastNineHoursRoutes(app, {
      layout: ({ title, heading, body, sections = [], actions = [] }) => `<html><title>${title}</title><h1>${heading}</h1><p>${body}</p>${actions.join("")}${sections.join("")}</html>`,
      brandCard: (title, body) => `<article><h2>${title}</h2><p>${body}</p></article>`,
      linkAction: (href, label) => `<a href="${href}">${label}</a>`,
      escapeHtml: (value) => String(value),
      requireBusinessManager: (req, res, next) => {
        req.sonaraUser = { id: USER, email: `${role}@example.com` };
        req.sonaraBusinessMembership = { role };
        req.sonaraAccess = { ownerOverride: false, roles: [role], user: req.sonaraUser };
        next();
      },
      requireCustomer: (req, res, next) => next(),
      getCustomerPrimaryOrganization: async () => ({ ok: true, organizationId: ORG, role }),
      getSupabaseServerConfig: () => ({ ok: true, url: "https://project.supabase.co", serviceRoleKey: "server-only-test-key" }),
      createRateLimiter: () => (req, res, next) => next()
    });
    return app;
  }

  it("keeps the tenant id server-resolved and calls the atomic approval RPC", async () => {
    const calls = [];
    const realFetch = global.fetch;
    global.fetch = async (url, options = {}) => {
      calls.push({ url: String(url), body: options.body ? JSON.parse(options.body) : null });
      if (String(url).includes("/rest/v1/purchase_orders?")) {
        return { ok: true, status: 200, json: async () => [{ id: ORDER, approval_status: "pending" }] };
      }
      if (String(url).includes("/rpc/sonara_transition_purchase_order_approval")) {
        return { ok: true, status: 200, json: async () => [{ purchase_order_id: ORDER, approval_status: "approved", approval_version: 2 }] };
      }
      return { ok: true, status: 200, json: async () => [] };
    };
    try {
      const result = await request(buildApp("owner"))
        .post(`/api/business/purchase-orders/${ORDER}/approval`)
        .set("Accept", "application/json")
        .send({ action: "approve", organization_id: "99999999-9999-4999-8999-999999999999", notes: "Within budget" });
      assert.equal(result.status, 200);
      assert.equal(result.body.audited, true);
      const rpc = calls.find((call) => call.url.includes("sonara_transition_purchase_order_approval"));
      assert.equal(rpc.body.p_organization_id, ORG);
      assert.equal(rpc.body.p_purchase_order_id, ORDER);
      assert.equal(rpc.body.p_actor_role, "owner");
    } finally {
      global.fetch = realFetch;
    }
  });

  it("denies a manager approval before calling the mutation RPC", async () => {
    let rpcCalled = false;
    const realFetch = global.fetch;
    global.fetch = async (url) => {
      if (String(url).includes("/rpc/sonara_transition_purchase_order_approval")) rpcCalled = true;
      return { ok: true, status: 200, json: async () => [{ id: ORDER, approval_status: "pending" }] };
    };
    try {
      const result = await request(buildApp("manager"))
        .post(`/api/business/purchase-orders/${ORDER}/approval`)
        .set("Accept", "application/json")
        .send({ action: "approve" });
      assert.equal(result.status, 403);
      assert.equal(result.body.code, "owner_role_required");
      assert.equal(rpcCalled, false);
    } finally {
      global.fetch = realFetch;
    }
  });

  it("ships an additive, service-only, atomic approval migration", () => {
    const sql = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "20260913190000_purchase_order_approval_controls.sql"), "utf8");
    assert.match(sql, /add column if not exists approval_status/);
    assert.match(sql, /for update/);
    assert.match(sql, /business_control_audit_events/);
    assert.match(sql, /revoke all on function .* from public, anon, authenticated/);
    assert.match(sql, /grant execute on function .* to service_role/);
  });
});

describe("route enforcement", () => {
  it("enforces the integration policy before a connection can be marked connected", () => {
    const source = fs.readFileSync(path.join(__dirname, "..", "routes", "sonara-business-control-plane-routes.cjs"), "utf8");
    assert.match(source, /evaluateIntegrationActivation/);
    assert.match(source, /integrations\.activation_denied/);
    assert.match(source, /integration_governance_unreadable/);
  });

  it("does not let the generic edit form write status fields", () => {
    const source = fs.readFileSync(path.join(__dirname, "..", "lib", "sonara-record-edit.cjs"), "utf8");
    assert.match(source, /field\.name !== "status"/);
  });
});

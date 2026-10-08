"use strict";

// A failed/short provider batch response is not proof that anybody received
// nothing: some or all of the hundred emails might have been accepted. This
// route must report which addresses are uncertain, which were not attempted,
// and must never re-mail an uncertain contact as a silent fallback.
//
// The previous version of this test expected two ambiguous batches to be
// replayed individually. That was precisely the duplicate-send defect.
// This replacement exercises the real route and checks the opposite contract.
const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const registerRoutes = require("../routes/growth-studio-control-routes.cjs");
const { MAX_PER_REQUEST } = require("../lib/growth-studio-dispatch.cjs");

const ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const CAMPAIGN_ID = "33333333-3333-4333-8333-333333333333";
const SEND_PATH = `/api/growth/campaigns/${CAMPAIGN_ID}/send`;
const MESSAGE = { approved: true, subject: "Spring service check", body: "Your annual service is due. Reply to book." };

// Three full batches plus a final singleton would be authorized; only the
// first ambiguous batch may be attempted. All later recipients stay untouched.
const RECIPIENTS = MAX_PER_REQUEST * 3 + 1;

function uuid(index) {
  const hex = String(index).padStart(12, "0");
  return `44444444-4444-4444-8444-${hex}`;
}

const LEADS = Array.from({ length: RECIPIENTS }, (_, index) => ({
  id: uuid(index),
  name: `Contact ${index}`,
  email: `contact${index}@example.com`,
  status: "new",
  campaign_id: CAMPAIGN_ID
}));

const CONSENTS = LEADS.map((row) => ({
  lead_id: row.id,
  channel: "email",
  consent_status: "granted",
  purpose: "marketing",
  withdrawn_at: null,
  expires_at: null
}));

function harness() {
  const calls = { batchRequests: 0, singleSends: [] };

  const fetchImpl = async (url, options = {}) => {
    const target = String(url);
    const method = options.method || "GET";

    // Before the /emails prefix below: the batch endpoint starts with it, and
    // checking in the other order sends an array body down the single-send
    // branch, where `payload.to[0]` throws on a shape it never sees in
    // production.
    if (target === "https://api.resend.com/emails/batch") {
      calls.batchRequests += 1;
      const batch = JSON.parse(options.body);
      assert.ok(Array.isArray(batch), "the batch endpoint is sent an array of messages");
      // One id for a batch of a hundred. Short rather than absent, because a
      // short `data` is the shape the dispatcher refuses to reconcile and is
      // what makes it fall back.
      return new Response(JSON.stringify({ data: [{ id: "only-one" }] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    if (target.startsWith("https://api.resend.com/suppressions")) {
      return new Response(JSON.stringify({ object: "list", data: [], has_more: false }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    if (target.startsWith("https://api.resend.com/emails")) {
      const payload = JSON.parse(options.body);
      calls.singleSends.push(payload.to[0]);
      return new Response(JSON.stringify({ id: "sent" }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (target.includes("/rest/v1/usage_credit_ledger") && method === "POST") {
      return new Response(null, { status: 201 });
    }
    if (target.includes("/rest/v1/usage_credit_ledger")) {
      return new Response(JSON.stringify([{ entry_kind: "grant", amount_minor: 1000000 }]), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    if (target.includes("/rest/v1/growth_campaigns")) {
      return new Response(
        JSON.stringify([{ id: CAMPAIGN_ID, organization_id: ORGANIZATION_ID, name: "Spring", status: "draft", channel: "email" }]),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }
    if (target.includes("/rest/v1/growth_leads")) {
      return new Response(JSON.stringify(LEADS), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (target.includes("/rest/v1/growth_contact_consents")) {
      return new Response(JSON.stringify(CONSENTS), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (target.includes("/rest/v1/growth_control_events")) {
      return new Response(JSON.stringify([{}]), { status: 201, headers: { "content-type": "application/json" } });
    }
    return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
  };

  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  registerRoutes(app, {
    layout: (data) => `<html><h1>${data.heading}</h1></html>`,
    brandCard: (title, body) => `<article>${title}${body}</article>`,
    linkAction: (href, label) => `<a href="${href}">${label}</a>`,
    escapeHtml: (value) => String(value),
    requireWorkspaceAccess: () => (req, res, next) => {
      req.sonaraUser = { id: USER_ID, email: "owner@example.com" };
      return next();
    },
    getCustomerPrimaryOrganization: async () => ({ ok: true, organizationId: ORGANIZATION_ID, role: "owner" }),
    getSupabaseServerConfig: () => ({ ok: true, url: "https://project.supabase.co", serviceRoleKey: "service-role" }),
    getReadiness: () => ({ services: { emailDelivery: "enabled" } }),
    getEnv: (name) =>
      ({
        RESEND_API_KEY: "re_test",
        RESEND_FROM_EMAIL: "growth@sonara.test",
        NEXT_PUBLIC_SITE_URL: "https://app.sonara.test",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key-for-signing"
      })[name],
    fetchImpl
  });

  return { app, calls, fetchImpl };
}

describe("an owner told a hundred were missed can find out which", () => {
  let response;
  let calls;

  before(async () => {
    const built = harness();
    calls = built.calls;
    // Installed globally as well as passed: the dispatcher and the suppression
    // reader take `fetchImpl` from their own options, and the same harness in
    // tests/the-send-route-reaches-only-the-consented.test.js swaps the global
    // for the duration. Doing only one of the two leaves part of the path
    // talking to the real network.
    const original = global.fetch;
    global.fetch = built.fetchImpl;
    try {
      response = await request(built.app).post(SEND_PATH).send(MESSAGE);
    } finally {
      global.fetch = original;
    }
  });

  it("uses exactly one batch and stops instead of retrying it as individual sends", () => {
    assert.equal(calls.batchRequests, 1);
    assert.deepEqual(calls.singleSends, []);
    assert.equal(response.status, 502, "unconfirmed sends are not verified success");
    assert.equal(response.body.code, "delivery_unconfirmed");
  });

  it("lists uncertain recipients separately from recipients never attempted", () => {
    assert.equal(response.body.sent, 0);
    assert.equal(response.body.uncertain.length, MAX_PER_REQUEST);
    assert.ok(Array.isArray(response.body.notAttempted));
    assert.equal(response.body.notAttempted.length, RECIPIENTS - MAX_PER_REQUEST);
    for (const item of response.body.uncertain) {
      assert.match(item.email, /@example\\.com$/);
      assert.equal(item.reason, "provider_outcome_unknown");
    }
    for (const item of response.body.notAttempted) {
      assert.equal(item.reason, "earlier_batch_unconfirmed");
    }
    const unknown = new Set(response.body.uncertain.map((x) => x.email));
    for (const item of response.body.notAttempted) {
      assert.ok(!unknown.has(item.email), "an unknown recipient must not also be reported as never attempted");
    }
  });

  it("does not tell an owner to retry an unverified campaign", () => {
    assert.match(response.body.detail, /delivery outcomes unconfirmed/);
    assert.match(response.body.detail, /do not send the remainder until reconciliation/);
    assert.ok(!/only the remainder needs sending/.test(response.body.detail));
    assert.ok(!/send again/i.test(response.body.detail));
    assert.equal(response.body.recorded.ok, true, "uncertainty reason rows should be recorded");
  });

  it("preserves all addresses and never labels unknown outcomes as accepted or rejected", () => {
    assert.equal(
      response.body.sent + response.body.uncertain.length + response.body.notAttempted.length,
      RECIPIENTS
    );
    assert.deepEqual(response.body.failed, []);
    assert.equal(calls.singleSends.length, 0);
  });
});

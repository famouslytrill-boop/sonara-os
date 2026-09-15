"use strict";

// The send route's response, for the recipients nothing was tried for.
//
// `lib/growth-studio-dispatch.cjs` bounds its per-recipient fallback at two
// batches, because 1,000 individual sends would run the function out of time
// mid-campaign. Past that bound the remaining recipients are reported as **not
// attempted** -- a state an owner can act on, as opposed to "attempted and
// untracked".
//
// It computed them, returned them, and the route dropped them. So the detail
// line read "200 sent, 100 not attempted" and there was no way for an owner to
// learn which hundred. `tests/a-campaign-sends-only-to-who-was-authorised.test.js`
// asserts those "must be reported, not silently dropped" -- true at the
// dispatcher boundary, which is one layer below the boundary that dropped them.
// That is the sixth shape in `.claude/skills/checks-that-cannot-lie`: a check
// too weak to catch the thing it was written for.
//
// The second assertion here is about a sentence rather than a value. The
// summary used to end "not attempted -- send again to reach them", and
// following that instruction mails everybody a second time: nothing records who
// was accepted, and the charge is keyed on the campaign, so the duplicate send
// is refused as a duplicate *charge* and the owner is never billed -- which
// removes the one signal that would have told them. The product's own output was
// walking an owner into a silent double-send.
//
// ## Why this needs 301 recipients
//
// Batches are 100 and two may fall back. Reaching "not attempted" needs a third
// batch that falls back with the budget already spent, so: batch 1 falls back,
// batch 2 falls back, batch 3 is reported. 301 leads gives 100/100/100/1, and
// the trailing single goes down the one-at-a-time path rather than the batch
// endpoint.
//
// **No route-level test exercised the batch endpoint at all before this one.**
// Every send test here used few enough recipients to stay on the single-send
// path, which is not the path a real campaign takes.

const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const registerRoutes = require("../routes/growth-studio-control-routes.cjs");
const { MAX_PER_REQUEST, MAX_FALLBACK_BATCHES } = require("../lib/growth-studio-dispatch.cjs");

const ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const CAMPAIGN_ID = "33333333-3333-4333-8333-333333333333";
const SEND_PATH = `/api/growth/campaigns/${CAMPAIGN_ID}/send`;
const MESSAGE = { approved: true, subject: "Spring service check", body: "Your annual service is due. Reply to book." };

// Enough to reach a third batch, plus one so the trailing remainder is a single
// send rather than a batch.
const RECIPIENTS = MAX_PER_REQUEST * (MAX_FALLBACK_BATCHES + 1) + 1;

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

  it("actually went down the batch path", () => {
    // Without this the rest of the file could pass over a campaign that never
    // batched, which is how every other send test in this repository misses
    // the path a real campaign takes.
    assert.ok(calls.batchRequests >= MAX_FALLBACK_BATCHES + 1, `only ${calls.batchRequests} batch requests; this test is not exercising the batch path`);
    assert.equal(response.status, 200);
  });

  it("reports the recipients nothing was tried for, by address", () => {
    assert.ok(Array.isArray(response.body.notAttempted), "the route must forward notAttempted; an owner cannot act on a count alone");
    assert.equal(response.body.notAttempted.length, MAX_PER_REQUEST);
    for (const entry of response.body.notAttempted) {
      assert.match(entry.email, /@example\.com$/, "each entry names the address, not just a reason");
      assert.equal(entry.reason, "fallback_budget_spent");
    }
  });

  it("names a hundred addresses that were genuinely never sent to", () => {
    // The two halves have to agree. A `notAttempted` list that overlapped the
    // addresses the fallback actually mailed would be worse than no list.
    const mailed = new Set(calls.singleSends);
    for (const entry of response.body.notAttempted) {
      assert.ok(!mailed.has(entry.email), `${entry.email} is reported as not attempted and was mailed`);
    }
    assert.equal(mailed.size, MAX_PER_REQUEST * MAX_FALLBACK_BATCHES + 1, "the two permitted fallbacks plus the trailing single send");
  });

  it("does not tell the owner to send the campaign again", () => {
    // The instruction that caused the harm. Following it mails everyone above a
    // second time, and the duplicate charge key means the owner is not billed
    // and so never finds out.
    assert.match(response.body.detail, /not attempted/);
    assert.ok(
      !/send again/i.test(response.body.detail),
      `the summary tells the owner to send again, which re-mails everyone already sent: ${response.body.detail}`
    );
    assert.match(response.body.detail, /re-send to everyone above/, "it has to say what sending again would actually do");
  });

  it("counts the sent and the missed separately and consistently", () => {
    assert.equal(response.body.sent + response.body.notAttempted.length, RECIPIENTS);
    assert.equal(response.body.failed.length, 0);
  });
});

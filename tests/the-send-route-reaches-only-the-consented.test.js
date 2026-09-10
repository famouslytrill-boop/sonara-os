"use strict";

const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const registerRoutes = require("../routes/growth-studio-control-routes.cjs");
const { quote } = require("../lib/sonara-paid-capabilities.cjs");
const { MINIMUM_BILLABLE_EMAILS } = require("../lib/growth-studio-sender.cjs");

// The route is the only one of the three send pieces that touches the database,
// and that is where the interesting failures are. `growth-studio-sender.cjs` is
// asserted against invented recipients and `growth-studio-dispatch.cjs` against
// an invented decision; neither can catch the route handing them the wrong data.
//
// So these assertions are about the seam. Three shapes of defect live there:
//
//   * **A failed read becoming a fact.** An unreadable consent table must never
//     be reported as "nobody on your list consented" -- that tells an owner
//     something definite about their own contacts on the strength of a request
//     that did not happen.
//   * **A filter that quietly stopped applying.** The channel filter, the
//     archived exclusion and the campaign scope are all in a query string, and a
//     query string is the easiest thing in this file to break without a test
//     noticing.
//   * **A guard whose dependency was never wired.** `dispatchCampaign` refuses
//     to send when email is unconfigured -- but only if it is given
//     `getReadiness`. Passed nothing, that check does not run at all.

const ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_USER_ID = "99999999-9999-4999-8999-999999999999";
const CAMPAIGN_ID = "33333333-3333-4333-8333-333333333333";

const SEND_PATH = `/api/growth/campaigns/${CAMPAIGN_ID}/send`;
const MESSAGE = { approved: true, subject: "Spring service check", body: "Your annual service is due. Reply to book." };

const LEDGER = "usage_credit_ledger";
const FUNDED = [{ entry_kind: "grant", amount_minor: 100000 }];

function lead(id, email, overrides = {}) {
  return { id, name: `Contact ${id.slice(0, 4)}`, email, status: "new", campaign_id: CAMPAIGN_ID, ...overrides };
}

function consent(leadId, overrides = {}) {
  return { lead_id: leadId, channel: "email", consent_status: "granted", purpose: "marketing", withdrawn_at: null, expires_at: null, ...overrides };
}

const ID = (n) => `4444444${n}-4444-4444-8444-44444444444${n}`;

// The whole external world, recorded so the assertions can ask what was actually
// requested rather than only what came back.
function harness({
  campaign = { id: CAMPAIGN_ID, organization_id: ORGANIZATION_ID, name: "Spring", status: "draft", channel: "email" },
  leads = [lead(ID(1), "one@example.com")],
  consents = [consent(ID(1))],
  ledgerRows = FUNDED,
  leadsOk = true,
  consentsOk = true,
  ledgerOk = true,
  resendStatus = () => 200,
  emailDelivery = "enabled",
  // NEXT_PUBLIC_SITE_URL is what siteOrigin reads, and it must be https:
  // dispatchCampaign refuses to send without an https origin, because the
  // unsubscribe link is built from it. SUPABASE_SERVICE_ROLE_KEY is what the
  // unsubscribe token is signed from when no dedicated secret is set.
  env = {
    RESEND_API_KEY: "re_test",
    RESEND_FROM_EMAIL: "growth@sonara.test",
    NEXT_PUBLIC_SITE_URL: "https://app.sonara.test",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key-for-signing"
  },
  startingAllowanceMinor = null,
  suppressed = [],
  suppressionOk = true,
} = {}) {
  const calls = { urls: [], sentTo: [], ledgerRows: [], events: [] };

  const fetchImpl = async (url, options = {}) => {
    const target = String(url);
    const method = options.method || "GET";
    calls.urls.push(`${method} ${target}`);

    if (target.startsWith("https://api.resend.com/suppressions")) {
      if (!suppressionOk) return new Response("nope", { status: 500 });
      return new Response(
        JSON.stringify({ object: "list", data: suppressed.map((email) => ({ id: email, email, origin: "bounce" })), has_more: false }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }
    if (target.startsWith("https://api.resend.com/emails")) {
      const payload = JSON.parse(options.body);
      calls.sentTo.push(...payload.to);
      const status = resendStatus(payload.to[0]);
      return new Response(JSON.stringify({ id: "sent" }), { status, headers: { "content-type": "application/json" } });
    }
    if (target.includes(`/rest/v1/${LEDGER}`) && method === "POST") {
      calls.ledgerRows.push(JSON.parse(options.body));
      return new Response(null, { status: ledgerOk ? 201 : 500 });
    }
    if (target.includes(`/rest/v1/${LEDGER}`)) {
      return new Response(JSON.stringify(ledgerRows), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (target.includes("/rest/v1/growth_campaigns")) {
      return new Response(JSON.stringify(campaign ? [campaign] : []), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (target.includes("/rest/v1/growth_leads")) {
      if (!leadsOk) return new Response("boom", { status: 500 });
      return new Response(JSON.stringify(leads), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (target.includes("/rest/v1/growth_contact_consents")) {
      if (!consentsOk) return new Response("boom", { status: 500 });
      return new Response(JSON.stringify(consents), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (target.includes("/rest/v1/growth_control_events")) {
      calls.events.push(JSON.parse(options.body));
      return new Response(JSON.stringify([{}]), { status: 201, headers: { "content-type": "application/json" } });
    }
    return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
  };

  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  registerRoutes(app, {
    // Renders the sections, because the cards ARE what these assertions are
    // about. A stub that drops them would let every page assertion below pass
    // against a page with nothing on it.
    layout: (data) => `<html><h1>${data.heading}</h1><p>${data.body}</p>${(data.sections || []).join("")}</html>`,
    brandCard: (title, body) => `<article>${title}${body}</article>`,
    linkAction: (href, label) => `<a href="${href}">${label}</a>`,
    escapeHtml: (value) => String(value),
    requireWorkspaceAccess: () => (req, res, next) => {
      req.sonaraUser = { id: USER_ID, email: "owner@example.com" };
      return next();
    },
    getCustomerPrimaryOrganization: async () => ({ ok: true, organizationId: ORGANIZATION_ID }),
    getSupabaseServerConfig: () => ({ ok: true, url: "https://project.supabase.co", serviceRoleKey: "server-only" }),
    getReadiness: () => ({ services: { emailDelivery } }),
    getEnv: (name) => env[name],
    // Null leaves the real default in place. Zeroing it is how the no-credit
    // refusal becomes reachable at all: the starting allowance is a free tier,
    // and a test that never turns it off can only ever see the funded path.
    ...(startingAllowanceMinor === null ? {} : { campaignStartingAllowanceMinor: startingAllowanceMinor })
  });

  return { app, calls, fetchImpl };
}

async function send(options = {}, body = MESSAGE) {
  const { app, calls, fetchImpl } = harness(options);
  const original = global.fetch;
  global.fetch = fetchImpl;
  try {
    const response = await request(app).post(options.path || SEND_PATH).send(body);
    return { response, calls };
  } finally {
    global.fetch = original;
  }
}

// What a browser does: urlencoded to the id-less path, with the campaign chosen
// by a field because a `<select>` cannot set a path segment.
async function sendAsForm(options = {}, fields = { approved: "true", subject: "Spring service check", body: "Your annual service is due." }) {
  const { app, calls, fetchImpl } = harness(options);
  const original = global.fetch;
  global.fetch = fetchImpl;
  try {
    const response = await request(app)
      .post("/api/growth/campaigns/send")
      .type("form")
      .set("Accept", "text/html")
      .send({ campaign_id: CAMPAIGN_ID, ...fields });
    return { response, calls };
  } finally {
    global.fetch = original;
  }
}

async function loadCampaignsPage(options = {}, query = "") {
  const { app, fetchImpl } = harness(options);
  const original = global.fetch;
  global.fetch = fetchImpl;
  try {
    return await request(app).get(`/growth-studio/your-campaigns${query}`).set("Accept", "text/html");
  } finally {
    global.fetch = original;
  }
}

const queryFor = (calls, table) => calls.urls.find((entry) => entry.includes(`/rest/v1/${table}?`)) || "";

describe("the send route reaches only the consented", () => {
  it("sends to a consented contact and charges for it", async () => {
    const { response, calls } = await send();
    assert.equal(response.status, 200);
    assert.equal(response.body.sent, 1);
    assert.deepEqual(calls.sentTo, ["one@example.com"]);
    // One email, billed at the ten-email minimum the sender documents -- and the
    // reason `authoriseCampaign` showed the customer said exactly that, so the
    // invoice has to agree with it.
    assert.equal(calls.ledgerRows.length, 1);
    assert.equal(calls.ledgerRows[0].amount_minor, quote("campaign_email", MINIMUM_BILLABLE_EMAILS).chargeMinor);
    assert.ok(
      quote("campaign_email", MINIMUM_BILLABLE_EMAILS).chargeMinor > quote("campaign_email", 1).chargeMinor,
      "if billing one email cost the same as ten this assertion could not tell the minimum was applied"
    );
    assert.equal(calls.ledgerRows[0].idempotency_key, `campaign:${CAMPAIGN_ID}`);
  });

  describe("the approval", () => {
    it("refuses without an explicit approval, before reading anything at all", async () => {
      const { response, calls } = await send({}, { subject: "Hello", body: "Body" });
      assert.equal(response.status, 400);
      assert.equal(response.body.code, "explicit_campaign_approval_required");
      assert.deepEqual(calls.urls, [], "an unapproved campaign must not even reach the database");
      assert.deepEqual(calls.sentTo, []);
    });

    it("records the authenticated caller as the approver, never a name from the body", async () => {
      // A request that can name its own approver is a request that approves
      // itself, and the approver is what makes the AGENTS.md rule mean anything.
      //
      // This assertion first read `ledgerRows[0].actor_user_id` and was
      // WORTHLESS: the actor comes from the dispatch, not from the approval, so
      // it read the authenticated user however the approval was built. Pointing
      // the route's approval at `req.body.approved_by` left it green. The
      // approver had to become observable before it could be asserted, which is
      // why the control event now records it.
      const { response, calls } = await send({}, { ...MESSAGE, approved_by: OTHER_USER_ID, approver: OTHER_USER_ID });
      assert.equal(response.status, 200);
      const event = calls.events.find((entry) => entry.event_type === "campaign.sent");
      assert.ok(event, "the send recorded no event, so there is nothing to audit the approval against");
      assert.equal(event.details.approved_by, USER_ID);
      assert.notEqual(event.details.approved_by, OTHER_USER_ID, "the approver must not be a value the request supplied");
      assert.equal(calls.ledgerRows[0].actor_user_id, USER_ID);
    });

    it("needs a subject and a body before it will read a contact list", async () => {
      for (const body of [{ approved: true, subject: "", body: "text" }, { approved: true, subject: "Subject", body: "" }]) {
        const { response, calls } = await send({}, body);
        assert.equal(response.status, 400);
        assert.equal(response.body.code, "campaign_message_required");
        assert.deepEqual(calls.sentTo, []);
      }
    });
  });

  // The defect this repository is named for, on the two reads that decide who
  // gets mailed.
  describe("a read that did not answer is never a fact about the contacts", () => {
    it("refuses when the contact list cannot be read", async () => {
      const { response, calls } = await send({ leadsOk: false });
      assert.equal(response.status, 503);
      assert.equal(response.body.code, "cannot_read_recipients");
      assert.deepEqual(calls.sentTo, []);
    });

    it("refuses when consent records cannot be read, and does not call it 'nobody consented'", async () => {
      const { response, calls } = await send({ consentsOk: false });
      assert.equal(response.status, 503);
      assert.equal(response.body.code, "cannot_read_consent");
      assert.notEqual(
        response.body.code,
        "no_consented_recipients",
        "an unreadable consent table must not be reported as an absence of consent"
      );
      assert.deepEqual(calls.sentTo, []);
    });

    it("refuses when the credit balance cannot be read, rather than sending unpaid", async () => {
      const { response, calls } = await send({ ledgerRows: "not-an-array" });
      assert.equal(response.status, 503);
      assert.equal(response.body.code, "balance_unreadable");
      assert.deepEqual(calls.sentTo, []);
    });

    it("tells an empty contact list apart from an unreadable one", async () => {
      const { response } = await send({ leads: [] });
      assert.equal(response.status, 409);
      assert.equal(response.body.code, "no_recipients");
    });
  });

  describe("consent, enforced in the query and again in the decision", () => {
    it("asks the database only for email consent", async () => {
      const { calls } = await send();
      assert.match(queryFor(calls, "growth_contact_consents"), /channel=eq\.email/);
    });

    it("still skips a wrong-channel row if that filter ever stops applying", async () => {
      // The belt to the query's braces. If `channel=eq.email` were dropped the
      // assertion above fails -- but a filter can also be defeated by a
      // PostgREST change or a typo that still returns rows, and then only this
      // one catches it. A permission to text is not a permission to email.
      const { response, calls } = await send({ consents: [consent(ID(1), { channel: "sms" })] });
      assert.equal(response.status, 409);
      assert.equal(response.body.code, "no_consented_recipients");
      assert.deepEqual(calls.sentTo, []);
    });

    it("honours a withdrawal even when another row still says granted", async () => {
      const { response, calls } = await send({
        leads: [lead(ID(1), "one@example.com"), lead(ID(2), "two@example.com")],
        consents: [
          consent(ID(1)),
          consent(ID(1), { purpose: "newsletter", consent_status: "withdrawn" }),
          consent(ID(2))
        ]
      });
      assert.equal(response.status, 200);
      assert.deepEqual(calls.sentTo, ["two@example.com"], "a withdrawal is an instruction to stop, not the absence of one");
      assert.equal(response.body.skipped.length, 1);
      assert.equal(response.body.skipped[0].reason, "consent_revoked");
    });

    it("skips a contact with no consent rows and names the reason", async () => {
      const { response, calls } = await send({
        leads: [lead(ID(1), "one@example.com"), lead(ID(2), "two@example.com")],
        consents: [consent(ID(1))]
      });
      assert.deepEqual(calls.sentTo, ["one@example.com"]);
      assert.equal(response.body.skipped[0].reason, "no_consent");
      assert.match(response.body.detail, /1 skipped for consent/, "the owner must see the difference between the list and the send");
    });

    it("never mails an address the decision skipped", async () => {
      // The property the whole three-file split exists to guarantee, asserted
      // through the real route rather than against an invented decision.
      const { calls } = await send({
        leads: [ID(1), ID(2), ID(3)].map((id, index) => lead(id, `contact${index}@example.com`)),
        consents: [consent(ID(1)), consent(ID(3), { consent_status: "unknown" })]
      });
      assert.deepEqual(calls.sentTo, ["contact0@example.com"]);
      for (const address of ["contact1@example.com", "contact2@example.com"]) {
        assert.ok(!calls.sentTo.includes(address), `${address} had no usable consent and must not have been mailed`);
      }
    });
  });

  describe("which contacts a campaign means", () => {
    it("defaults to the campaign's own contacts rather than the whole workspace", async () => {
      const { calls } = await send();
      const query = queryFor(calls, "growth_leads");
      assert.match(query, new RegExp(`campaign_id=eq\\.${CAMPAIGN_ID}`));
      assert.match(query, new RegExp(`organization_id=eq\\.${ORGANIZATION_ID}`), "the tenant filter IS the boundary under a service-role key");
    });

    it("widens to the workspace only when asked explicitly", async () => {
      const { calls } = await send({}, { ...MESSAGE, audience: "organization" });
      const query = queryFor(calls, "growth_leads");
      assert.ok(!query.includes("campaign_id=eq."), "an explicit organization audience should not stay scoped to one campaign");
      assert.match(query, new RegExp(`organization_id=eq\\.${ORGANIZATION_ID}`));
    });

    it("excludes contacts the owner archived", async () => {
      const { calls } = await send();
      assert.match(queryFor(calls, "growth_leads"), /status=neq\.archived/);
    });

    it("refuses a campaign the owner has finished or put away", async () => {
      for (const status of ["completed", "archived"]) {
        const { response, calls } = await send({ campaign: { id: CAMPAIGN_ID, status, name: "Old" } });
        assert.equal(response.status, 409);
        assert.equal(response.body.code, "campaign_not_sendable");
        assert.deepEqual(calls.sentTo, []);
      }
    });
  });

  describe("the limits that keep a half-finished send from happening", () => {
    it("refuses a list larger than one request can finish, rather than sending part of it", async () => {
      const { MAX_RECIPIENTS_PER_SEND } = require("../routes/growth-studio-control-routes.cjs");
      const over = Array.from({ length: MAX_RECIPIENTS_PER_SEND + 1 }, (unused, index) =>
        lead(`4444444${index % 10}-4444-4444-8444-4444444444${String(index % 100).padStart(2, "0")}`, `bulk${index}@example.com`)
      );
      const { response, calls } = await send({ leads: over });
      assert.equal(response.status, 413);
      assert.equal(response.body.code, "too_many_recipients");
      assert.deepEqual(calls.sentTo, [], "sending 400 of 401 and reporting success is worse than refusing");
    });

    it("keeps the cap inside the function's own lifetime, with the arithmetic checkable", async () => {
      const { MAX_RECIPIENTS_PER_SEND } = require("../routes/growth-studio-control-routes.cjs");
      // Vercel's documented default duration is 300s (read 10 September 2026),
      // and vercel.json sets no maxDuration. At a pessimistic 500ms per send:
      const pessimisticSeconds = MAX_RECIPIENTS_PER_SEND * 0.5;
      assert.ok(pessimisticSeconds <= 200, `${MAX_RECIPIENTS_PER_SEND} recipients is ${pessimisticSeconds}s at 500ms each, with no headroom left in 300s`);
    });
  });

  describe("off unless configured, which is the rule rather than a preference", () => {
    it("sends nothing when email delivery is not configured", async () => {
      for (const emailDelivery of ["setup_required", "invalid"]) {
        const { response, calls } = await send({ emailDelivery });
        assert.equal(response.status, 503);
        assert.equal(response.body.code, "email_not_configured");
        assert.deepEqual(calls.sentTo, [], "AGENTS.md: email alerts must be off or explicitly user-controlled by default");
      }
    });

    it("sends nothing when the provider credentials are absent", async () => {
      for (const env of [{}, { RESEND_API_KEY: "re_test" }, { RESEND_FROM_EMAIL: "a@b.test" }]) {
        const { response, calls } = await send({ env });
        assert.equal(response.status, 503);
        assert.equal(response.body.code, "email_not_configured");
        assert.deepEqual(calls.sentTo, []);
      }
    });

    it("is actually wired to a readiness source, rather than passing null", async () => {
      // The guard exists in the dispatcher and does nothing unless the route
      // hands it getReadiness. A dependency that was never wired is a check that
      // never runs, and it looks identical from the dispatcher's side.
      //
      // The first version of this matched /getReadiness/ against the whole
      // registration block INCLUDING ITS COMMENTS -- and the comment there
      // explains why getReadiness is needed, so the assertion matched its own
      // prose and stayed green with the dependency deleted. Comments are
      // stripped first, and the match is anchored to a property line.
      const source = require("node:fs").readFileSync(require.resolve("../server.js"), "utf8");
      const start = source.indexOf("registerGrowthStudioControlRoutes(app, {");
      assert.ok(start > 0, "the growth route registration was not found; this check has gone blind");
      const block = source.slice(start, source.indexOf("});", start)).replace(/\/\/[^\n]*/g, "");
      assert.ok(!block.includes("//"), "comments were not stripped, so this could match prose instead of code");
      assert.match(block, /^\s*getReadiness\s*[,:]/m, "server.js must pass getReadiness to the growth routes");
      assert.match(block, /^\s*getEnv\s*[,:]?\s*$/m, "server.js must pass getEnv, or the provider credentials are read from a different place than the rest of the app");
    });
  });

  describe("credit", () => {
    it("refuses with a 402 when there is no credit, and sends nothing", async () => {
      const { response, calls } = await send({ ledgerRows: [], startingAllowanceMinor: 0 });
      assert.equal(response.status, 402);
      assert.equal(response.body.code, "insufficient_credit");
      assert.deepEqual(calls.sentTo, []);
    });

    it("does not answer 402 for a refusal buying credit cannot fix", async () => {
      const { response } = await send({ consents: [] });
      assert.equal(response.body.code, "no_consented_recipients");
      assert.notEqual(response.status, 402, "an owner must not be asked to pay to be refused again");
    });

    it("charges for what was accepted, not for what was attempted", async () => {
      // Twenty-four consented, four rejected by the provider. Both counts are
      // clear of the ten-email minimum, so the charge distinguishes "billed for
      // accepted" from "billed for attempted" rather than both collapsing onto
      // the floor. We pay Resend for accepted messages, so billing the four
      // would charge a customer for our own failed requests.
      const ids = Array.from({ length: 24 }, (unused, index) => `4444444${index % 10}-4444-4444-8444-4444444444${String(index).padStart(2, "0")}`);
      const rejected = ["bulk0@example.com", "bulk3@example.com", "bulk7@example.com", "bulk9@example.com"];
      const { response, calls } = await send({
        leads: ids.map((id, index) => lead(id, `bulk${index}@example.com`)),
        consents: ids.map((id) => consent(id)),
        resendStatus: (address) => (rejected.includes(address) ? 422 : 200)
      });

      assert.equal(response.status, 200);
      assert.equal(response.body.sent, 20);
      assert.equal(response.body.failed.length, 4);
      assert.equal(response.body.code, "partly_sent");
      assert.equal(calls.ledgerRows[0].amount_minor, quote("campaign_email", 20).chargeMinor, "charging 24 would bill a customer for our own failures");
      assert.notEqual(calls.ledgerRows[0].amount_minor, quote("campaign_email", 24).chargeMinor);
      // The owner needs to know WHO did not receive it.
      assert.deepEqual(response.body.failed.map((entry) => entry.email).sort(), rejected.slice().sort());
    });

    it("does not un-send the campaign when the ledger write fails", async () => {
      const { response, calls } = await send({ ledgerOk: false });
      assert.equal(response.status, 200, "the email has gone; reporting nothing was sent would be false");
      assert.deepEqual(calls.sentTo, ["one@example.com"]);
      assert.equal(response.body.charge.ok, false, "and the gap is reported rather than hidden");
    });
  });


  // The route existed and no page posted to it, which in this repository is a
  // recognised defect rather than an omission: an endpoint reachable only by an
  // API client is not a feature a small business owner has.
  describe("the form a customer actually uses", () => {
    it("sends from the id-less path, taking the campaign from the field", async () => {
      const { response, calls } = await sendAsForm();
      assert.equal(response.status, 303, "a browser posting a form needs a page back, not a JSON body");
      assert.deepEqual(calls.sentTo, ["one@example.com"]);
    });

    it("puts the counts on the redirect, because the body is not shown to anybody", async () => {
      const { response } = await sendAsForm({
        leads: [lead(ID(1), "one@example.com"), lead(ID(2), "two@example.com")],
        consents: [consent(ID(1))]
      });
      const target = response.headers.location;
      assert.match(target, /^\/growth-studio\/your-campaigns\?/);
      assert.match(target, /sent=1/);
      assert.match(target, /skipped=1/, "an owner told '1 sent' would believe they reached both");
    });

    it("redirects with the reason when nothing was sent", async () => {
      const { response, calls } = await sendAsForm({}, { subject: "Hello", body: "Body" });
      assert.equal(response.status, 303);
      assert.match(response.headers.location, /problem=explicit_campaign_approval_required/);
      assert.deepEqual(calls.sentTo, []);
    });

    it("validates a body-supplied campaign id the same way as a path one", async () => {
      const { app, fetchImpl } = harness();
      const original = global.fetch;
      global.fetch = fetchImpl;
      try {
        const response = await request(app)
          .post("/api/growth/campaigns/send")
          .type("form")
          .set("Accept", "text/html")
          .send({ campaign_id: "not-a-uuid", approved: "true", subject: "s", body: "b" });
        assert.equal(response.status, 303);
        assert.match(response.headers.location, /problem=invalid_campaign_id/);
      } finally {
        global.fetch = original;
      }
    });

    it("still answers a JSON caller with JSON on the same path", async () => {
      // Both entry points serve both kinds of caller. A route that only spoke
      // HTML would make the id-less path unusable from an API client.
      const { app, fetchImpl } = harness();
      const original = global.fetch;
      global.fetch = fetchImpl;
      try {
        const response = await request(app).post("/api/growth/campaigns/send").send({ campaignId: CAMPAIGN_ID, ...MESSAGE });
        assert.equal(response.status, 200);
        assert.equal(response.body.sent, 1);
      } finally {
        global.fetch = original;
      }
    });
  });

  describe("the page the form lives on", () => {
    it("offers the send form", async () => {
      const page = await loadCampaignsPage();
      assert.equal(page.status, 200);
      assert.match(page.text, /action="\/api\/growth\/campaigns\/send"/, "the form must post somewhere the route serves");
      assert.match(page.text, /name="campaign_id"/);
      assert.match(page.text, /name="approved"/);
    });

    it("does not pre-tick the approval box", async () => {
      // A box already ticked when the page loads is not an approval anybody
      // gave, and AGENTS.md requires the owner's approval for a customer
      // campaign.
      const page = await loadCampaignsPage();
      const box = page.text.slice(page.text.indexOf('name="approved"') - 80, page.text.indexOf('name="approved"') + 80);
      assert.ok(!/checked/.test(box), `the approval box must start unticked: ${box}`);
    });

    it("does not offer a campaign it would then refuse", async () => {
      // A completed campaign is refused on submit, so offering it is a form
      // that fails on a choice it presented as valid.
      //
      // The first version of this asserted a regex matching EITHER branch, which
      // is no assertion at all -- it passed whichever way the page rendered.
      const page = await loadCampaignsPage({ campaign: { id: CAMPAIGN_ID, name: "Finished spring push", status: "completed" } });
      assert.match(page.text, /None of your campaigns can be sent right now/);
      // Scoped to an option carrying THIS campaign. The page also renders the
      // create form, whose status field is a select of its own -- asserting on
      // `<option` anywhere caught that instead and failed for the wrong reason.
      assert.ok(!new RegExp(`<option value="${CAMPAIGN_ID}"`).test(page.text), "a finished campaign must not appear in the send select");
      assert.ok(!/Finished spring push<\/option>/.test(page.text));
    });

    it("does offer a campaign that can be sent, so the check above is not passing on an empty page", async () => {
      const page = await loadCampaignsPage({ campaign: { id: CAMPAIGN_ID, name: "Live spring push", status: "active" } });
      assert.match(page.text, new RegExp(`<option value="${CAMPAIGN_ID}">Live spring push</option>`));
      assert.ok(!/None of your campaigns can be sent right now/.test(page.text));
    });

    it("reports the outcome of a send it was redirected back from", async () => {
      const page = await loadCampaignsPage({}, "?sent=8&skipped=2&failed=1");
      assert.match(page.text, /8 sent/);
      assert.match(page.text, /2 skipped/);
      assert.match(page.text, /1 could not be delivered/);
    });

    it("says nothing about a send on a first visit", async () => {
      const page = await loadCampaignsPage();
      assert.ok(!/went out/.test(page.text), "a page nobody sent from must not report a send");
    });

    it("puts a refusal in the owner's words, not as a code", async () => {
      const page = await loadCampaignsPage({}, "?problem=no_consented_recipients");
      assert.match(page.text, /agreed to hear from you/);
      assert.ok(!/no_consented_recipients/.test(page.text), "a raw code is not an explanation");
    });

    it("still explains an unrecognised code rather than rendering a blank card", async () => {
      const page = await loadCampaignsPage({}, "?problem=something_nobody_listed");
      assert.match(page.text, /Nothing was sent/);
      assert.match(page.text, /something nobody listed/, "an unmapped code should be readable and quotable, not blank");
    });
  });


  // growth-studio-sender.cjs documented a `suppressed` skip reason and nothing
  // set it, so the partition honoured a field that could never be true. This is
  // that field firing, through the real route.
  describe("an address the provider gave up on", () => {
    it("is skipped and named, not mailed", async () => {
      const { response, calls } = await send({
        leads: [lead(ID(1), "one@example.com"), lead(ID(2), "two@example.com")],
        consents: [consent(ID(1)), consent(ID(2))],
        suppressed: ["two@example.com"]
      });

      assert.equal(response.status, 200);
      assert.deepEqual(calls.sentTo, ["one@example.com"]);
      assert.equal(response.body.skipped.length, 1);
      assert.equal(response.body.skipped[0].reason, "suppressed");
      assert.equal(response.body.suppressedSkipped, 1);
      assert.equal(response.body.suppressionChecked, true);
    });

    it("is not charged for", async () => {
      // Billed on who is reached, and a suppressed address is not reached.
      const { response, calls } = await send({
        leads: [lead(ID(1), "one@example.com"), lead(ID(2), "two@example.com")],
        consents: [consent(ID(1)), consent(ID(2))],
        suppressed: ["two@example.com"]
      });
      assert.equal(response.body.sent, 1);
      assert.equal(calls.ledgerRows.length, 1);
      assert.equal(calls.ledgerRows[0].units, MINIMUM_BILLABLE_EMAILS, "one reached, billed at the documented minimum");
    });

    it("is asked about before the send, not after", async () => {
      const { calls } = await send({ suppressed: [] });
      const suppressionAt = calls.urls.findIndex((entry) => entry.includes("/suppressions"));
      const firstSendAt = calls.urls.findIndex((entry) => entry.includes("/emails"));
      assert.ok(suppressionAt >= 0, "the suppression list was never read");
      assert.ok(firstSendAt >= 0, "nothing was sent, so the ordering below proves nothing");
      assert.ok(suppressionAt < firstSendAt, "screening after the send would be a screen that changed nothing");
    });

    it("sends anyway when the list cannot be read, and says the screen did not run", async () => {
      // A screen on top of the consent rules rather than one of them: refusing
      // the owner's campaign because a third-party API blipped costs them the
      // campaign. But never silently.
      const { response, calls } = await send({ suppressionOk: false });
      assert.equal(response.status, 200);
      assert.deepEqual(calls.sentTo, ["one@example.com"], "an unreadable screen must not refuse the campaign");
      assert.equal(response.body.suppressionChecked, false);
      assert.ok(response.body.suppressionUnchecked, "an unscreened send that does not say so is the defect this repo is named for");
      assert.match(response.body.suppressionUnchecked, /could not be read/);
    });

    it("records whether the screen ran on the event as well", async () => {
      const { calls } = await send({ suppressionOk: false });
      const event = calls.events.find((entry) => entry.event_type === "campaign.sent");
      assert.equal(event.details.suppression_checked, false, "an owner reading back why a campaign bounced needs to know it was unscreened");
    });

    it("does not claim the screen ran when it did not, even with nobody suppressed", async () => {
      // The trap: an empty suppression list and a failed read both mark nobody,
      // so `suppressedSkipped: 0` cannot tell them apart. Only the flag can.
      const clean = await send({ suppressed: [] });
      const broken = await send({ suppressionOk: false });
      assert.equal(clean.response.body.suppressedSkipped, broken.response.body.suppressedSkipped);
      assert.notEqual(clean.response.body.suppressionChecked, broken.response.body.suppressionChecked);
    });
  });

  it("records what happened, including the refusals", async () => {
    const { calls } = await send();
    const sentEvent = calls.events.find((entry) => entry.event_type === "campaign.sent");
    assert.ok(sentEvent, "a send with no record is a charge nobody can trace");
    assert.equal(sentEvent.organization_id, ORGANIZATION_ID);
    assert.equal(sentEvent.details.sent, 1);

    const refused = await send({ ledgerRows: [], startingAllowanceMinor: 0 });
    assert.ok(
      refused.calls.events.some((entry) => entry.event_type === "campaign.send_refused"),
      "a refusal an owner cannot see is a refusal they will report as a bug"
    );
  });
});

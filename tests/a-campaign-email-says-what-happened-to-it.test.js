"use strict";

// The Growth chain stopped at "the provider accepted it". Whether a campaign
// email reached the inbox, bounced, was marked as spam, was opened or had a link
// followed was never recorded, so a campaign's page could not say, and an owner
// reading "accepted" could only assume "delivered".
//
// The provider reports each of those as a signed webhook. These tests hold the
// signature check to the vendor's own published value, the webhook to the send
// it belongs to, and the campaign page to what was reported -- stated against
// the emails the provider can report on, which is not always all of them.

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const express = require("express");
const request = require("supertest");
const { createFakeSupabase } = require("./helpers/fake-supabase.cjs");
const receipts = require("../lib/sonara-email-delivery-receipts.cjs");
const { createReceiptWebhookHandler } = require("../routes/sonara-email-receipt-routes.cjs");
const registerGrowthRoutes = require("../routes/growth-studio-control-routes.cjs");

const ORG = "11111111-1111-4111-8111-111111111111";
const OTHER_ORG = "99999999-9999-4999-8999-999999999999";
const USER = "22222222-2222-4222-8222-222222222222";
const CAMPAIGN = "33333333-3333-4333-8333-333333333333";
const MESSAGE = "56761188-7520-42d8-8898-ff6fc54ce618";
const SECOND = "66761188-7520-42d8-8898-ff6fc54ce618";
const SECRET = "whsec_" + Buffer.from("a-test-signing-key-of-some-length").toString("base64");

function signed(event, { id = "msg_" + crypto.randomBytes(6).toString("hex"), secret = SECRET, timestamp = Math.floor(Date.now() / 1000) } = {}) {
  const body = JSON.stringify(event);
  const key = Buffer.from(secret.slice("whsec_".length), "base64");
  const signature = crypto.createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
  return { body, headers: { "svix-id": id, "svix-timestamp": String(timestamp), "svix-signature": `v1,${signature}` } };
}

const delivered = (type, messageId = MESSAGE, extra = {}) => ({ type, created_at: "2026-10-07T12:00:00.000Z", data: { email_id: messageId, to: ["ann@example.com"], ...extra } });

describe("a campaign email says what happened to it", () => {
  describe("the signature", () => {
    it("reproduces the value Svix publishes for its own test vector", () => {
      const body = '{"event_type":"ping","data":{"success":true}}';
      const vector = { secret: "whsec_plJ3nmyCDGBKInavdOK15jsl", id: "msg_loFOjxBNrRLzqYUf", timestamp: "1731705121", signature: "v1,rAvfW3dJ/X/qxhsaXPOyyCGmRKsaKWcsNccKXlIktD0=", body, nowSeconds: 1731705121 };
      assert.deepEqual(receipts.verifySignature(vector), { ok: true });
      assert.equal(receipts.verifySignature({ ...vector, body: body.replace("true", "false") }).code, "bad_signature");
      assert.equal(receipts.verifySignature({ ...vector, nowSeconds: 1731705121 + 301 }).code, "stale");
      assert.equal(receipts.verifySignature({ ...vector, secret: "" }).code, "not_configured");
      assert.equal(receipts.verifySignature({ ...vector, signature: "v2,rAvfW3dJ/X/qxhsaXPOyyCGmRKsaKWcsNccKXlIktD0=" }).code, "bad_signature", "a signature of an unknown version was accepted");
      assert.deepEqual(receipts.verifySignature({ ...vector, signature: "v1,bm9ldHUjKzFob2VudXRob2VodWUzMjRvdWVvdW9ldQo= v1,rAvfW3dJ/X/qxhsaXPOyyCGmRKsaKWcsNccKXlIktD0=" }), { ok: true }, "a valid signature after an old one was refused");
    });

    it("turns only post-acceptance events into receipts", () => {
      assert.deepEqual(receipts.receiptFrom(delivered("email.bounced", MESSAGE, { bounce: { type: "Permanent" } })).record.bounce_type, "permanent");
      assert.equal(receipts.receiptFrom(delivered("email.bounced")).record.bounce_type, "undetermined");
      assert.equal(receipts.receiptFrom(delivered("email.sent")).ignore, "not_a_receipt");
      assert.equal(receipts.receiptFrom(delivered("email.delivered", "not-an-id")).ignore, "no_message_id");
    });
  });

  describe("the webhook", () => {
    let fake;
    let savedFetch;
    function app(env = { RESEND_WEBHOOK_SECRET: SECRET }) {
      const server = express();
      server.post("/api/webhooks/resend", express.raw({ type: "application/json" }), createReceiptWebhookHandler({
        getEnv: (name) => env[name],
        getSupabaseServerConfig: () => ({ ok: true, url: fake.url, serviceRoleKey: "service-role" }),
        supabaseHeaders: (config, options = {}) => ({ apikey: config.serviceRoleKey, Authorization: `Bearer ${config.serviceRoleKey}`, "Content-Type": "application/json", ...(options.prefer ? { Prefer: options.prefer } : {}) })
      }));
      return server;
    }
    const post = (server, { body, headers }) => request(server).post("/api/webhooks/resend").set({ ...headers, "content-type": "application/json" }).send(body);

    beforeEach(() => {
      fake = createFakeSupabase({
        users: {},
        ids: "uuid",
        tables: {
          growth_campaign_sends: [
            { id: crypto.randomUUID(), organization_id: ORG, campaign_id: CAMPAIGN, email: "Ann@example.com", status: "accepted", provider_message_id: MESSAGE },
            { id: crypto.randomUUID(), organization_id: ORG, campaign_id: CAMPAIGN, email: "bob@example.com", status: "failed", provider_message_id: null }
          ],
          growth_email_delivery_events: []
        }
      });
      savedFetch = global.fetch;
      global.fetch = fake.install(savedFetch);
    });
    afterEach(() => { global.fetch = savedFetch; });

    it("records a signed receipt against the send it belongs to, once", async () => {
      const server = app();
      const message = signed(delivered("email.delivered"), { id: "msg_deliveredOnce" });
      const first = await post(server, message);
      assert.equal(first.status, 200, JSON.stringify(first.body));
      assert.equal(first.body.recorded, "delivered");
      const again = await post(server, message);
      assert.equal(again.status, 200);
      const rows = fake.rows("growth_email_delivery_events");
      assert.equal(rows.length, 1, `a resent receipt was recorded ${rows.length} times`);
      assert.equal(rows[0].organization_id, ORG, "the organization did not come from the send");
      assert.equal(rows[0].campaign_id, CAMPAIGN);
      assert.equal(rows[0].email, "Ann@example.com");
      assert.equal(rows[0].provider_event_id, "msg_deliveredOnce");
    });

    it("refuses an unsigned or wrongly signed request before reading anything", async () => {
      const server = app();
      const reads = [];
      const inner = global.fetch;
      global.fetch = async (input, init) => { reads.push(String(input)); return inner(input, init); };
      const good = signed(delivered("email.delivered"));
      const forged = { body: good.body.replace("ann@", "eve@"), headers: good.headers };
      assert.equal((await post(server, forged)).status, 401);
      assert.equal((await post(server, signed(delivered("email.delivered"), { secret: "whsec_" + Buffer.from("somebody-else").toString("base64") }))).status, 401);
      assert.equal((await post(server, signed(delivered("email.delivered"), { timestamp: Math.floor(Date.now() / 1000) - 3600 }))).status, 401);
      assert.equal(reads.filter((url) => url.includes("/rest/v1/")).length, 0, "an unverified request reached the database");
      assert.equal((await post(app({}), good)).status, 503, "an unconfigured secret was not reported as the operator's to fix");
      assert.equal(fake.rows("growth_email_delivery_events").length, 0);
    });

    it("acknowledges a receipt for an email that is not a campaign send, and records nothing", async () => {
      const response = await post(app(), signed(delivered("email.bounced", SECOND)));
      assert.equal(response.status, 200);
      assert.equal(response.body.ignored, "not_a_campaign_email");
      assert.equal(fake.rows("growth_email_delivery_events").length, 0);
    });
  });

  // CodeQL's js/missing-rate-limiting has no model for lib/sonara-rate-limit.cjs,
  // so its alert on this route stays open (SECURITY_NOTES.md). This is what
  // stands in for it: the real limiter on the real route, refusing before the
  // signature is checked or anything is read.
  describe("the rate limit refuses, not merely exists", () => {
    const ENV = { SUPABASE_URL: "https://project.supabase.co", NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-placeholder", SUPABASE_SERVICE_ROLE_KEY: "service-role-placeholder", RESEND_WEBHOOK_SECRET: SECRET };
    let savedEnv;
    let savedFetch;
    let server;
    before(() => {
      savedEnv = Object.fromEntries(Object.keys(ENV).map((key) => [key, process.env[key]]));
      Object.assign(process.env, ENV);
      server = require("../server");
    });
    after(() => {
      for (const [key, value] of Object.entries(savedEnv)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });
    beforeEach(() => { savedFetch = global.fetch; });
    afterEach(() => { global.fetch = savedFetch; });

    it("puts the limiter first, and answers a refused receipt 429 before verifying or reading anything", async () => {
      const layer = server._router.stack.find((candidate) => candidate.route?.path === "/api/webhooks/resend" && candidate.route.methods.post);
      assert.ok(layer, "POST /api/webhooks/resend is not registered; this check has gone blind");
      assert.equal(layer.route.stack[0].handle.name, "rateLimitMiddleware", "something runs before the rate limit");

      const consumed = [];
      const other = [];
      global.fetch = async (input, init = {}) => {
        const url = typeof input === "string" ? input : input.url;
        if (url === `${ENV.SUPABASE_URL}/rest/v1/rpc/sonara_consume_rate_limit`) {
          consumed.push(JSON.parse(init.body));
          const row = { allowed: false, remaining: 0, retry_after_seconds: 42 };
          return { ok: true, status: 200, json: async () => [row], text: async () => JSON.stringify([row]) };
        }
        other.push(url);
        return { ok: false, status: 500, json: async () => ({}), text: async () => "" };
      };
      const { body, headers } = signed(delivered("email.delivered"));
      const response = await request(server).post("/api/webhooks/resend").set({ ...headers, "content-type": "application/json" }).send(body);
      assert.equal(response.status, 429);
      assert.equal(response.headers["retry-after"], "42");
      assert.equal(consumed.length, 1);
      assert.match(consumed[0].p_bucket_key, /^email_receipt_webhook:ip:[0-9a-f]{32}$/);
      assert.deepEqual([consumed[0].p_window_seconds, consumed[0].p_max_attempts], [60, 600]);
      assert.deepEqual(other.filter((url) => url.includes("/rest/v1/")), [], "a refused receipt still read the database");
    });
  });

  describe("the campaign page", () => {
    let fake;
    let savedFetch;
    afterEach(() => { if (savedFetch) global.fetch = savedFetch; savedFetch = null; });

    function start(events) {
      fake = createFakeSupabase({
        users: {},
        ids: "uuid",
        tables: {
          growth_campaigns: [{ id: CAMPAIGN, organization_id: ORG, name: "Spring flyers", goal: "Fill April bookings", channel: "email", status: "active" }],
          growth_campaign_spend: [], growth_conversions: [], growth_leads: [], growth_control_events: [],
          growth_campaign_sends: [
            { organization_id: ORG, campaign_id: CAMPAIGN, email: "a@example.com", status: "accepted", provider_message_id: MESSAGE },
            { organization_id: ORG, campaign_id: CAMPAIGN, email: "b@example.com", status: "accepted", provider_message_id: SECOND },
            { organization_id: ORG, campaign_id: CAMPAIGN, email: "c@example.com", status: "accepted", provider_message_id: null }
          ],
          growth_email_delivery_events: events
        }
      });
      savedFetch = global.fetch;
      global.fetch = fake.install(savedFetch);
      const server = express();
      server.use(express.urlencoded({ extended: false }));
      const signedIn = () => (req, res, next) => { req.sonaraUser = { id: USER }; next(); };
      registerGrowthRoutes(server, {
        layout: ({ heading, sections = [] }) => `<html><h1>${heading}</h1>${sections.join("")}</html>`,
        brandCard: (title, body) => `<article><h2>${title}</h2><p>${body}</p></article>`,
        linkAction: (href, label) => `<a href="${href}">${label}</a>`,
        escapeHtml: (value) => String(value),
        requireWorkspaceAccess: signedIn,
        requirePaidOrOwnerAccess: signedIn,
        getCustomerPrimaryOrganization: async () => ({ ok: true, organizationId: ORG, role: "owner" }),
        getSupabaseServerConfig: () => ({ ok: true, url: fake.url, serviceRoleKey: "service-role" })
      });
      return server;
    }
    const event = (type, message, extra = {}) => ({ id: crypto.randomUUID(), organization_id: ORG, campaign_id: CAMPAIGN, provider_message_id: message, provider_event_id: "msg_" + crypto.randomBytes(4).toString("hex"), event_type: type, bounce_type: null, email: "x@example.com", occurred_at: "2026-10-07T12:00:00Z", ...extra });

    it("counts each email once, against the emails the provider can report on, and says so", async () => {
      const server = start([
        event("delivered", MESSAGE), event("opened", MESSAGE), event("opened", MESSAGE), event("clicked", MESSAGE),
        event("bounced", SECOND, { bounce_type: "permanent" }),
        event("delivered", MESSAGE, { organization_id: OTHER_ORG })
      ]);
      const page = await request(server).get(`/growth-studio/your-campaigns/${CAMPAIGN}`).set("accept", "text/html");
      assert.equal(page.status, 200, page.text.slice(0, 300));
      assert.match(page.text, /What happened to the emails/);
      assert.match(page.text, /for 2 of the 3 emails it accepted that it can report on/, "the page did not say how many emails the provider can report on");
      assert.match(page.text, /<td>Reached the inbox server<\/td><td>1<\/td>/);
      assert.match(page.text, /<td>Opened<\/td><td>1<\/td>/, "two opens of one email were counted as two emails");
      assert.match(page.text, /<td>Bounced<\/td><td>1 \(1 permanently\)<\/td>/);
      assert.match(page.text, /1 email bounced permanently/, "a permanent bounce was not the next step");
    });

    it("puts a spam complaint ahead of everything but new leads and refused sends", async () => {
      const server = start([event("complained", MESSAGE), event("bounced", SECOND, { bounce_type: "permanent" })]);
      const page = await request(server).get(`/growth-studio/your-campaigns/${CAMPAIGN}`).set("accept", "text/html");
      assert.match(page.text, /1 person marked this campaign as spam/);
    });

    it("still works out the return when the receipts cannot be read", async () => {
      const server = start([]);
      const inner = global.fetch;
      global.fetch = async (input, init) => (String(input).includes("growth_email_delivery_events")
        ? { ok: false, status: 404, json: async () => ({ code: "PGRST205" }), text: async () => "" }
        : inner(input, init));
      const page = await request(server).get(`/growth-studio/your-campaigns/${CAMPAIGN}`).set("accept", "text/html");
      assert.equal(page.status, 200);
      assert.doesNotMatch(page.text, /We could not read everything/, "an unreadable receipt table withheld the campaign's return");
      assert.match(page.text, /could not be read just now. This is not the same as there being none/);
    });
  });
});

"use strict";

// A campaign's page counts "people who came in through it" by
// growth_leads.campaign_id, and nothing set that column for somebody who
// arrived by following a campaign: the public chat page wrote every lead with
// no campaign at all. So a campaign that brought in enquiries showed none, and
// its return was worked out against whatever somebody recorded by hand.
//
// The reference rides on the link as ?c=<campaign id>. These tests hold the
// three places it moves -- the email that tags it, the chat page that carries
// it, the lead that is credited -- and the one check that makes it safe: the
// parameter is a claim anybody can edit, so it counts only for a campaign of the
// business that owns the page, and never costs the enquiry when it does not.

const assert = require("node:assert/strict");
const request = require("supertest");
const { createFakeSupabase } = require("./helpers/fake-supabase.cjs");
const links = require("../lib/sonara-campaign-links.cjs");
const { dispatchCampaign } = require("../lib/growth-studio-dispatch.cjs");
const { authoriseCampaign } = require("../lib/growth-studio-sender.cjs");
const express = require("express");
const registerGrowthRoutes = require("../routes/growth-studio-control-routes.cjs");

const ORG = "a1a1a1a1-0000-4000-8000-0000000000c1";
const OTHER_ORG = "b2b2b2b2-0000-4000-8000-0000000000c2";
const CAMPAIGN = "33333333-3333-4333-8333-333333333333";
const OTHER_CAMPAIGN = "44444444-4444-4444-8444-444444444444";
const DELETED_CAMPAIGN = "55555555-5555-4555-8555-555555555555";
const SITE = "https://sonara.example";

function seed() {
  return {
    organizations: [{ id: ORG, name: "Bright Plumbing" }, { id: OTHER_ORG, name: "Somebody Else Ltd" }],
    lead_capture_pages: [
      { id: "lcp-1", organization_id: ORG, slug: "bright-plumbing", enabled: true, headline: "Talk to Bright Plumbing", greeting: "One question.", closing: "We will ring you." }
    ],
    lead_icp_profiles: [],
    lead_routing_rules: [],
    business_employee_profiles: [],
    growth_campaigns: [
      { id: CAMPAIGN, organization_id: ORG, name: "Spring flyers", status: "active" },
      { id: OTHER_CAMPAIGN, organization_id: OTHER_ORG, name: "Not theirs", status: "active" }
    ],
    growth_leads: [],
    lead_conversations: []
  };
}

// Walk the widget to the end the way a browser would: every hidden field on
// the page it was shown goes back with the answer.
async function converse(app, path, contact, { swapCampaignTo } = {}) {
  let page = await request(app).get(path).set("accept", "text/html").redirects(0);
  const hidden = (name) => (String(page.text || "").match(new RegExp(`name="${name}" value="([^"]+)"`)) || [])[1];
  const body = { question: hidden("question"), ...contact };
  if (hidden("campaign")) body.campaign = hidden("campaign");
  if (swapCampaignTo) body.campaign = swapCampaignTo;
  page = await request(app).post(`/chat/bright-plumbing`).type("form").send(body).redirects(0);
  return page;
}

describe("an enquiry is credited to the campaign that brought it", () => {
  describe("the link", () => {
    it("tags this site's chat links and nothing else", () => {
      // The whole message is compared, not searched: a search for a link
      // passes when that text appears anywhere, including inside a longer
      // address that was rewritten around it.
      const untouched = [
        "Or https://sonara.example/chat/bright-plumbing?ref=card, which already has a query",
        "https://elsewhere.example/chat/bright-plumbing is another site",
        "https://elsewhere.example/go?to=https://sonara.example/chat/bright-plumbing is inside another site's address",
        "https://sonara.example/chat/bright-plumbing/extra is a longer path",
        "https://sonara.example/chat/bright-plumbing.html is a longer path too"
      ];
      const body = [
        "Book: https://sonara.example/chat/bright-plumbing.",
        "(https://sonara.example/chat/bright-plumbing)",
        "Quoted on a phone: “https://sonara.example/chat/bright-plumbing”",
        ...untouched
      ].join("\n");
      const tagged = links.tagCampaignLinks(body, { origin: SITE, campaignId: CAMPAIGN });
      assert.equal(tagged, [
        `Book: https://sonara.example/chat/bright-plumbing?c=${CAMPAIGN}.`,
        `(https://sonara.example/chat/bright-plumbing?c=${CAMPAIGN})`,
        `Quoted on a phone: “https://sonara.example/chat/bright-plumbing?c=${CAMPAIGN}”`,
        ...untouched
      ].join("\n"));
      assert.equal(links.tagCampaignLinks(tagged, { origin: SITE, campaignId: CAMPAIGN }), tagged, "tagging twice changed the message");
      assert.equal(links.tagCampaignLinks(body, { origin: "http://sonara.example", campaignId: CAMPAIGN }), body, "an http origin was trusted");
      assert.equal(links.campaignFromValue("not-a-campaign"), null);
    });

    it("goes out tagged in the email a campaign sends", async () => {
      const decision = authoriseCampaign({
        approval: { status: "approved", approved_by: "owner-1" },
        recipients: [{ id: "66666666-6666-4666-8666-000000000001", email: "ann@example.com", consent: { channel: "email", consent_status: "granted" } }],
        history: { ok: true, rows: [{ entry_kind: "grant", amount_minor: 1000000 }] }
      });
      const sent = [];
      const ENV = { RESEND_API_KEY: "re_test", RESEND_FROM_EMAIL: "hello@example.com", SUPABASE_SERVICE_ROLE_KEY: "service-role-key-for-signing" };
      const result = await dispatchCampaign({
        decision, subject: "Spring", body: `Tell us what you need: ${SITE}/chat/bright-plumbing`,
        organizationId: ORG, campaignId: CAMPAIGN, origin: SITE,
        getEnv: (name) => ENV[name], getReadiness: () => ({ services: { emailDelivery: "enabled" } }),
        appendLedger: async () => ({ ok: true }), recordSends: async () => ({ ok: true }),
        fetchImpl: async (url, options) => {
          const body = JSON.parse(options.body);
          const batch = Array.isArray(body) ? body : [body];
          sent.push(...batch);
          return { ok: true, status: 200, json: async () => (Array.isArray(body) ? { data: batch.map((unused, index) => ({ id: `id-${index}` })) } : { id: "id-single" }) };
        }
      });
      assert.equal(result.sent, 1, JSON.stringify(result));
      assert.ok(sent[0].text.includes(`${SITE}/chat/bright-plumbing?c=${CAMPAIGN}`), "the email went out with an untagged chat link");
    });
  });

  describe("the campaign page", () => {
    let fake;
    let savedFetch;
    afterEach(() => { if (savedFetch) global.fetch = savedFetch; savedFetch = null; });
    function pageApp(chatPages, env = { NEXT_PUBLIC_SITE_URL: SITE }) {
      fake = createFakeSupabase({
        users: {}, ids: "uuid",
        tables: {
          growth_campaigns: [{ id: CAMPAIGN, organization_id: ORG, name: "Spring flyers", goal: "Fill April", channel: "print", status: "active" }],
          growth_campaign_spend: [], growth_conversions: [], growth_leads: [], growth_campaign_sends: [], growth_email_delivery_events: [], growth_control_events: [],
          lead_capture_pages: chatPages
        }
      });
      savedFetch = global.fetch;
      global.fetch = fake.install(savedFetch);
      const app = express();
      const signedIn = () => (req, res, next) => { req.sonaraUser = { id: "22222222-2222-4222-8222-222222222222" }; next(); };
      registerGrowthRoutes(app, {
        layout: ({ heading, sections = [] }) => `<html><h1>${heading}</h1>${sections.join("")}</html>`,
        brandCard: (title, body) => `<article><h2>${title}</h2><p>${body}</p></article>`,
        linkAction: (href, label) => `<a href="${href}">${label}</a>`,
        escapeHtml: (value) => String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char])),
        requireWorkspaceAccess: signedIn,
        requirePaidOrOwnerAccess: signedIn,
        getEnv: (name) => env[name],
        getCustomerPrimaryOrganization: async () => ({ ok: true, organizationId: ORG, role: "owner" }),
        getSupabaseServerConfig: () => ({ ok: true, url: fake.url, serviceRoleKey: "service-role" })
      });
      return app;
    }
    const open = (app) => request(app).get(`/growth-studio/your-campaigns/${CAMPAIGN}`).set("accept", "text/html");

    it("shows the link that credits an enquiry to this campaign, with a code for print", async () => {
      const page = await open(pageApp([{ id: "lcp-1", organization_id: ORG, slug: "bright-plumbing", enabled: true }]));
      assert.equal(page.status, 200, page.text.slice(0, 300));
      assert.ok(page.text.includes(`${SITE}/chat/bright-plumbing?c=${CAMPAIGN}`), "the campaign page does not show its tracked link");
      assert.match(page.text, /class="sonara-qr"><svg/, "there is no code to print the link with");
    });

    it("says what to do when there is no chat page, or it is off, or no https address is known", async () => {
      assert.match((await open(pageApp([]))).text, /Set up your chat page/);
      assert.match((await open(pageApp([{ id: "lcp-1", organization_id: ORG, slug: "bright-plumbing", enabled: false }]))).text, /Switch on your chat page/);
      const noOrigin = await open(pageApp([{ id: "lcp-1", organization_id: ORG, slug: "bright-plumbing", enabled: true }], {}));
      assert.match(noOrigin.text, /https address is not known here/, "a link was built from a guessed or insecure address");
      assert.ok(!noOrigin.text.includes("?c="), "a campaign link was shown with no https address to put in front of it");
    });
  });

  describe("the chat page and the lead", () => {
    let app;
    let fake;
    let savedFetch;
    let savedEnv;
    const KEYS = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];

    before(() => {
      savedEnv = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-placeholder";
      process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-placeholder";
      app = require("../server");
    });
    after(() => {
      for (const [key, value] of Object.entries(savedEnv)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });
    // A fresh database per case, seeded rather than edited: fake.rows() hands
    // back a copy, so changing what it returns changes nothing underneath.
    function start(adjust = (tables) => tables) {
      if (savedFetch) global.fetch = savedFetch;
      fake = createFakeSupabase({ users: {}, tables: adjust(seed()) });
      savedFetch = global.fetch;
      global.fetch = fake.install(savedFetch);
    }
    beforeEach(() => { savedFetch = null; start(); });
    afterEach(() => { if (savedFetch) global.fetch = savedFetch; savedFetch = null; });

    const lead = () => {
      const rows = fake.rows("growth_leads");
      assert.equal(rows.length, 1, `expected one lead, found ${rows.length}: the enquiry was lost or doubled`);
      return rows[0];
    };

    it("credits the lead to the business's own campaign named in the link", async () => {
      const page = await request(app).get(`/chat/bright-plumbing?c=${CAMPAIGN}`).set("accept", "text/html");
      assert.ok(page.text.includes(`name="campaign" value="${CAMPAIGN}"`), "the chat page dropped the campaign the link named");
      await converse(app, `/chat/bright-plumbing?c=${CAMPAIGN}`, { name: "Rita Shaw", email: "rita@example.com" });
      assert.equal(lead().campaign_id, CAMPAIGN, "an enquiry from a campaign link was not credited to the campaign");
      assert.equal(lead().organization_id, ORG);
    });

    it("credits nothing for another business's campaign, a deleted one or nonsense, and still keeps the enquiry", async () => {
      for (const claim of [OTHER_CAMPAIGN, DELETED_CAMPAIGN]) {
        start();
        await converse(app, `/chat/bright-plumbing?c=${claim}`, { name: "Sam", email: "sam@example.com" });
        assert.equal(lead().campaign_id, null, `a lead was credited to ${claim}, which is not this business's campaign`);
      }
      start();
      const page = await request(app).get("/chat/bright-plumbing?c=1%27%20or%201=1").set("accept", "text/html");
      assert.ok(!page.text.includes('name="campaign"'), "a malformed campaign reached the form");
      await converse(app, "/chat/bright-plumbing?c=garbage", { name: "Sam", email: "sam@example.com" });
      assert.equal(lead().campaign_id, null);
    });

    it("keeps the campaign the conversation started with", async () => {
      // Two questions: the claim is fixed on the first answer, and a later form
      // naming another campaign changes nothing.
      start((tables) => ({
        ...tables,
        lead_icp_profiles: [{
          id: "icp-1", organization_id: ORG, industries: ["plumbing", "heating"], regions: [],
          team_size_min: null, team_size_max: null, budget_min_cents: null, budget_max_cents: null,
          timeline_days: null, disqualifiers: [], fit_weight: 40, urgency_weight: 25, engagement_weight: 20, risk_weight: 15
        }],
        growth_campaigns: [...tables.growth_campaigns, { id: DELETED_CAMPAIGN, organization_id: ORG, name: "Also ours", status: "active" }]
      }));
      const first = await converse(app, `/chat/bright-plumbing?c=${CAMPAIGN}`, { answer: "plumbing" });
      const token = (String(first.text).match(/name="token" value="([A-Za-z0-9_-]{32})"/) || [])[1];
      assert.ok(token, "the first answer did not start a conversation");
      assert.ok(!first.text.includes('name="campaign"'), "the campaign was still on the form after the conversation began");
      const question = (String(first.text).match(/name="question" value="([^"]+)"/) || [])[1];
      await request(app).post("/chat/bright-plumbing").type("form").send({ question, token, campaign: DELETED_CAMPAIGN, name: "Rita", email: "rita@example.com" });
      assert.equal(lead().campaign_id, CAMPAIGN, "a later form changed which campaign the enquiry was credited to");
    });
  });
});

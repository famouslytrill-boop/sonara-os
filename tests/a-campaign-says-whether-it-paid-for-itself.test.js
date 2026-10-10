"use strict";

// Growth Studio recorded who a campaign reached and which conversions were
// attributed to it, and nothing about what it cost -- so "did it pay for
// itself" and "what next" could not be answered for anybody. These tests drive
// a campaign's own page: record what it cost from the page's form, and check
// what the page then says about its return and the next step.

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const express = require("express");
const request = require("supertest");
const { createFakeSupabase } = require("./helpers/fake-supabase.cjs");
const registerRoutes = require("../routes/growth-studio-control-routes.cjs");
const { summarizeCampaign, parseAmountCents } = require("../lib/sonara-campaign-results.cjs");

const ORG = "11111111-1111-4111-8111-111111111111";
const OTHER_ORG = "99999999-9999-4999-8999-999999999999";
const USER = "22222222-2222-4222-8222-222222222222";
const CAMPAIGN = "33333333-3333-4333-8333-333333333333";
const ELSEWHERE = "44444444-4444-4444-8444-444444444444";
const PAGE = `/growth-studio/your-campaigns/${CAMPAIGN}`;

function buildApp(fake) {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  const signedIn = () => (req, res, next) => { req.sonaraUser = { id: USER, email: "owner@example.com" }; next(); };
  registerRoutes(app, {
    layout: ({ heading, body, sections = [] }) => `<html><h1>${heading}</h1><p>${body}</p>${sections.join("")}</html>`,
    brandCard: (title, body) => `<article><h2>${title}</h2><p>${body}</p></article>`,
    linkAction: (href, label) => `<a href="${href}">${label}</a>`,
    escapeHtml: (value) => String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char])),
    requireWorkspaceAccess: signedIn,
    requirePaidOrOwnerAccess: signedIn,
    getCustomerPrimaryOrganization: async () => ({ ok: true, organizationId: ORG, role: "owner" }),
    getSupabaseServerConfig: () => ({ ok: true, url: fake.url, serviceRoleKey: "service-role" })
  });
  return app;
}

function tables(extra = {}) {
  return {
    growth_campaigns: [
      { id: CAMPAIGN, organization_id: ORG, name: "Spring flyers", goal: "Fill April bookings", channel: "print", status: "active", created_at: "2026-09-01T00:00:00Z" },
      { id: ELSEWHERE, organization_id: OTHER_ORG, name: "Not yours", status: "active" }
    ],
    growth_campaign_spend: [],
    growth_conversions: [],
    growth_leads: [],
    growth_campaign_sends: [],
    growth_control_events: [],
    ...extra
  };
}

describe("a campaign says whether it paid for itself", () => {
  let fake;
  let savedFetch;
  function start(seed) {
    fake = createFakeSupabase({ users: {}, tables: seed, ids: "uuid" });
    savedFetch = global.fetch;
    global.fetch = fake.install(savedFetch);
    return buildApp(fake);
  }
  afterEach(() => {
    if (savedFetch) global.fetch = savedFetch;
    savedFetch = null;
  });

  it("bounds Growth's nine campaign count reads, keeps tenant scope, and labels a failed count unknown", async () => {
    const app = start(tables());
    const installed = global.fetch;
    let active = 0;
    let maxActive = 0;
    let countRequests = 0;
    const organizationFilter = `organization_id=eq.${encodeURIComponent(ORG)}`;
    global.fetch = async (input, init = {}) => {
      if (init.headers?.Prefer !== "count=exact") return installed(input, init);
      countRequests += 1;
      active += 1;
      maxActive = Math.max(maxActive, active);
      try {
        const url = String(typeof input === "string" ? input : input?.url);
        assert.ok(url.includes(organizationFilter), "the Growth report removed its tenant filter");
        await new Promise((resolve) => setTimeout(resolve, 2));
        if (url.includes("growth_experiments?")) {
          return { ok: false, status: 503, headers: { get: () => null }, json: async () => ({}) };
        }
        return installed(input, init);
      } finally {
        active -= 1;
      }
    };
    const result = await request(app).get("/api/growth/metrics").set("Accept", "application/json");
    assert.equal(result.status, 200);
    assert.equal(countRequests, 9);
    assert.ok(maxActive > 1, "counting must not serialize nine independent queries");
    assert.ok(maxActive <= 3, "Growth exceeded the three-read concurrent budget");
    assert.equal(active, 0);
    assert.equal(result.body.scope.organizationId, ORG);
    assert.equal(result.body.totals.experiments, null, "a failed count was turned into an invented zero");
    assert.equal(result.body.countsRead.readable, 8);
  });

  it("links each campaign to its page, and records spend from that page's form", async () => {
    const app = start(tables());
    const list = await request(app).get("/growth-studio/your-campaigns").set("accept", "text/html");
    assert.ok(list.text.includes(`href="${PAGE}"`), "the campaign list has no way to open a campaign");

    const before = await request(app).get(PAGE).set("accept", "text/html");
    assert.equal(before.status, 200, before.text.slice(0, 300));
    assert.ok(before.text.includes(`action="${PAGE}/spend"`), "the page has no way to record what the campaign cost");
    assert.match(before.text, /Nothing is recorded against this campaign yet/);

    const recorded = await request(app).post(`${PAGE}/spend`).type("form").send({ kind: "spend", amount: "120.50", currency: "GBP", spent_on: "2026-09-10", description: "Printed flyers", reference: "INV-77" });
    assert.equal(recorded.status, 303);
    assert.equal(recorded.headers.location, `${PAGE}?done=spend`);
    const [row] = fake.rows("growth_campaign_spend");
    assert.equal(row.organization_id, ORG);
    assert.equal(row.campaign_id, CAMPAIGN);
    assert.equal(row.amount_cents, 12050);
    assert.equal(row.currency, "gbp");
    assert.equal(row.recorded_by, USER);
    assert.equal(row.source, "owner");

    const after = await request(app).get(`${PAGE}?done=spend`).set("accept", "text/html");
    assert.match(after.text, /Printed flyers/);
    assert.match(after.text, /GBP 120\.50/);
    assert.match(after.text, /no results with a value against it/, "spend with no results was not called out as the next step");
    assert.doesNotMatch(after.text, /-100%/, "spend with no recorded results was presented as a total loss");
  });

  it("works out a return per currency, and never across them", async () => {
    const app = start(tables({
      growth_campaign_spend: [
        { id: crypto.randomUUID(), organization_id: ORG, campaign_id: CAMPAIGN, kind: "spend", amount_cents: 10000, currency: "gbp", spent_on: "2026-09-02", description: "Flyers" },
        { id: crypto.randomUUID(), organization_id: ORG, campaign_id: CAMPAIGN, kind: "spend", amount_cents: 5000, currency: "usd", spent_on: "2026-09-03", description: "Boosted post" },
        { id: crypto.randomUUID(), organization_id: OTHER_ORG, campaign_id: ELSEWHERE, kind: "spend", amount_cents: 999999, currency: "gbp", spent_on: "2026-09-03", description: "Not yours" }
      ],
      growth_conversions: [
        { id: crypto.randomUUID(), organization_id: ORG, campaign_id: CAMPAIGN, value: 250, currency: "gbp", attribution_confidence: "medium", occurred_at: "2026-09-05T00:00:00Z" },
        { id: crypto.randomUUID(), organization_id: ORG, campaign_id: CAMPAIGN, value: 20, currency: "usd", attribution_confidence: "low", occurred_at: "2026-09-06T00:00:00Z" },
        { id: crypto.randomUUID(), organization_id: ORG, campaign_id: CAMPAIGN, value: null, currency: "gbp", attribution_confidence: "unknown", occurred_at: "2026-09-07T00:00:00Z" }
      ]
    }));
    const shown = await request(app).get(PAGE).set("accept", "text/html");
    assert.match(shown.text, /GBP 150\.00/, "the pound return (250 - 100) is not shown");
    assert.match(shown.text, /150%/, "the pound return ratio is not shown");
    assert.match(shown.text, /USD -30\.00/, "the dollar loss (20 - 50) is not shown");
    assert.match(shown.text, /-60%/);
    assert.match(shown.text, /not added together/);
    assert.match(shown.text, /1 conversion\(s\) have no value recorded/);
    assert.doesNotMatch(shown.text, /9999\.99|Not yours/, "another workspace's spend was counted");
    assert.match(shown.text, /returned less than it cost/, "a loss in one currency did not set the next step");
  });

  it("puts people waiting to hear back before money", () => {
    const summary = summarizeCampaign({
      spend: { ok: true, rows: [{ amount_cents: 100, currency: "usd" }] },
      conversions: { ok: true, rows: [] },
      leads: { ok: true, rows: [{ status: "new" }, { status: "new" }, { status: "won" }] },
      sends: { ok: true, rows: [] }
    });
    assert.equal(summary.nextStep.key, "contact_new_leads");
    assert.match(summary.nextStep.text, /^2 people who came in/);
  });

  it("refuses an amount it would have to guess at, and a negative spend", async () => {
    assert.equal(parseAmountCents("1,200"), null);
    assert.equal(parseAmountCents("-5"), null);
    assert.equal(parseAmountCents("-5", { allowNegative: true }), -500);
    assert.equal(parseAmountCents("12.5"), 1250);
    const app = start(tables());
    for (const [fields, problem] of [
      [{ kind: "spend", amount: "-20", currency: "usd", spent_on: "2026-09-10", description: "x" }, "amount_invalid"],
      [{ kind: "spend", amount: "20", currency: "dollars", spent_on: "2026-09-10", description: "x" }, "currency_invalid"],
      [{ kind: "spend", amount: "20", currency: "usd", spent_on: "2999-01-01", description: "x" }, "date_invalid"],
      [{ kind: "spend", amount: "20", currency: "usd", spent_on: "2026-09-10", description: " " }, "description_required"]
    ]) {
      const refused = await request(app).post(`${PAGE}/spend`).type("form").send(fields);
      assert.equal(refused.headers.location, `${PAGE}?problem=${problem}`);
    }
    assert.equal(fake.rows("growth_campaign_spend").length, 0, "a refused amount was recorded");
    const correction = await request(app).post(`${PAGE}/spend`).type("form").send({ kind: "correction", amount: "-20", currency: "usd", spent_on: "2026-09-10", description: "Refund from printer" });
    assert.equal(correction.headers.location, `${PAGE}?done=spend`);
    assert.equal(fake.rows("growth_campaign_spend")[0].amount_cents, -2000);
  });

  it("will not show or record spend against another workspace's campaign", async () => {
    const app = start(tables());
    const opened = await request(app).get(`/growth-studio/your-campaigns/${ELSEWHERE}`).set("accept", "text/html");
    assert.equal(opened.status, 404);
    const posted = await request(app).post(`/growth-studio/your-campaigns/${ELSEWHERE}/spend`).type("form").send({ kind: "spend", amount: "5", currency: "usd", spent_on: "2026-09-10", description: "x" });
    assert.equal(posted.headers.location, "/growth-studio/your-campaigns?problem=not_found");
    assert.equal(fake.rows("growth_campaign_spend").length, 0);
  });

  it("works out no return when a read failed, and says so", async () => {
    const app = start(tables({ growth_campaign_spend: [{ id: crypto.randomUUID(), organization_id: ORG, campaign_id: CAMPAIGN, kind: "spend", amount_cents: 100, currency: "usd", spent_on: "2026-09-02", description: "x" }] }));
    const installed = global.fetch;
    global.fetch = async (input, init = {}) => {
      if (String(typeof input === "string" ? input : input?.url).includes("/rest/v1/growth_conversions?")) return { ok: false, status: 500, headers: { get: () => null }, json: async () => ({}) };
      return installed(input, init);
    };
    const shown = await request(app).get(PAGE).set("accept", "text/html");
    assert.match(shown.text, /could not read its results/);
    assert.doesNotMatch(shown.text, /Did it pay for itself/, "a return was presented beside a failed read");
    assert.match(shown.text, /no suggestion is made/);
  });
});

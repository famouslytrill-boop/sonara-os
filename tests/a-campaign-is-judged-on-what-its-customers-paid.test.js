"use strict";

// A campaign's return was worked out from conversions typed in by hand, while
// the same business invoiced the customers its campaigns found and recorded
// what they paid. Three columns already said which campaign found whom --
// growth_leads.campaign_id, growth_leads.customer_id, and the customer's
// invoices -- and nothing joined them. These tests drive a campaign's page and
// hold the rules that keep the joined figure from claiming more than happened:
// the first campaign wins, only money paid since the person came in counts,
// currencies stay apart, corrections subtract, another workspace's rows never
// count, and the hand-recorded results are shown beside it, never added to it.

const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const { createFakeSupabase } = require("./helpers/fake-supabase.cjs");
const registerRoutes = require("../routes/growth-studio-control-routes.cjs");
const { summarizeCampaign } = require("../lib/sonara-campaign-results.cjs");
const { summarizeCampaignPayments } = require("../lib/sonara-campaign-payments.cjs");
const pages = require("../lib/sonara-campaign-results-pages.cjs");

const ORG = "11111111-1111-4111-8111-111111111111";
const OTHER_ORG = "99999999-9999-4999-8999-999999999999";
const USER = "22222222-2222-4222-8222-222222222222";
const CAMPAIGN = "33333333-3333-4333-8333-333333333333";
const EARLIER = "30000000-0000-4000-8000-000000000001";

const id = (n) => `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ANN = id(1);   // came in through this campaign and was made a customer
const BOB = id(2);   // already a customer; came in again through this campaign
const CAT = id(3);   // came in through an earlier campaign first
const DAN = id(4);   // came in through this campaign; invoiced in dollars, not paid
const INV = { annPaid: id(11), annOpen: id(12), bobOld: id(13), bobNew: id(14), catPaid: id(15), danOpen: id(16), bobOldOpen: id(18) };

const escapeHtml = (value) => String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));

function buildApp(fake) {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  const signedIn = () => (req, res, next) => { req.sonaraUser = { id: USER, email: "owner@example.com" }; next(); };
  registerRoutes(app, {
    layout: ({ heading, body, sections = [] }) => `<html><h1>${heading}</h1><p>${body}</p>${sections.join("")}</html>`,
    brandCard: (title, body) => `<article><h2>${title}</h2><p>${body}</p></article>`,
    linkAction: (href, label) => `<a href="${href}">${label}</a>`,
    escapeHtml,
    requireWorkspaceAccess: signedIn,
    requirePaidOrOwnerAccess: signedIn,
    getCustomerPrimaryOrganization: async () => ({ ok: true, organizationId: ORG, role: "owner" }),
    getSupabaseServerConfig: () => ({ ok: true, url: fake.url, serviceRoleKey: "service-role" })
  });
  return app;
}

const lead = (n, campaignId, customerId, createdAt, status = "won") => ({ id: id(100 + n), organization_id: ORG, campaign_id: campaignId, customer_id: customerId, created_at: createdAt, status, name: `Lead ${n}` });
const invoice = (invoiceId, customerId, currency, totalCents, status, issuedOn, organizationId = ORG) => ({ id: invoiceId, organization_id: organizationId, customer_id: customerId, currency, total_cents: totalCents, status, issued_on: issuedOn, created_at: `${issuedOn}T09:00:00Z` });
const payment = (n, invoiceId, amountCents, receivedOn, organizationId = ORG) => ({ id: id(200 + n), organization_id: organizationId, invoice_id: invoiceId, amount_cents: amountCents, received_on: receivedOn });

function seed() {
  return {
    growth_campaigns: [
      { id: CAMPAIGN, organization_id: ORG, name: "Spring flyers", status: "active" },
      { id: EARLIER, organization_id: ORG, name: "Summer fair", status: "completed" }
    ],
    growth_campaign_spend: [
      { id: id(301), organization_id: ORG, campaign_id: CAMPAIGN, kind: "spend", amount_cents: 20000, currency: "gbp", spent_on: "2026-09-01", description: "Flyers" },
      { id: id(302), organization_id: ORG, campaign_id: CAMPAIGN, kind: "spend", amount_cents: 5000, currency: "usd", spent_on: "2026-09-01", description: "Boosted post" }
    ],
    // One hand-recorded result: shown beside the payments, never added to them.
    growth_conversions: [
      { id: id(401), organization_id: ORG, campaign_id: CAMPAIGN, value: 100, currency: "gbp", attribution_confidence: "low", occurred_at: "2026-09-12T00:00:00Z" }
    ],
    growth_leads: [
      lead(1, CAMPAIGN, ANN, "2026-09-05T10:00:00Z"),
      lead(2, CAMPAIGN, BOB, "2026-09-15T10:00:00Z"),
      lead(3, EARLIER, CAT, "2026-08-20T10:00:00Z"),
      lead(4, CAMPAIGN, CAT, "2026-09-06T10:00:00Z"),
      lead(5, CAMPAIGN, DAN, "2026-09-07T10:00:00Z"),
      lead(6, CAMPAIGN, null, "2026-09-08T10:00:00Z", "contacted")
    ],
    customer_invoices: [
      invoice(INV.annPaid, ANN, "gbp", 30000, "paid", "2026-09-10"),
      invoice(INV.annOpen, ANN, "gbp", 20000, "sent", "2026-09-20"),
      invoice(INV.bobOld, BOB, "gbp", 10000, "paid", "2026-08-01"),
      invoice(INV.bobNew, BOB, "gbp", 8000, "paid", "2026-09-20"),
      invoice(INV.bobOldOpen, BOB, "gbp", 5000, "sent", "2026-07-01"), // owed from before this campaign found him
      invoice(INV.catPaid, CAT, "gbp", 50000, "paid", "2026-09-01"),
      invoice(INV.danOpen, DAN, "usd", 12000, "sent", "2026-09-18")
    ],
    customer_invoice_payments: [
      payment(1, INV.annPaid, 30000, "2026-09-12"),
      payment(2, INV.annOpen, 5000, "2026-09-25"),
      payment(3, INV.bobOld, 10000, "2026-08-03"), // before Bob came in through this campaign
      payment(4, INV.bobNew, 8000, "2026-09-21"),
      payment(5, INV.bobNew, -1000, "2026-09-22"), // a correction subtracts
      payment(6, INV.catPaid, 50000, "2026-09-02"),
      payment(7, INV.annPaid, 999999, "2026-09-13", OTHER_ORG) // another workspace's row
    ],
    growth_campaign_sends: [],
    growth_email_delivery_events: [],
    lead_capture_pages: [],
    growth_control_events: []
  };
}

describe("a campaign is judged on what its customers paid", () => {
  let fake;
  let savedFetch;
  function start(tables = seed()) {
    fake = createFakeSupabase({ users: {}, tables, ids: "uuid" });
    savedFetch = global.fetch;
    global.fetch = fake.install(savedFetch);
    return buildApp(fake);
  }
  afterEach(() => {
    if (savedFetch) global.fetch = savedFetch;
    savedFetch = null;
  });
  const open = (app, campaignId = CAMPAIGN) => request(app).get(`/growth-studio/your-campaigns/${campaignId}`).set("accept", "text/html");
  const card = (html) => (String(html).match(/<article class="card"[^>]*><h2>What the customers it brought in have paid<\/h2>[\s\S]*?<\/article>/) || [""])[0];

  it("shows what the customers it found have paid since they came in, beside what it cost", async () => {
    const page = await open(start());
    assert.equal(page.status, 200, page.text.slice(0, 300));
    const paid = card(page.text);
    assert.ok(paid, "the page has no card for what the customers paid");
    // Ann 300.00 + 50.00, Bob 80.00 - 10.00: 420.00 in four payments.
    assert.match(paid, /<td>GBP<\/td><td>GBP 420\.00 \(4\)<\/td>/, "the pounds paid since they came in are wrong");
    assert.match(paid, /<td>GBP 150\.00 \(1\)<\/td>/, "what is still owed on Ann's sent invoice is not shown, or an invoice from before Bob came in was added to it");
    assert.match(paid, /<td>GBP 200\.00<\/td><td>110%<\/td>/, "the return on what they paid (420 - 200 over 200) is not shown");
    assert.match(paid, /<td>USD<\/td><td>USD 0\.00 \(0\)<\/td><td>USD 120\.00 \(1\)<\/td><td>USD 50\.00<\/td><td>Spend is recorded, and nothing paid yet\.<\/td>/, "dollars were not kept apart, or an unpaid currency was shown as a loss");
    assert.match(paid, /3 customers came in through this campaign/);
    assert.match(paid, /1 customer came in through another campaign first/, "the customer another campaign found first was not named as counted there");
    assert.match(paid, /1 payment\(s\) from before they came in/, "Bob's payment from before this campaign was not set aside");
    assert.doesNotMatch(paid, /9999\.99|10419|10 419/, "another workspace's payment was counted");
    assert.doesNotMatch(paid, /GBP 920\.00|GBP 520\.00/, "a payment from before they came in, or another campaign's customer, was counted");
    assert.match(paid, /not added to the recorded results above/);
    // The recorded basis is unchanged and separate: 100.00 against 200.00.
    assert.match(page.text, /<td>GBP 100\.00 \(1\)<\/td><td>GBP -100\.00<\/td><td>-50%<\/td>/, "the recorded results were changed or summed with the payments");
    // The next step rests on what was paid, not on what was typed in.
    assert.match(page.text, /On what the customers it brought in have paid, this campaign has paid for itself/);
    assert.doesNotMatch(page.text, /On what is recorded, this campaign has returned less than it cost/, "the next step followed the hand-recorded results over the payments");
  });

  it("counts a customer under the campaign that found them first, and only that one", async () => {
    const page = await open(start(), EARLIER);
    const paid = card(page.text);
    assert.match(paid, /<td>GBP<\/td><td>GBP 500\.00 \(1\)<\/td>/, "the earlier campaign does not have Cat's payment");
    assert.match(paid, /1 customer came in through this campaign/);
    assert.doesNotMatch(paid, /GBP 420\.00|GBP 350\.00/, "a later campaign's customers were counted under the earlier one");
  });

  it("still works out the recorded return, and says so, when the invoices cannot be read", async () => {
    const app = start();
    const installed = global.fetch;
    global.fetch = async (input, init = {}) => {
      if (String(typeof input === "string" ? input : input?.url).includes("/rest/v1/customer_invoices?")) return { ok: false, status: 500, headers: { get: () => null }, json: async () => ({}) };
      return installed(input, init);
    };
    const page = await open(app);
    assert.equal(page.status, 200);
    assert.match(card(page.text), /could not be read in full just now/);
    assert.doesNotMatch(card(page.text), /<table>/, "figures were shown from a failed read");
    assert.match(page.text, /<td>-50%<\/td>/, "a failed invoice read withheld the recorded return");
    assert.match(page.text, /On what is recorded, this campaign has returned less than it cost/, "the next step did not fall back to the recorded results");
  });

  it("reads a bounded number of invoices, and counts as owed only those whose payments it read", async () => {
    const tables = seed();
    const many = Array.from({ length: 101 }, (unused, n) => `cccccccc-0000-4000-8000-${String(n).padStart(12, "0")}`);
    tables.growth_leads = many.map((customerId, n) => ({ ...lead(500 + n, CAMPAIGN, customerId, "2026-09-02T10:00:00Z"), id: `dddddddd-0000-4000-8000-${String(n).padStart(12, "0")}` }));
    tables.customer_invoices = many.flatMap((customerId, n) => Array.from({ length: 10 }, (unused, k) => invoice(`eeeeeeee-0000-4000-8000-${String(n * 10 + k).padStart(12, "0")}`, customerId, "gbp", 100, "sent", "2026-09-03")));
    tables.customer_invoice_payments = [];
    const paid = card((await open(start(tables))).text);
    assert.match(paid, /GBP 1000\.00 \(1000\)/, "an invoice whose payments were not read was counted as wholly owed");
    assert.match(paid, /Not worked out: more records than we read at once/);
    assert.match(paid, /no return is worked out from part of them/);
  });

  it("says plainly when nobody it brought in has become a customer", async () => {
    const tables = seed();
    tables.growth_leads = tables.growth_leads.map((row) => ({ ...row, customer_id: null }));
    const page = await open(start(tables));
    assert.match(card(page.text), /Nobody who came in through this campaign has been made a customer yet/);
  });

  describe("the rules", () => {
    const ok = (rows, extra = {}) => ({ ok: true, rows, ...extra });
    const base = () => {
      const s = seed();
      return {
        campaignId: CAMPAIGN,
        leads: ok(s.growth_leads.filter((row) => row.campaign_id === CAMPAIGN)),
        customerLeads: ok(s.growth_leads.filter((row) => row.customer_id)),
        invoices: ok(s.customer_invoices),
        payments: ok(s.customer_invoice_payments.filter((row) => row.organization_id === ORG))
      };
    };

    it("gives a customer found by two campaigns at the same moment to exactly one of them", () => {
      const at = "2026-09-05T10:00:00Z";
      const leads = [lead(1, CAMPAIGN, ANN, at), lead(2, EARLIER, ANN, at)];
      const input = { leads: ok(leads), customerLeads: ok(leads), invoices: ok([]), payments: ok([]) };
      const here = summarizeCampaignPayments({ ...input, campaignId: CAMPAIGN, leads: ok([leads[0]]) });
      const there = summarizeCampaignPayments({ ...input, campaignId: EARLIER, leads: ok([leads[1]]) });
      assert.equal(here.customers + there.customers, 1, "both campaigns, or neither, claimed the customer");
      assert.equal(here.countedElsewhere + there.countedElsewhere, 1);
    });

    it("withholds the whole figure when it cannot be sure which campaign was first", () => {
      assert.equal(summarizeCampaignPayments({ ...base(), customerLeads: ok(base().customerLeads.rows, { truncated: true }) }).unreadable, true);
      assert.equal(summarizeCampaignPayments({ ...base(), payments: { ok: false, rows: [] } }).unreadable, true);
      const undated = base();
      undated.customerLeads.rows.push({ customer_id: ANN, campaign_id: EARLIER, created_at: "not a date" });
      const result = summarizeCampaignPayments(undated);
      assert.equal(result.unreadableCustomers, 1, "a customer whose first campaign cannot be decided was counted");
    });

    it("counts a row it cannot read apart, and never as nothing", () => {
      const input = base();
      input.payments.rows.push(payment(8, INV.annPaid, "a lot", "2026-09-30"));
      input.invoices.rows.push(invoice(id(17), ANN, "", 4000, "paid", "2026-09-26"));
      input.payments.rows.push(payment(9, id(17), 4000, "2026-09-27"));
      const result = summarizeCampaignPayments(input);
      assert.equal(result.unreadableRows.payments, 2);
      assert.equal(result.byCurrency.find((line) => line.currency === "gbp").receivedCents, 42000, "an unreadable row was added to the total");
    });

    it("asks for unpaid invoices to be collected before judging a campaign that is behind", () => {
      const s = seed();
      const summary = summarizeCampaign({
        spend: ok([{ amount_cents: 100000, currency: "gbp" }]),
        conversions: ok([]),
        leads: ok(s.growth_leads.filter((row) => row.campaign_id === CAMPAIGN)),
        sends: ok([]),
        paid: base()
      });
      assert.equal(summary.nextStep.key, "collect_unpaid");
      assert.equal(summary.nextStep.basis, "payments");
      assert.match(summary.nextStep.text, /1 of their invoices is still unpaid/);
    });

    it("works out no return from records it could not read in full, in either direction", () => {
      const summary = summarizeCampaign({
        spend: ok([{ amount_cents: 1000, currency: "gbp" }], { truncated: true }),
        conversions: ok([{ value: 50, currency: "gbp" }]),
        leads: ok([]),
        sends: ok([])
      });
      const [line] = summary.byCurrency;
      // A cut-short spend read made the return look better than it was: more
      // spend means less return, and it was labelled "at least".
      assert.equal(line.returnRatio, null, "a return was worked out from spend that was not all read");
      assert.equal(line.returnReason, "incomplete");
      assert.equal(summary.nextStep.key, "too_many_records");
      const html = pages.returnCard(summary, escapeHtml);
      assert.doesNotMatch(html, /At least/i, "a cut-short read was presented as a lower bound");
      assert.match(html, /no return is worked out from part of them/);

      const paidCut = summarizeCampaign({
        spend: ok([{ amount_cents: 20000, currency: "gbp" }]),
        conversions: ok([]),
        leads: base().leads,
        sends: ok([]),
        paid: { ...base(), payments: ok(base().payments.rows, { truncated: true }) }
      });
      assert.ok(paidCut.paid.byCurrency.every((entry) => entry.returnRatio === null), "a return on payments was worked out from a cut-short read");
      assert.notEqual(paidCut.nextStep.basis, "payments");
    });
  });
});

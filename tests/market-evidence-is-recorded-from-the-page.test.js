"use strict";

// The market intelligence pages promised "Track customer segments, competitor
// evidence, pricing, market signals, scored opportunities, and portfolio
// decisions" and offered no way to record any of them: four counts and some
// guidance, with every record type writable only by an API client. These tests
// drive the pages the way a person does -- the page's own forms, posted as a
// browser posts them -- and check what lands in the database and what the page
// then shows.
//
// The evidence rules are the endpoints' and are checked through the forms: a
// signal without an https source is refused, a competitor without the date its
// details were checked is refused, and neither writes anything.

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const express = require("express");
const request = require("supertest");
const { createFakeSupabase } = require("./helpers/fake-supabase.cjs");
const registerRoutes = require("../routes/market-intelligence-routes.cjs");
const pages = require("../lib/sonara-market-intelligence-pages.cjs");

const ORG = "11111111-1111-4111-8111-111111111111";
const OTHER_ORG = "99999999-9999-4999-8999-999999999999";
const USER = "22222222-2222-4222-8222-222222222222";
const PAGE = "/business-builder/market-intelligence";
const TODAY = new Date().toISOString().slice(0, 10);

const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

function buildApp(fake) {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  const authorize = (req, res, next) => { req.sonaraUser = { id: USER, email: "owner@example.com" }; next(); };
  registerRoutes(app, {
    layout: ({ title, heading, body, sections = [], actions = [] }) => `<html><title>${title}</title><h1>${heading}</h1><p>${body}</p><nav>${actions.join("")}</nav>${sections.join("")}</html>`,
    brandCard: (title, body) => `<article><h2>${title}</h2><p>${body}</p></article>`,
    linkAction: (href, label) => `<a href="${href}">${label}</a>`,
    escapeHtml: escape,
    requireCustomer: authorize,
    requireWorkspaceAccess: () => authorize,
    getCustomerPrimaryOrganization: async () => ({ ok: true, organizationId: ORG }),
    getSupabaseServerConfig: () => ({ ok: true, url: fake.url, serviceRoleKey: "server-only" })
  });
  return app;
}

const browser = (app, url, fields) => request(app).post(url).type("form").set("accept", "text/html").send(fields);
const page = (app, url = PAGE) => request(app).get(url).set("accept", "text/html");

function opportunityRow(fields = {}) {
  return {
    id: crypto.randomUUID(),
    organization_id: ORG,
    user_id: USER,
    studio_key: "business_builder",
    name: "Recurring cleaning quotes",
    problem: "Cleaners quote every recurring job by hand.",
    target_segment: "Owner-operated cleaning businesses",
    proposed_value: "A quote that repeats itself.",
    demand_evidence: 20, willingness_to_pay: 15, strategic_fit: 18, underserved_need: 10,
    differentiation: 6, channel_access: 6, delivery_complexity: 5, compliance_risk: 2,
    market_score: 68,
    recommendation: "validate",
    state: "validate",
    owner_name: null,
    metadata: {},
    created_at: "2026-10-01T00:00:00Z",
    ...fields
  };
}

describe("market evidence is recorded from the page", () => {
  let fake;
  let savedFetch;

  function start(tables = {}) {
    fake = createFakeSupabase({ users: {}, tables, ids: "uuid" });
    savedFetch = global.fetch;
    global.fetch = fake.install(savedFetch);
    return buildApp(fake);
  }

  afterEach(() => {
    if (savedFetch) global.fetch = savedFetch;
    savedFetch = null;
  });

  it("offers a form for every record type, posting where the rules are checked, carrying its studio and its way back", async () => {
    const app = start();
    const response = await page(app);
    assert.equal(response.status, 200);
    for (const endpoint of ["opportunities", "signals", "competitors", "segments", "fetch-source"]) {
      assert.ok(response.text.includes(`action="/api/market-intelligence/${endpoint}"`), `the page has no form posting to /api/market-intelligence/${endpoint}`);
    }
    assert.ok(response.text.includes('name="studio_key" value="business_builder"'), "a studio page's forms do not record into that studio");
    assert.ok(response.text.includes(`name="back" value="${PAGE}"`), "the forms do not return to the page they are on");
    // The parent page shows all four studios, so it asks which.
    const parent = await page(app, "/market-intelligence");
    assert.match(parent.text, /<select name="studio_key" required>/, "the parent page records without asking which studio");
  });

  it("records each one for this business and this studio, and the page then lists it", async () => {
    const app = start();
    const posts = [
      ["segments", { name: "Owner-run cleaners", segment_key: "Owner Run Cleaners", customer_type: "Sole traders", status: "active" }, "segment", "market_intelligence_segments"],
      ["competitors", { name: "Jobber", source_url: "https://www.getjobber.com/pricing/", verified_at: TODAY, entry_price: "39", currency: "USD", billing_period: "monthly" }, "competitor", "market_intelligence_competitors"],
      ["signals", { signal_type: "pricing", title: "Entry plans start near $40", summary: "Three field-service tools price their entry plan between $29 and $49 a month.", source_name: "Pricing pages", source_url: "https://www.getjobber.com/pricing/", observed_at: TODAY, confidence: "high" }, "signal", "market_intelligence_signals"],
      ["opportunities", { name: "Recurring quotes", problem: "Recurring jobs are re-quoted by hand.", target_segment: "Owner-run cleaners", proposed_value: "A quote that repeats itself.", demand_evidence: "20", willingness_to_pay: "15", strategic_fit: "18", underserved_need: "12", differentiation: "8", channel_access: "7", delivery_complexity: "3", compliance_risk: "2" }, "opportunity", "market_intelligence_opportunities"]
    ];
    for (const [endpoint, fields, done, table] of posts) {
      const saved = await browser(app, `/api/market-intelligence/${endpoint}`, { ...fields, studio_key: "business_builder", back: PAGE });
      assert.equal(saved.status, 303, `${endpoint} answered ${saved.status}: ${saved.text}`);
      assert.equal(saved.headers.location, `${PAGE}?done=${done}`, `${endpoint} did not send the browser back to the page with its outcome`);
      const rows = fake.rows(table);
      assert.equal(rows.length, 1, `${endpoint} did not write exactly one row`);
      assert.equal(rows[0].organization_id, ORG);
      assert.equal(rows[0].studio_key, "business_builder");
    }
    const segment = fake.rows("market_intelligence_segments")[0];
    assert.equal(segment.segment_key, "owner_run_cleaners", "the key was not normalised the way the endpoint always has");
    const opportunity = fake.rows("market_intelligence_opportunities")[0];
    assert.equal(opportunity.market_score, 75, "the score is not the sum of the factors less the penalties");
    assert.equal(opportunity.recommendation, "prioritize");

    const after = await page(app, `${PAGE}?done=opportunity`);
    for (const shown of ["Owner-run cleaners", "Jobber", "Entry plans start near $40", "Recurring quotes", pages.DONE.opportunity]) {
      assert.ok(after.text.includes(escape(shown)), `the page does not show "${shown}" after it was recorded`);
    }
    assert.ok(after.text.includes(`href="/market-intelligence/opportunities/${opportunity.id}"`), "the opportunity is listed with no way to open it");
  });

  it("refuses evidence without its source or date, says why, and writes nothing", async () => {
    const app = start();
    const noSource = await browser(app, "/api/market-intelligence/signals", { studio_key: "business_builder", back: PAGE, signal_type: "pricing", title: "Prices are rising", summary: "Heard it somewhere.", source_name: "A friend", source_url: "", observed_at: TODAY, confidence: "high" });
    assert.equal(noSource.status, 303);
    assert.equal(noSource.headers.location, `${PAGE}?problem=complete_evidence_backed_signal_required`);
    const plainHttp = await browser(app, "/api/market-intelligence/signals", { studio_key: "business_builder", back: PAGE, signal_type: "pricing", title: "Prices are rising", summary: "From a page.", source_name: "Blog", source_url: "http://example.com/prices", observed_at: TODAY, confidence: "high" });
    assert.equal(plainHttp.headers.location, `${PAGE}?problem=complete_evidence_backed_signal_required`, "a signal with an http source was accepted");
    const undated = await browser(app, "/api/market-intelligence/competitors", { studio_key: "business_builder", back: PAGE, name: "Jobber", source_url: "https://www.getjobber.com/pricing/", verified_at: "" });
    assert.equal(undated.headers.location, `${PAGE}?problem=studio_name_source_and_verified_at_required`);
    assert.equal(fake.rows("market_intelligence_signals").length, 0, "a refused signal was written");
    assert.equal(fake.rows("market_intelligence_competitors").length, 0, "a refused competitor was written");

    const shown = await page(app, `${PAGE}?problem=complete_evidence_backed_signal_required`);
    assert.ok(shown.text.includes(escape(pages.PROBLEMS.complete_evidence_backed_signal_required)), "the page does not say why the signal was refused");
    // Only known codes are printed. A link cannot put its own sentence here.
    const forged = await page(app, `${PAGE}?problem=${encodeURIComponent("Your account is suspended, call 555-0100")}`);
    assert.doesNotMatch(forged.text, /suspended/, "the page printed text supplied in its own address");
  });

  it("offers in each dropdown only what the endpoint accepts", async () => {
    const app = start();
    for (const signalType of pages.SIGNAL_TYPES) {
      for (const confidence of pages.CONFIDENCE_LEVELS) {
        const saved = await browser(app, "/api/market-intelligence/signals", { studio_key: "growth_studio", back: "/growth-studio/market-intelligence", signal_type: signalType, title: "t", summary: "s", source_name: "n", source_url: "https://example.com/a", observed_at: TODAY, confidence });
        assert.equal(saved.headers.location, "/growth-studio/market-intelligence?done=signal", `${signalType}/${confidence} is offered and refused`);
      }
    }
    assert.ok(pages.SIGNAL_TYPES.length >= 5 && pages.CONFIDENCE_LEVELS.length >= 3, "the option lists are empty; this check has gone blind");
  });

  it("still answers an API client with JSON", async () => {
    const app = start();
    const created = await request(app).post("/api/market-intelligence/segments").send({ studio_key: "creator_studio", segment_key: "indie_labels", name: "Independent labels" });
    assert.equal(created.status, 201);
    assert.equal(created.body.ok, true);
    assert.equal(created.body.segment.segment_key, "indie_labels");
    const refused = await request(app).post("/api/market-intelligence/segments").send({ studio_key: "creator_studio" });
    assert.equal(refused.status, 400);
    assert.equal(refused.body.code, "studio_segment_key_and_name_required");
  });

  it("only ever sends a browser back to a path on this site", async () => {
    const app = start();
    for (const back of ["https://evil.example/phish", "//evil.example/phish", "/x?y=https://evil.example"]) {
      const saved = await browser(app, "/api/market-intelligence/segments", { studio_key: "business_builder", segment_key: "k", name: "n", back });
      assert.ok(saved.headers.location.startsWith("/market-intelligence?"), `a back address of ${back} sent the browser to ${saved.headers.location}`);
    }
  });

  it("shows an opportunity's score as its sum, records a review that moves its state, and rescores without touching the state", async () => {
    const row = opportunityRow();
    const app = start({ market_intelligence_opportunities: [row] });
    const url = `/market-intelligence/opportunities/${row.id}`;

    const shown = await page(app, url);
    assert.equal(shown.status, 200, `the opportunity page answered ${shown.status}`);
    assert.match(shown.text, /Score: 68 of 100/);
    for (const field of pages.SCORE_FIELDS) assert.ok(shown.text.includes(escape(field.label)), `the breakdown leaves out ${field.label}`);
    assert.ok(shown.text.includes(`action="/api/market-intelligence/opportunities/${row.id}/reviews"`), "the page has no way to record a review");

    const reviewed = await browser(app, `/api/market-intelligence/opportunities/${row.id}/reviews`, { decision: "prioritize", rationale: "Four of five operators asked for it unprompted.", back: url });
    assert.equal(reviewed.status, 303);
    assert.equal(reviewed.headers.location, `${url}?done=review`);
    assert.equal(fake.rows("market_intelligence_reviews").length, 1, "the review was not recorded");
    assert.equal(fake.rows("market_intelligence_opportunities")[0].state, "prioritized", "the decision did not move the state");

    const rescored = await browser(app, url, { back: url, name: row.name, problem: row.problem, target_segment: row.target_segment, proposed_value: row.proposed_value, demand_evidence: "25", willingness_to_pay: "20", strategic_fit: "20", underserved_need: "15", differentiation: "10", channel_access: "10", delivery_complexity: "0", compliance_risk: "0", state: "launched" });
    assert.equal(rescored.status, 303, `rescoring answered ${rescored.status}`);
    const after = fake.rows("market_intelligence_opportunities")[0];
    assert.equal(after.market_score, 100, "the rescore did not recalculate the score");
    assert.equal(after.recommendation, "prioritize");
    assert.equal(after.state, "prioritized", "the rescore form changed the state, which only a review may do");
  });

  it("saves focus evidence in the shape the assessment reads, and refuses half of it", async () => {
    const row = opportunityRow({ owner_name: "Dana" });
    const app = start({ market_intelligence_opportunities: [row] });
    const url = `/market-intelligence/opportunities/${row.id}`;

    const before = await page(app, url);
    assert.match(before.text, /No customer commitment recorded/);
    assert.match(before.text, /keep validating/);

    const partial = await browser(app, `${url}/focus-evidence`, { back: url, customer_commitment: "Three operators signed letters of intent.", source_reference: "https://example.com/loi", measured_on: TODAY, cost_ceiling: "", revenue: "1200", variable_cost: "300" });
    assert.equal(partial.headers.location, `${url}?problem=focus_evidence_incomplete`, "focus evidence with no cost ceiling was accepted");
    assert.deepEqual(fake.rows("market_intelligence_opportunities")[0].metadata, {}, "refused focus evidence was written");

    const saved = await browser(app, `${url}/focus-evidence`, { back: url, customer_commitment: "Three operators signed letters of intent.", source_reference: "https://example.com/loi", measured_on: TODAY, cost_ceiling: "500", revenue: "1200.50", variable_cost: "300" });
    assert.equal(saved.headers.location, `${url}?done=focus_evidence`);
    const evidence = fake.rows("market_intelligence_opportunities")[0].metadata.focus_evidence;
    assert.equal(evidence.revenue_cents, 120050, "an amount was not stored as whole cents");
    assert.equal(evidence.cost_ceiling_cents, 50000);
    assert.equal(evidence.variable_cost_cents, 30000);
    assert.match(evidence.measured_at, /^\d{4}-\d{2}-\d{2}T/);

    const after = await page(app, url);
    assert.match(after.text, /pilot candidate/, "complete, positive, fresh evidence was not read as a pilot candidate");
    assert.match(after.text, /Nothing is missing/);
  });

  it("does not show a list it could not read as an empty one", async () => {
    const app = start();
    const installed = global.fetch;
    global.fetch = async (input, init = {}) => {
      const url = String(typeof input === "string" ? input : input?.url);
      if (url.includes("/rest/v1/market_intelligence_signals?select=*")) return { ok: false, status: 500, headers: { get: () => null }, json: async () => ({}) };
      return installed(input, init);
    };
    const response = await page(app);
    assert.equal(response.status, 200);
    assert.match(response.text, /could not read these just now/);
    assert.doesNotMatch(response.text, /No signals recorded yet/, "a failed read was shown as no signals");
  });

  it("does not open or review another business's opportunity", async () => {
    const theirs = opportunityRow({ organization_id: OTHER_ORG });
    const app = start({ market_intelligence_opportunities: [theirs] });
    const shown = await page(app, `/market-intelligence/opportunities/${theirs.id}`);
    assert.equal(shown.status, 404, "another business's opportunity opened");
    assert.doesNotMatch(shown.text, /Recurring cleaning quotes/);
    const reviewed = await browser(app, `/api/market-intelligence/opportunities/${theirs.id}/reviews`, { decision: "reject", rationale: "Not ours to decide.", back: "/market-intelligence" });
    assert.equal(reviewed.headers.location, "/market-intelligence?problem=resource_not_found");
    assert.equal(fake.rows("market_intelligence_reviews").length, 0);
    assert.equal(fake.rows("market_intelligence_opportunities")[0].state, "validate");
  });

  it("shows a fetched source for reading beside a signal form, and records nothing", async () => {
    const app = start();
    const response = await browser(app, "/api/market-intelligence/fetch-source", { source_url: "https://www.getjobber.com/pricing/", back: PAGE });
    assert.equal(response.status, 200);
    assert.match(response.text, /not fetched/i);
    assert.ok(response.text.includes('value="https://www.getjobber.com/pricing/"'), "the signal form is not prefilled with the address that was asked for");
    assert.ok(response.text.includes('name="studio_key" value="business_builder"'), "the form beside the fetched page records into no studio");
    assert.doesNotMatch(response.text, /name="title"[^>]*value="[^"]+"/, "a title was guessed for the signal");
    assert.equal(fake.queries.filter((query) => query.method !== "GET").length, 0, "fetching a source wrote something");
  });
});

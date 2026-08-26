"use strict";

// A read that failed is not a fact about the customer's business.
//
// This is the recurring defect in this codebase, and these two pages had it in
// the same shape: an unreadable table collapsed into an empty list, and the
// empty list was then described as though it were the truth.
//
// The lead-routing page rendered every rule as pointing at "somebody who is no
// longer here" -- a claim that a named colleague has left, printed next to a
// Remove button, for a business whose staff are all still there. The pipeline
// page had the honest version of the same handling already, which is what made
// the rules list worth checking.
//
// Driven through the real routes rather than through a helper. The bug in the
// chase-drafts version of this lived in the wiring, not in the function, and a
// unit test of the function went on passing while the page lied.

const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");

const registerLeadCaptureRoutes = require("../routes/sonara-lead-capture-routes.cjs");

const ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const PERSON_ID = "33333333-3333-4333-8333-333333333333";
const RULE_ID = "44444444-4444-4444-8444-444444444444";

const PERSON = { id: PERSON_ID, full_name: "Ana Delgado" };
const RULE = {
  id: RULE_ID,
  name: "Hot leads to Ana",
  assign_to: PERSON_ID,
  enabled: true,
  min_score: 80,
  max_score: null,
  match_unscored: false,
  bands: [],
  industries: [],
  regions: [],
  sources: []
};

describe("an outage is not news about your staff", () => {
  let originalFetch;
  beforeEach(() => { originalFetch = global.fetch; });
  afterEach(() => { global.fetch = originalFetch; });

  function buildApp() {
    const app = express();
    app.use(express.urlencoded({ extended: false }));
    app.use(express.json());
    const authenticate = (req, res, next) => {
      req.sonaraUser = { id: USER_ID };
      req.sonaraAccess = { user: { id: USER_ID } };
      return next();
    };
    registerLeadCaptureRoutes(app, {
      layout: ({ title, heading, body, sections = [] }) =>
        `<html><title>${title}</title><h1>${heading}</h1><p>${body}</p>${sections.join("")}</html>`,
      brandCard: (cardTitle, cardBody) => `<article><h2>${cardTitle}</h2><div>${cardBody}</div></article>`,
      linkAction: (href, label) => `<a href="${href}">${label}</a>`,
      escapeHtml: (value) => String(value),
      requireCustomer: authenticate,
      getCustomerPrimaryOrganization: async () => ({ ok: true, organizationId: ORGANIZATION_ID }),
      getSupabaseServerConfig: () => ({ ok: true, url: "https://project.supabase.co", serviceRoleKey: "server-only" }),
      supabaseHeaders: () => ({}),
      createRateLimiter: () => (req, res, next) => next()
    });
    return app;
  }

  // Only the employees table fails. Everything else answers, so a failure here
  // cannot be confused with a page that could not load at all -- which is the
  // distinction the whole test is about.
  function answering({ peopleFail = false } = {}) {
    return async (url) => {
      const table = (String(url).split("/rest/v1/")[1] || "").split("?")[0];
      if (peopleFail && table.startsWith("business_employee_profiles")) {
        return { ok: false, status: 500, headers: { get: () => null }, json: async () => ({}) };
      }
      const rows = {
        business_employee_profiles: [PERSON],
        lead_routing_rules: [RULE],
        growth_leads: [{
          id: "55555555-5555-4555-8555-555555555555",
          name: "A Real Lead", status: "new", assigned_to: PERSON_ID,
          lead_score: 90, score_band: "hot"
        }]
      }[table] || [];
      return { ok: true, status: 200, headers: { get: () => null }, json: async () => rows };
    };
  }

  describe("the lead routing page", () => {
    it("names the person a rule points at when everything reads", async () => {
      global.fetch = answering();
      const response = await request(buildApp()).get("/growth-studio/owner/lead-routing").set("accept", "text/html");
      assert.equal(response.status, 200);
      assert.match(response.text, /Ana Delgado/,
        "the happy path stopped naming the person, so the checks below prove nothing");
    });

    it("does not say a colleague has left because a table would not load", async () => {
      global.fetch = answering({ peopleFail: true });
      const response = await request(buildApp()).get("/growth-studio/owner/lead-routing").set("accept", "text/html");
      assert.equal(response.status, 200);
      assert.ok(
        !/no longer here/.test(response.text),
        "an unreadable people table was reported as a colleague having left the business"
      );
      assert.match(response.text, /could not look up just now/);
    });

    it("keeps saying no longer here when the read worked and the person really is gone", async () => {
      // The honest message has to survive. Losing it would trade one wrong
      // answer for another.
      global.fetch = async (url) => {
        const table = (String(url).split("/rest/v1/")[1] || "").split("?")[0];
        const rows = table.startsWith("lead_routing_rules") ? [RULE] : [];
        return { ok: true, status: 200, headers: { get: () => null }, json: async () => rows };
      };
      const response = await request(buildApp()).get("/growth-studio/owner/lead-routing").set("accept", "text/html");
      assert.match(response.text, /no longer here/,
        "a rule pointing at somebody who has actually gone stopped saying so");
    });

    it("says what could not be read, and that nothing was changed", async () => {
      global.fetch = answering({ peopleFail: true });
      const response = await request(buildApp()).get("/growth-studio/owner/lead-routing").set("accept", "text/html");
      assert.match(response.text, /could not read your people/i);
      assert.match(response.text, /No rule has been changed/,
        "the page did not say the rules were left alone, which is the thing an owner would worry about");
    });

    it("does not tell an owner they have nobody when it could not look", async () => {
      global.fetch = answering({ peopleFail: true });
      const response = await request(buildApp()).get("/growth-studio/owner/lead-routing").set("accept", "text/html");
      assert.ok(
        !/You have nobody to give a lead to/.test(response.text),
        "a failed read was reported as a business with no staff"
      );
    });

    it("still shows the rule rather than dropping it", async () => {
      global.fetch = answering({ peopleFail: true });
      const response = await request(buildApp()).get("/growth-studio/owner/lead-routing").set("accept", "text/html");
      assert.match(response.text, /Hot leads to Ana/,
        "the rule vanished from the page, which reads as having no rules at all");
    });
  });

  describe("the pipeline page", () => {
    it("does not blame the assignment when it is the lookup that failed", async () => {
      global.fetch = answering({ peopleFail: true });
      const response = await request(buildApp()).get("/growth-studio/pipeline").set("accept", "text/html");
      assert.equal(response.status, 200);
      assert.match(response.text, /could not read your people/i);
      assert.match(response.text, /not because nobody is assigned/,
        "the page did not distinguish a missing name from an unassigned lead");
    });

    it("does not report a business with leads as having none", async () => {
      global.fetch = answering({ peopleFail: true });
      const response = await request(buildApp()).get("/growth-studio/pipeline").set("accept", "text/html");
      assert.ok(
        !/No leads have arrived yet/.test(response.text),
        "an unreadable people table emptied the pipeline"
      );
      assert.match(response.text, /A Real Lead/);
    });
  });
});

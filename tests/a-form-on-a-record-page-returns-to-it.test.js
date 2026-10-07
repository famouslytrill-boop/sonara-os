"use strict";

// Every create form on a record page posts to a generic REST resource, and the
// resource sends a browser back to the page it came from -- if it can find the
// page. It found it by the page's own `api` and never by an `also` block, so
// the vibration-pattern and feedback-profile forms on
// /creator-studio/device-cues answered the person who filled them in with the
// saved row as raw JSON. The sound-cue form beside them, the page's own, went
// back to the page.
//
// This walks every form the page declarations describe, the `also` blocks
// included, and posts each as a browser does.

const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const registerRoutes = require("../routes/sonara-last9-routes.cjs");
const { RESOURCE_MAP } = registerRoutes;
const { ALL_OWNER_PAGES, CREATOR_RECORD_PAGES, pageForApi } = require("../lib/sonara-owner-record-pages.cjs");

const ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

function buildApp() {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  const authenticate = (req, res, next) => { req.sonaraUser = { id: USER_ID }; next(); };
  registerRoutes(app, {
    layout: ({ title, sections = [] }) => `<html><title>${title}</title>${sections.join("")}</html>`,
    brandCard: (cardTitle, cardBody) => `<article><h2>${cardTitle}</h2><p>${cardBody}</p></article>`,
    linkAction: (href, label) => `<a href="${href}">${label}</a>`,
    escapeHtml: (value) => String(value),
    requireCustomer: authenticate,
    requireBusinessManager: authenticate,
    requireWorkspaceAccess: () => authenticate,
    getCustomerPrimaryOrganization: async () => ({ ok: true, organizationId: ORGANIZATION_ID, userId: USER_ID }),
    getCustomerPaidEntitlement: async () => ({ ok: true, entitlementKey: "all_three_monthly" }),
    getSupabaseServerConfig: () => ({ ok: true, url: "https://project.supabase.co", serviceRoleKey: "server-only" })
  });
  return app;
}

// Each (page, endpoint) pair a declared form posts to, where the endpoint is a
// generic REST resource -- the ones whose browser answer pageForApi decides.
function declaredForms() {
  const forms = [];
  for (const page of [...ALL_OWNER_PAGES, ...CREATOR_RECORD_PAGES]) {
    if (page.form && page.api && RESOURCE_MAP[page.api]) forms.push({ page: page.path, api: page.api, block: "page" });
    for (const block of page.also || []) {
      if (block.form && block.api && RESOURCE_MAP[block.api]) forms.push({ page: page.path, api: block.api, block: block.table });
    }
  }
  return forms;
}

describe("a form on a record page returns to it", () => {
  let originalFetch;
  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = async (url, options = {}) => {
      const method = options.method || "GET";
      if (method === "POST") return { ok: true, status: 201, headers: { get: () => null }, json: async () => [{ id: "created" }] };
      return { ok: true, status: 200, headers: { get: () => "0-0/0" }, json: async () => [] };
    };
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("finds forms to post, including ones in also blocks", () => {
    const forms = declaredForms();
    assert.ok(forms.length >= 10, `only ${forms.length} declared forms were found; this check has gone blind`);
    assert.ok(forms.some((form) => form.block !== "page"), "no also-block form was found, so the case this file exists for is not covered");
  });

  it("finds the page for every endpoint a declared form posts to", () => {
    const lost = declaredForms().filter((form) => pageForApi(form.api)?.path !== form.page);
    assert.deepEqual(lost.map((form) => `${form.api} (form on ${form.page}) -> ${pageForApi(form.api)?.path || "no page"}`), []);
  });

  it("sends a browser back to the page after saving, never the row as JSON", async () => {
    const app = buildApp();
    const answeredWithJson = [];
    for (const form of declaredForms()) {
      const resource = RESOURCE_MAP[form.api];
      const fields = Object.fromEntries((resource.required || []).map((key) => [key, "Filled in"]));
      const response = await request(app).post(form.api).type("form").set("accept", "text/html").send(fields);
      if (response.status !== 303 || !String(response.headers.location || "").startsWith(form.page)) {
        answeredWithJson.push(`${form.api} from ${form.page}: ${response.status} ${response.headers.location || response.text.slice(0, 80)}`);
      }
    }
    assert.deepEqual(answeredWithJson, []);
  });
});

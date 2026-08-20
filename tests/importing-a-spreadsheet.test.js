"use strict";

// Bringing a spreadsheet in, and the two places an importer lies.
//
// **It says "done" having lost rows.** 94 of 100 customers created, six dropped
// by a parser that could not see them, and nobody finds out until one of the
// six is not called back. Every test here that touches counts is about that.
//
// **It writes something the preview never showed.** A preview whose confirm
// step trusts a list carried back through a hidden field is a preview of
// something else. The confirm here re-reads the pasted text through the same
// reader, and the test posts a smuggled row to prove a form field cannot add
// one.
//
// Driven against the route module directly with the guards stubbed. Going
// through server.js would answer 303 from requireBusinessManager and every
// assertion below would pass over a redirect -- which is what happened the
// first time an owner-page test was written in this repository.

const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const registerImportRoutes = require("../routes/sonara-import-routes.cjs");
const { hasColumn, tableColumns } = require("../lib/sonara-migration-columns.cjs");

const ORG = "a1a1a1a1-0000-4000-8000-00000000001a";
const USER = "b2b2b2b2-0000-4000-8000-00000000002b";
const PAGE = "/business-builder/owner/customers/import";
const API = "/api/business/customers/import";

function buildApp({ organization = ORG, existing = { ok: true, rows: [] }, writeOk = true, written = null } = {}) {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  const authenticate = (req, res, next) => { req.sonaraUser = { id: USER, email: "owner@example.com" }; return next(); };

  const calls = [];
  global.fetch = async (url, init) => {
    const method = String(init?.method || "GET").toUpperCase();
    calls.push({ url: String(url), method, body: init?.body ? JSON.parse(init.body) : null });
    if (method === "GET") {
      if (!existing.ok) return { ok: false, status: 500, json: async () => null };
      return { ok: true, status: 200, json: async () => existing.rows };
    }
    if (!writeOk) return { ok: false, status: 502, json: async () => null };
    const rows = JSON.parse(init.body);
    return { ok: true, status: 201, json: async () => (written === null ? rows : written) };
  };

  registerImportRoutes(app, {
    layout: ({ title, heading, sections = [] }) => `<html><title>${title}</title><h1>${heading}</h1>${sections.join("")}</html>`,
    brandCard: (cardTitle, cardBody) => `<article><h2>${cardTitle}</h2><p>${cardBody}</p></article>`,
    linkAction: (href, label) => `<a href="${href}">${label}</a>`,
    escapeHtml: (value) => String(value).replace(/[&<>"']/g, ""),
    requireBusinessManager: authenticate,
    getCustomerPrimaryOrganization: async () => (organization ? { ok: true, organizationId: organization } : { ok: false }),
    getSupabaseServerConfig: () => ({ ok: true, url: "https://project.supabase.co", serviceRoleKey: "server-only" }),
    supabaseHeaders: () => ({ apikey: "server-only" })
  });
  return { app, calls };
}

const SHEET = "Name,Email,Phone\nJo Smith,jo@example.com,555 0100\nKim Patel,kim@example.com,555 0200";

describe("bringing a spreadsheet in", () => {
  let savedFetch;
  before(() => { savedFetch = global.fetch; });
  after(() => { global.fetch = savedFetch; });

  describe("the columns it offers", () => {
    it("names only columns the customers table actually has", () => {
      // Seventeen owner forms once shipped sending a column that did not exist;
      // every save failed in production while the tests passed against a stub.
      // This reads supabase/migrations instead of trusting the list.
      // hasColumn rather than describedColumns: the latter omits columns
      // added by a later `alter table`, so it reports a column that is really
      // there as absent.
      assert.ok((tableColumns("customers")?.size || 0) > 0, "no columns found for customers, so this check is looking at nothing");
      for (const field of registerImportRoutes.CUSTOMER_FIELDS) {
        assert.ok(hasColumn("customers", field.column), `customers has no column ${field.column}`);
      }
    });

    it("requires a name and nothing else", () => {
      const required = registerImportRoutes.CUSTOMER_FIELDS.filter((field) => field.required).map((field) => field.column);
      assert.deepEqual(required, ["name"], "a column somebody's spreadsheet may not have was made compulsory");
    });
  });

  describe("the preview", () => {
    it("writes nothing", async () => {
      const { app, calls } = buildApp();
      const response = await request(app).post(API).type("form").send({ sheet: SHEET }).redirects(0);
      assert.equal(response.status, 200);
      assert.equal(calls.filter((call) => call.method === "POST").length, 0, "a preview imported the sheet");
    });

    it("says what will be added", async () => {
      const { app } = buildApp();
      const response = await request(app).post(API).type("form").send({ sheet: SHEET }).redirects(0);
      assert.ok(response.text.includes("2 to add"));
      assert.ok(response.text.includes("Jo Smith"));
      assert.ok(response.text.includes("Kim Patel"));
    });

    it("names the rows it cannot take, with their line numbers", async () => {
      const { app } = buildApp();
      const sheet = `${SHEET}\nPat Jones,not-an-email,555 0300`;
      const response = await request(app).post(API).type("form").send({ sheet }).redirects(0);
      assert.ok(response.text.includes("Line 4"), "a rejected row was not located in the sheet");
      assert.ok(response.text.includes("not an email address"));
      assert.ok(response.text.includes("2 to add, 1 that cannot be added yet"));
    });

    it("says which headings it ignored rather than dropping them in silence", async () => {
      const { app } = buildApp();
      const response = await request(app).post(API).type("form").send({ sheet: "Name,Favourite colour\nJo,blue" }).redirects(0);
      assert.ok(response.text.includes("Favourite colour"), "a column was ignored without saying so");
      assert.ok(response.text.includes("nothing in them is imported"));
    });

    it("flags somebody who looks like a customer already on file", async () => {
      const { app } = buildApp({ existing: { ok: true, rows: [{ id: "c1", name: "Jo Smyth", email: "j.smyth@example.com", phone: null }] } });
      const response = await request(app).post(API).type("form").send({ sheet: "Name\nJo Smith" }).redirects(0);
      assert.ok(response.text.includes("You may already have these"), "a likely repeat was not flagged");
      assert.ok(response.text.includes("Flagged, not blocked"), "and the flag reads as a decision the product made");
    });

    it("says it could not check rather than showing an import with no warnings", async () => {
      // "No duplicates found" and "we did not look" are the same screen
      // otherwise, and one of them is a promise.
      const { app } = buildApp({ existing: { ok: false, rows: [] } });
      const response = await request(app).post(API).type("form").send({ sheet: SHEET }).redirects(0);
      assert.ok(response.text.includes("could not check for people you already have"));
      assert.ok(response.text.includes("not saying there are none"));
    });

    it("refuses a paste with no headings and says what it saw", async () => {
      const { app, calls } = buildApp();
      const response = await request(app).post(API).type("form").send({ sheet: "Jo,jo@example.com" }).redirects(0);
      assert.ok(response.text.includes("could not be read"));
      assert.equal(calls.filter((call) => call.method === "POST").length, 0);
    });
  });

  describe("confirming", () => {
    it("writes the rows, scoped to the business", async () => {
      const { app, calls } = buildApp();
      const response = await request(app).post(API).type("form").send({ sheet: SHEET, confirm: "yes" }).redirects(0);
      assert.equal(response.status, 200);
      const writes = calls.filter((call) => call.method === "POST");
      assert.equal(writes.length, 1, "the whole paste goes in one request, so a failure imports nobody");
      assert.equal(writes[0].body.length, 2);
      for (const row of writes[0].body) {
        assert.equal(row.organization_id, ORG, "a row was written against the wrong business");
        assert.equal(row.created_by, USER);
      }
      assert.ok(response.text.includes("2 customers added"));
    });

    it("cannot be made to write a row the preview never showed", async () => {
      // The confirm re-reads the pasted text rather than trusting anything
      // carried back from the page, so an extra field is simply not read.
      const { app, calls } = buildApp();
      await request(app).post(API).type("form").send({
        sheet: "Name\nJo Smith",
        confirm: "yes",
        records: JSON.stringify([{ name: "Smuggled In" }]),
        name: "Also Smuggled"
      }).redirects(0);
      const writes = calls.filter((call) => call.method === "POST");
      assert.equal(writes[0].body.length, 1);
      assert.equal(writes[0].body[0].name, "Jo Smith");
    });

    it("cannot be made to write into another business", async () => {
      const { app, calls } = buildApp();
      await request(app).post(API).type("form")
        .send({ sheet: "Name\nJo Smith", confirm: "yes", organization_id: "ffffffff-0000-4000-8000-0000000000ff" })
        .redirects(0);
      assert.equal(calls.filter((call) => call.method === "POST")[0].body[0].organization_id, ORG);
    });

    it("still reports the rows it could not take", async () => {
      const { app } = buildApp();
      const response = await request(app).post(API).type("form")
        .send({ sheet: `${SHEET}\nPat Jones,nope,555 0300`, confirm: "yes" }).redirects(0);
      assert.ok(response.text.includes("2 customers added"));
      assert.ok(response.text.includes("Still not added"), "a rejected row vanished once the good ones went in");
      assert.ok(response.text.includes("Line 4"));
    });

    it("says nothing was imported when the write fails, and that pasting again is safe", async () => {
      const { app } = buildApp({ writeOk: false });
      const response = await request(app).post(API).type("form").send({ sheet: SHEET, confirm: "yes" }).redirects(0);
      assert.equal(response.status, 502);
      assert.ok(response.text.includes("Nothing was imported"));
      // The thing somebody actually needs to know at that moment.
      assert.ok(response.text.includes("safely paste it again"));
    });

    it("does not claim a count the database did not give it", async () => {
      const { app } = buildApp({ written: [] });
      const response = await request(app).post(API).type("form").send({ sheet: SHEET, confirm: "yes" }).redirects(0);
      // Two sent, nothing reported back. Saying "2 added" here would be the
      // importer reporting its own intention as a result.
      assert.ok(!response.text.includes("2 customers added"), "the page reported what it sent rather than what came back");
      assert.ok(response.text.includes("Check your customer list"));
    });
  });

  describe("the form itself", () => {
    it("opens with a paste box and no confirm on it", async () => {
      const { app } = buildApp();
      const response = await request(app).get(PAGE).redirects(0);
      assert.equal(response.status, 200);
      assert.ok(response.text.includes("Paste your customers here"));
      assert.ok(!response.text.includes('name="confirm"'), "the first view can import without a preview");
    });

    it("says plainly that it never changes anybody already on file", async () => {
      const { app } = buildApp();
      const response = await request(app).get(PAGE).redirects(0);
      assert.ok(response.text.includes("never changes them"));
    });

    it("answers without a workspace rather than writing into nothing", async () => {
      const { app, calls } = buildApp({ organization: null });
      const response = await request(app).post(API).type("form").send({ sheet: SHEET, confirm: "yes" }).redirects(0);
      assert.equal(response.status, 503);
      assert.equal(calls.filter((call) => call.method === "POST").length, 0);
    });
  });
});

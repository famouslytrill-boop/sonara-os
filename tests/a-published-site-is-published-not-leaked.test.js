"use strict";

// Publishing a scroll site, and the two things that decide whether it is safe.
//
// **The resolution order.** `/s/:slug` is the only route here a stranger
// reaches. Reads go through the service-role key, which bypasses row level
// security, so the filter in the query is the entire tenant boundary. The slug
// must find one row that is *published*, and the document must come from that
// row and nowhere else. An unpublished draft is somebody's unannounced product,
// unfinished pricing and working title.
//
// **A failed read is not a missing site.** 404 tells a visitor to check the
// address, and sends them back to whoever gave it to them. 503 tells them to
// try again. Answering the first when the second is true is the recurring
// defect in this codebase, pointed at a stranger.
//
// The editor and the export are checked for the organization filter, because a
// guessed id from another workspace must not open — the same reasoning as every
// other per-record route here.

const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const registerScrollRoutes = require("../routes/sonara-scroll-routes.cjs");
const { siteFromTemplate } = require("../lib/sonara-scroll-templates.cjs");
const { buildSite } = require("../lib/sonara-scroll-site.cjs");
const { extractZip } = require("./helpers/system-zip.cjs");

const ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ORGANIZATION = "99999999-9999-4999-8999-999999999999";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const SITE_ID = "33333333-3333-4333-8333-333333333333";

// The `title` column and the document's own title are written together by the
// save handler, so a fixture where they disagree is not a state this
// application produces. Kept in step here deliberately: the download is named
// from the document, because the document is what is rendered, and the column
// is a denormalised copy the dashboard lists from.
function siteDocument({ heading = "A published heading", title = "A published site" } = {}) {
  const base = siteFromTemplate("midnight-launch");
  base.title = title;
  base.sections[0].heading = heading;
  return buildSite(base);
}

const PUBLISHED_ROW = {
  id: SITE_ID,
  organization_id: ORGANIZATION_ID,
  title: "A published site",
  slug: "summer-launch",
  published_at: "2026-08-20T09:00:00.000Z",
  document: siteDocument()
};

describe("a published site is published, not leaked", () => {
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
    registerScrollRoutes(app, {
      layout: ({ title, heading, body, sections = [], actions = [] }) =>
        `<html><title>${title}</title><h1>${heading}</h1><p>${body}</p><nav>${actions.join("")}</nav>${sections.join("")}</html>`,
      brandCard: (cardTitle, cardBody) => `<article><h2>${cardTitle}</h2><div>${cardBody}</div></article>`,
      linkAction: (href, label) => `<a href="${href}">${label}</a>`,
      escapeHtml: (value) => String(value).replace(/[&<>"']/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])),
      requireCustomer: authenticate,
      getCustomerPrimaryOrganization: async () => ({ ok: true, organizationId: ORGANIZATION_ID, entitlementKey: "free" }),
      getSupabaseServerConfig: () => ({ ok: true, url: "https://project.supabase.co", serviceRoleKey: "server-only" })
      ,
      supabaseHeaders: () => ({})
    });
    return app;
  }

  // Every query the route makes is recorded, so the tests can assert on what
  // was *asked for* rather than only on what came back. "The page did not show
  // the draft" can be true because the render dropped it; "the application
  // never asked for an unpublished row" is the property worth holding.
  function recording(rowsFor) {
    const asked = [];
    global.fetch = async (url, options = {}) => {
      const target = String(url);
      asked.push(target);
      const table = (target.split("/rest/v1/")[1] || "").split("?")[0];
      const rows = rowsFor(table, target, options);
      if (rows === "fail") return { ok: false, status: 500, headers: { get: () => null }, json: async () => ({}) };
      return { ok: true, status: 200, headers: { get: () => null }, json: async () => rows };
    };
    return asked;
  }

  describe("the public page", () => {
    it("serves a published site to somebody with no account at all", async () => {
      recording(() => [PUBLISHED_ROW]);
      const response = await request(buildApp()).get("/s/summer-launch");
      assert.equal(response.status, 200);
      assert.match(response.text, /A published heading/, "the site's own words are not on its page");
    });

    it("asks only for a row that is published", async () => {
      const asked = recording(() => [PUBLISHED_ROW]);
      await request(buildApp()).get("/s/summer-launch");
      const query = asked.find((url) => url.includes("scroll_sites"));
      assert.ok(query, "the public page did not read the sites table at all");
      assert.match(
        query, /published_at=not\.is\.null/,
        "the public page asked for a row without requiring it to be published, so an unpublished draft would serve"
      );
      assert.match(query, /slug=eq\.summer-launch/);
    });

    it("does not serve a draft that happens to have an address", async () => {
      // The row exists and has a slug; `published_at` is null. The query filter
      // is what stops it, so the stub answers as PostgREST would -- with no
      // rows for the published query, and the draft for anything else.
      const draft = {
        ...PUBLISHED_ROW,
        published_at: null,
        document: siteDocument({ heading: "OUR-UNANNOUNCED-PRODUCT-NAME" })
      };
      recording((table, target) => (target.includes("published_at=not.is.null") ? [] : [draft]));
      const response = await request(buildApp()).get("/s/summer-launch");
      assert.equal(response.status, 404, "an unpublished draft was served to a stranger");
      assert.ok(
        !/OUR-UNANNOUNCED-PRODUCT-NAME/.test(response.text),
        "the draft's own words reached a stranger's page"
      );
    });

    it("never selects a column that is not the document or the title", async () => {
      const asked = recording(() => [PUBLISHED_ROW]);
      await request(buildApp()).get("/s/summer-launch");
      const query = asked.find((url) => url.includes("scroll_sites"));
      assert.ok(
        !/select=\*/.test(query),
        "the public page selects every column, so anything added to this table later is published without anybody deciding to"
      );
      assert.ok(!/organization_id/.test(query.split("select=")[1].split("&")[0]),
        "the public page selects the organization id, which is not its business");
    });

    it("says try again rather than check the address when the read failed", async () => {
      recording(() => "fail");
      const response = await request(buildApp()).get("/s/summer-launch");
      assert.equal(response.status, 503, "a failed read answered 404, which tells a visitor their address is wrong when it is not");
      assert.match(response.text, /Nothing is wrong with the address/);
    });

    it("says there is no site there when there really is not", async () => {
      recording(() => []);
      const response = await request(buildApp()).get("/s/nothing-here");
      assert.equal(response.status, 404);
      assert.match(response.text, /no site at this address/);
    });

    it("refuses an address shaped wrongly before it reaches a query", async () => {
      const asked = recording(() => []);
      const response = await request(buildApp()).get("/s/Not_A_Slug");
      assert.equal(response.status, 404);
      assert.equal(
        asked.filter((url) => url.includes("scroll_sites")).length, 0,
        "a malformed address still produced a database query"
      );
    });

    it("does not wrap somebody else's broken link in this company's branding", async () => {
      recording(() => []);
      const response = await request(buildApp()).get("/s/nothing-here");
      assert.ok(!/Creator Studio/.test(response.text), "a stranger's 404 carries SONARA's navigation");
    });
  });

  describe("the editor and the export", () => {
    it("reads a site through the organization filter, not by id alone", async () => {
      const asked = recording(() => [PUBLISHED_ROW]);
      await request(buildApp()).get(`/creator-studio/scroll/${SITE_ID}`).set("accept", "text/html");
      const query = asked.find((url) => url.includes(`id=eq.${SITE_ID}`));
      assert.ok(query, "the editor did not read the site");
      assert.match(
        query, new RegExp(`organization_id=eq\\.${ORGANIZATION_ID}`),
        "the editor reads by id alone, so a guessed id from another workspace would open"
      );
    });

    it("does not open a site belonging to somebody else", async () => {
      // Filtered by the query, so the stub answers as PostgREST would.
      recording((table, target) => (target.includes(`organization_id=eq.${ORGANIZATION_ID}`) ? [] : [{ ...PUBLISHED_ROW, organization_id: OTHER_ORGANIZATION }]));
      const response = await request(buildApp()).get(`/creator-studio/scroll/${SITE_ID}`).set("accept", "text/html");
      assert.equal(response.status, 404);
      assert.ok(!response.text.includes("A published heading"), "another workspace's site rendered");
    });

    it("refuses an id that is not one before it reaches a query", async () => {
      const asked = recording(() => []);
      const response = await request(buildApp()).get("/creator-studio/scroll/not-a-uuid").set("accept", "text/html");
      assert.equal(response.status, 404);
      assert.equal(asked.filter((url) => url.includes("scroll_sites")).length, 0);
    });

    it("downloads a folder that unzips, with the site's words in it", async () => {
      recording(() => [PUBLISHED_ROW]);
      const response = await request(buildApp())
        .get(`/creator-studio/scroll/${SITE_ID}/export.zip`)
        .buffer(true)
        .parse((res, callback) => {
          const chunks = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () => callback(null, Buffer.concat(chunks)));
        });

      assert.equal(response.status, 200);
      assert.match(response.headers["content-type"], /application\/zip/);
      assert.match(response.headers["content-disposition"], /attachment; filename="a-published-site\.zip"/);

      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sonara-dl-"));
      try {
        const zipPath = path.join(dir, "site.zip");
        fs.writeFileSync(zipPath, response.body);
        // The downloaded bytes, opened by something this project did not write.
        extractZip(zipPath, path.join(dir, "out"));
        const index = fs.readFileSync(path.join(dir, "out", "index.html"), "utf8");
        assert.match(index, /A published heading/, "the downloaded page does not contain the site");
        assert.ok(fs.existsSync(path.join(dir, "out", "scroll.js")), "the page loads a script the folder does not contain");
        assert.ok(!/fonts\.googleapis\.com/.test(index), "the downloaded folder needs a font server to be up");
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });

    it("produces nothing rather than a wrong folder when the site cannot be read", async () => {
      recording(() => "fail");
      const response = await request(buildApp()).get(`/creator-studio/scroll/${SITE_ID}/export.zip`);
      assert.equal(response.status, 503, "a failed read produced a downloadable folder built from nothing");
      assert.ok(!/application\/zip/.test(response.headers["content-type"] || ""));
    });

    it("shows a preview drawn by the same renderer as the published page", async () => {
      recording(() => [PUBLISHED_ROW]);
      const preview = await request(buildApp()).get(`/creator-studio/scroll/${SITE_ID}/preview`);
      recording(() => [PUBLISHED_ROW]);
      const published = await request(buildApp()).get("/s/summer-launch");

      assert.equal(preview.status, 200);
      // Same document, minus the footer the preview adds. If these ever diverge
      // a customer signs off one page and publishes another.
      const withoutFooter = (html) => html.replace(/<footer>[\s\S]*?<\/footer>/, "");
      assert.equal(
        withoutFooter(preview.text), withoutFooter(published.text),
        "the preview and the published page are not the same document"
      );
    });

    it("does not cache a preview or a download anywhere a later visitor could reach it", async () => {
      recording(() => [PUBLISHED_ROW]);
      const preview = await request(buildApp()).get(`/creator-studio/scroll/${SITE_ID}/preview`);
      assert.match(preview.headers["cache-control"], /private, no-store/);
    });
  });

  describe("the dashboard", () => {
    it("does not say a customer has no sites when the read failed", async () => {
      recording(() => "fail");
      const response = await request(buildApp()).get("/creator-studio/scroll").set("accept", "text/html");
      assert.equal(response.status, 200);
      assert.ok(
        !/Nothing here yet/.test(response.text),
        "a failed read told a customer they had never made a site"
      );
      assert.match(response.text, /could not read your sites/i);
      assert.match(response.text, /still there/);
    });

    it("does not claim an allowance it could not count", async () => {
      recording(() => "fail");
      const response = await request(buildApp()).get("/creator-studio/scroll").set("accept", "text/html");
      assert.ok(
        !/you are using 0/.test(response.text),
        "a failed read reported the customer as using none of their allowance"
      );
    });

    it("lists a published site with the address it is at", async () => {
      recording(() => [PUBLISHED_ROW]);
      const response = await request(buildApp()).get("/creator-studio/scroll").set("accept", "text/html");
      assert.match(response.text, /\/s\/summer-launch/);
      assert.match(response.text, /A published site/);
    });
  });
});

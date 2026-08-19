"use strict";

// Publishing one saved result, and the four things that must not come with it.
//
// module_outputs is organization-scoped and read with the service-role key,
// which bypasses RLS -- so the organization filter in the query is the entire
// tenant boundary, and a public page has no organization to filter by. That is
// the whole risk in this feature, and it is why the shared page selects a fixed
// column list containing no identifier of any kind rather than selecting the row
// and rendering part of it.
//
// The assertions below are split deliberately between two kinds. "The page did
// not contain the organization id" can be true because the render dropped it, a
// lookup failed, or the fixture was thin. "The application never asked for the
// organization id" is the property worth holding, and the fake Supabase records
// every query so it can be asserted directly.

const assert = require("node:assert/strict");
const request = require("supertest");

const shared = require("../lib/sonara-shared-results.cjs");
const { createFakeSupabase } = require("./helpers/fake-supabase.cjs");
const { renderShareControl, renderSavedOutputCards } = require("../lib/sonara-module-crud.cjs");

const ORG = "aaaaaaaa-0000-0000-0000-00000000000a";
const OTHER_ORG = "bbbbbbbb-0000-0000-0000-00000000000b";
const USER = "11111111-0000-0000-0000-000000000001";
const RESULT_ID = "cccccccc-0000-0000-0000-00000000000c";
const OTHER_RESULT_ID = "dddddddd-0000-0000-0000-00000000000d";
const TOKEN = "aBcDeFgHiJkLmNoPqRsTuVwXyZ012345";

// Distinctive enough that finding one in a page is unambiguous.
const SECRET_INPUT = "RENT-IS-4200-A-MONTH";
const PUBLISHED_ANSWER = "You cover your costs at 420 sales a month.";

function seed() {
  return {
    organizations: [{ id: ORG, name: "Shared Co", slug: "shared-co" }],
    organization_memberships: [
      { id: "mem-1", organization_id: ORG, user_id: USER, status: "active", role: "owner", created_at: "2026-01-01" }
    ],
    module_outputs: [
      {
        id: RESULT_ID,
        organization_id: ORG,
        product_key: "business_builder",
        module_key: "break_even",
        input_payload: { fixedCosts: SECRET_INPUT },
        output_payload: { summary: PUBLISHED_ANSWER, unitsPerMonth: 420 },
        share_token: TOKEN,
        shared_at: "2026-08-19T10:00:00.000Z",
        created_at: "2026-08-19T09:00:00.000Z"
      },
      {
        id: OTHER_RESULT_ID,
        organization_id: OTHER_ORG,
        product_key: "business_builder",
        module_key: "break_even",
        input_payload: {},
        output_payload: { summary: "Somebody else's answer." },
        share_token: null,
        shared_at: null,
        created_at: "2026-08-19T09:00:00.000Z"
      }
    ]
  };
}

describe("a shared result is a link, not a leak", () => {
  describe("the token", () => {
    it("is long enough that guessing one is not a strategy", () => {
      const token = shared.mintShareToken();
      assert.match(token, shared.SHARE_TOKEN_PATTERN);
      // 32 base64url characters is 192 bits. The link is the only credential --
      // there is nothing behind it to check, because the point is that a person
      // with no account can open it.
      assert.equal(token.length, 32);
    });

    it("does not repeat", () => {
      const minted = new Set();
      for (let index = 0; index < 2000; index += 1) minted.add(shared.mintShareToken());
      assert.equal(minted.size, 2000, "two mints collided, so this is not random");
    });

    it("refuses everything that is not one, including the empty string", () => {
      // `share_token=eq.` with nothing after it is a filter that matches rows
      // whose token is empty rather than a filter that matches none. Same shape
      // of mistake as an organization filter with nothing after the eq.
      for (const bad of ["", " ", "short", "a".repeat(31), "a".repeat(33), `${TOKEN}&limit=99`, `${TOKEN}.`, "../../etc", null, undefined, 12345, {}]) {
        assert.equal(shared.isShareToken(bad), false, `accepted ${JSON.stringify(bad)}`);
      }
      assert.equal(shared.isShareToken(TOKEN), true, "rejected a well-formed token, so every check above is vacuous");
    });

    it("builds a path only from a token it accepts", () => {
      assert.equal(shared.sharePath(TOKEN), `/shared/${TOKEN}`);
      assert.equal(shared.sharePath(""), null);
      assert.equal(shared.sharePath("short"), null);
    });
  });

  describe("the column list", () => {
    it("names no identifier and no input", () => {
      assert.ok(shared.SHARED_SELECT_COLUMNS.length > 0, "an empty select list would make every check here vacuous");
      for (const forbidden of shared.FORBIDDEN_SHARED_COLUMNS) {
        assert.ok(
          !shared.SHARED_SELECT_COLUMNS.includes(forbidden),
          `${forbidden} is in the list a public page selects`
        );
      }
    });

    it("is what the route actually selects", () => {
      // The list above is only a boundary if the route uses it. A select spelled
      // inline at the call site would drift from this and nothing would say so.
      const source = require("node:fs").readFileSync(require.resolve("../routes/sonara-shared-result-routes.cjs"), "utf8");
      assert.match(source, /SHARED_SELECT_COLUMNS\.join\(","\)/, "the shared page does not select through the reviewed column list");
      assert.doesNotMatch(source, /select=\*/, "the shared page selects every column somewhere");
    });

    it("drops an identifier even when the row carries one", () => {
      // Belt and braces: if a future select widens, the view still refuses to
      // surface what it must not.
      const view = shared.sharedResultView({
        id: RESULT_ID,
        organization_id: ORG,
        user_id: USER,
        module_key: "break_even",
        product_key: "business_builder",
        input_payload: { fixedCosts: SECRET_INPUT },
        output_payload: { summary: PUBLISHED_ANSWER },
        created_at: "2026-08-19T09:00:00.000Z"
      });
      const rendered = JSON.stringify(view);
      for (const secret of [ORG, USER, RESULT_ID, SECRET_INPUT]) {
        assert.ok(!rendered.includes(secret), `the view carries ${secret}`);
      }
      assert.ok(rendered.includes(PUBLISHED_ANSWER), "the view dropped the answer too, so the check above proves nothing");
    });

    it("shows the flat values and skips the structures", () => {
      const lines = shared.presentableLines({
        summary: "Two hundred covers a month.",
        unitsPerMonth: 200,
        onTrack: true,
        breakdown: { rent: 1200 },
        steps: ["one", "two"],
        essay: "x".repeat(shared.MAX_SHARED_VALUE_LENGTH + 1)
      });
      assert.deepEqual(lines.map((line) => line.label), ["Summary", "Units Per Month", "On Track"]);
      assert.ok(!JSON.stringify(lines).includes("1200"), "a nested structure reached the page");
    });
  });

  describe("the public page", () => {
    let app;
    let fake;
    let savedFetch;
    let savedEnv;

    before(() => {
      savedEnv = {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
      };
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-placeholder";
      process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-placeholder";
      fake = createFakeSupabase({ users: { "token-a": { id: USER, email: "a@example.com" } }, tables: seed() });
      savedFetch = global.fetch;
      global.fetch = fake.install(savedFetch);
      app = require("../server");
    });

    after(() => {
      if (savedFetch) global.fetch = savedFetch;
      for (const [key, value] of Object.entries(savedEnv || {})) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });

    it("opens for somebody with no account at all", async () => {
      const response = await request(app).get(`/shared/${TOKEN}`).set("accept", "text/html").redirects(0);
      assert.equal(response.status, 200, "a shared link that needs an account is not a shared link");
      assert.ok(response.text.includes(PUBLISHED_ANSWER), "the answer it was shared for is not on the page");
    });

    it("says nothing about who shared it or what they typed in", async () => {
      const response = await request(app).get(`/shared/${TOKEN}`).set("accept", "text/html").redirects(0);
      for (const secret of [ORG, USER, RESULT_ID, SECRET_INPUT, "Shared Co"]) {
        assert.ok(!response.text.includes(secret), `the shared page rendered ${secret}`);
      }
    });

    it("never asks the database for an identifier either", async () => {
      fake.reset();
      await request(app).get(`/shared/${TOKEN}`).set("accept", "text/html").redirects(0);
      const reads = fake.queries.filter((query) => query.table === "module_outputs");
      assert.equal(reads.length, 1, `expected one read, saw ${reads.length}`);
      const select = new URLSearchParams(reads[0].search).get("select") || "";
      for (const forbidden of shared.FORBIDDEN_SHARED_COLUMNS) {
        assert.ok(!select.split(",").includes(forbidden), `the shared page asked for ${forbidden}`);
      }
      assert.deepEqual(reads[0].filters.map((filter) => filter.column), ["share_token"], "the shared read filters on something other than the token");
    });

    it("does not open somebody else's result that was never shared", async () => {
      // The other organization's row has share_token null. A filter that matched
      // null -- or an unfiltered read taking the first row -- would serve it.
      const response = await request(app).get(`/shared/${TOKEN.replace(/.$/, "9")}`).set("accept", "text/html").redirects(0);
      assert.equal(response.status, 404);
      assert.ok(!response.text.includes("Somebody else's answer."), "a wrong token served a different result");
    });

    it("answers a revoked link exactly as it answers a made-up one", async () => {
      // Telling them apart would tell somebody guessing that they had guessed a
      // token which used to exist, and would tell a recipient that the person
      // who shared it took it back -- which is that person's news to give.
      const madeUp = await request(app).get("/shared/zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz").set("accept", "text/html").redirects(0);
      const wrongShape = await request(app).get("/shared/nope").set("accept", "text/html").redirects(0);
      assert.equal(madeUp.status, 404);
      assert.equal(wrongShape.status, 404);
      assert.equal(madeUp.text, wrongShape.text, "the two refusals read differently, so one of them is informative");
    });

    it("has an explainer for whoever trims the link", async () => {
      const response = await request(app).get("/shared").set("accept", "text/html").redirects(0);
      assert.equal(response.status, 200);
      assert.match(response.text, /shared a result with you/i);
    });
  });

  describe("turning it on and taking it back", () => {
    let app;
    let fake;
    let savedFetch;
    let savedEnv;

    beforeEach(() => {
      savedEnv = {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
      };
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-placeholder";
      process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-placeholder";
      fake = createFakeSupabase({ users: { "token-a": { id: USER, email: "a@example.com" } }, tables: seed() });
      savedFetch = global.fetch;
      global.fetch = fake.install(savedFetch);
      app = require("../server");
    });

    afterEach(() => {
      if (savedFetch) global.fetch = savedFetch;
      for (const [key, value] of Object.entries(savedEnv || {})) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });

    it("refuses a stranger", async () => {
      const response = await request(app)
        .post(`/api/shared-results/${OTHER_RESULT_ID}/share`)
        .set("accept", "application/json")
        .send({});
      assert.notEqual(response.status, 200, "anybody could publish anybody's result");
      assert.ok([401, 403, 303].includes(response.status), `unexpected refusal status ${response.status}`);
      assert.equal(fake.rows("module_outputs").find((row) => row.id === OTHER_RESULT_ID)?.share_token, null);
    });

    it("does not publish a result belonging to another organization", async () => {
      const response = await request(app)
        .post(`/api/shared-results/${OTHER_RESULT_ID}/share`)
        .set("accept", "application/json")
        .set("Authorization", "Bearer token-a")
        .send({});
      assert.equal(response.status, 404, `a signed-in customer got ${response.status} for another tenant's row`);
      assert.equal(fake.rows("module_outputs").find((row) => row.id === OTHER_RESULT_ID)?.share_token, null, "another organization's result was published");
    });

    it("scopes every write by organization as well as by id", async () => {
      fake.reset();
      await request(app)
        .post(`/api/shared-results/${RESULT_ID}/revoke`)
        .set("accept", "application/json")
        .set("Authorization", "Bearer token-a")
        .send({});
      const writes = fake.queries.filter((query) => query.table === "module_outputs" && query.method === "PATCH");
      assert.ok(writes.length >= 1, "no write was issued, so this check is vacuous");
      for (const write of writes) {
        const columns = write.filters.map((filter) => filter.column).sort();
        assert.deepEqual(columns, ["id", "organization_id"], `a write filtered on ${columns.join(", ")}`);
      }
    });

    it("takes a shared result back, and the link stops opening", async () => {
      const revoked = await request(app)
        .post(`/api/shared-results/${RESULT_ID}/revoke`)
        .set("accept", "application/json")
        .set("Authorization", "Bearer token-a")
        .send({});
      assert.equal(revoked.status, 200);
      assert.equal(revoked.body.code, "revoked");
      const row = fake.rows("module_outputs").find((entry) => entry.id === RESULT_ID);
      assert.equal(row.share_token, null, "the token survived the revoke");
      // Kept on purpose: it is what lets the page say "this was shared before".
      assert.ok(row.shared_at, "revoking erased the record that it was ever shared");

      const after = await request(app).get(`/shared/${TOKEN}`).set("accept", "text/html").redirects(0);
      assert.equal(after.status, 404, "a revoked link still opens");
    });

    it("keeps the existing link when the same result is shared twice", async () => {
      // A fresh token on every press would silently break every copy of the old
      // link, and nothing on the page warns that pressing twice does that.
      await request(app).post(`/api/shared-results/${RESULT_ID}/revoke`)
        .set("accept", "application/json").set("Authorization", "Bearer token-a").send({});
      const first = await request(app).post(`/api/shared-results/${RESULT_ID}/share`)
        .set("accept", "application/json").set("Authorization", "Bearer token-a").send({});
      const second = await request(app).post(`/api/shared-results/${RESULT_ID}/share`)
        .set("accept", "application/json").set("Authorization", "Bearer token-a").send({});
      assert.equal(first.status, 200);
      assert.equal(second.status, 200);
      assert.ok(shared.isShareToken(first.body.token), "the first share did not mint a usable token");
      assert.equal(second.body.token, first.body.token, "sharing twice changed the link");
      assert.equal(second.body.code, "already_shared");
    });

    it("sends a browser back to the page it came from, and nowhere off this site", async () => {
      const offsite = await request(app)
        .post(`/api/shared-results/${RESULT_ID}/revoke`)
        .type("form")
        .send({ back: "https://example.com/phish" });
      // A form post with no session is refused before the redirect target
      // matters; what must never happen is a 303 to another origin.
      if (offsite.status === 303) {
        assert.ok(offsite.headers.location.startsWith("/"), `redirected off-site to ${offsite.headers.location}`);
      }
      const onsite = await request(app)
        .post(`/api/shared-results/${RESULT_ID}/revoke`)
        .set("Authorization", "Bearer token-a")
        .type("form")
        .send({ back: "/business-builder/records/free" });
      assert.equal(onsite.status, 303);
      assert.equal(onsite.headers.location, "/business-builder/records/free");
    });
  });

  describe("the control the customer presses", () => {
    it("offers to share a result that is private", () => {
      const html = renderShareControl({ record: { id: RESULT_ID, share_token: null, shared_at: null }, backHref: "/business-builder/records/free" });
      assert.match(html, /Share this result/);
      assert.match(html, new RegExp(`/api/shared-results/${RESULT_ID}/share`));
      assert.ok(!/Stop sharing/.test(html), "a private result offered to stop sharing");
    });

    it("shows the link, in full, for a result that is shared", () => {
      const html = renderShareControl({ record: { id: RESULT_ID, share_token: TOKEN, shared_at: "2026-08-19" }, backHref: "/x" });
      // As text as well as a link: the point of it is that somebody copies it
      // into a message, and a bare anchor gives them nothing to copy.
      assert.ok(html.includes(`>/shared/${TOKEN}<`), "the link is not readable as text");
      assert.match(html, /Stop sharing this/);
    });

    it("says a result was shared before, rather than showing an untouched button", () => {
      const html = renderShareControl({ record: { id: RESULT_ID, share_token: null, shared_at: "2026-08-19" }, backHref: "/x" });
      assert.match(html, /shared before and is private again/i);
      assert.match(html, /Share this result/);
    });

    it("reaches the saved-results list", () => {
      const html = renderSavedOutputCards({
        records: [{ id: RESULT_ID, module_key: "break_even", created_at: "2026-08-19", output_payload: { summary: PUBLISHED_ANSWER }, share_token: null, shared_at: null }],
        productLabel: "Business Builder",
        backHref: "/business-builder/records/free"
      });
      assert.match(html, /Share this result/, "the share control never reaches the page a customer looks at");
      assert.match(html, /never the figures you typed in/, "the list does not say what sharing gives away");
    });
  });
});

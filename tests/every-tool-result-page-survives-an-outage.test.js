"use strict";

// Every free tool, submitted, with every write failing.
//
// `tests/no-page-lies-when-the-database-is-down.test.js` crawls 150+ pages with
// the database answering nothing — and it only ever issues GETs. The pages a
// customer sees *after pressing a button* were never crawled at all, and that is
// where the last two defects in this branch lived:
//
//   * "Reference ID: null." rendered on every unsaved tool result, because a fix
//     correctly stopped inventing a reference and the template printed the null
//     through String() anyway
//   * "Save requires account database setup." stated a cause that is false when
//     the workspace is finished and the write failed underneath it
//
// Both were found by hand, on one tool, because somebody happened to look. There
// are fifteen.
//
// The workspace here is fully set up: the session resolves, the membership read
// answers, the environment is configured. Only the writes fail. That is the
// state a real customer is in during an outage, and it is the state where a
// result page has the most to get wrong — the tool worked, so there is an answer
// to show, and the save did not, so there is bad news to deliver alongside it.

const assert = require("node:assert/strict");
const request = require("supertest");

const SUPABASE_ENV = Object.freeze({
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-anon-key-for-tool-crawl",
  SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-service-role-for-tool-crawl"
});
const original = Object.fromEntries(Object.keys(SUPABASE_ENV).map((key) => [key, process.env[key]]));

const app = require("../server");

const USER = { id: "77777777-7777-4777-8777-777777777777", email: "tool-crawl@example.com" };
const ORGANIZATION_ID = "88888888-8888-4888-8888-888888888888";

// Same four tokens as the GET crawl. None is a word this product's copy uses, so
// any of them in visible text is a value the page failed to work out.
const PLACEHOLDER_LEAK = /(?:\[object Object\]|\bundefined\b|\bNaN\b|\bnull\b)/;
const PLACEHOLDER_LEAK_ALL = new RegExp(PLACEHOLDER_LEAK.source, "g");

// The same value in every field, and that value is a number.
//
// The first draft guessed from the field name -- numbers for anything matching
// /cost|price|rate|.../ and prose otherwise -- and got `visitors`, `leads` and
// `customers` wrong, so the KPI calculator correctly refused the submission with
// a 400 and this file reported its own bad input as a missing page. A heuristic
// per field name is a thing that drifts silently the moment somebody adds the
// sixteenth tool.
//
// "12" satisfies both kinds: the calculators parse it, and the text tools accept
// it as free text. What this file is checking is what the page says when the
// save fails, and that does not depend on the words in the boxes.
function bodyFor(tool) {
  const body = {};
  for (const field of [...tool.fields, ...tool.requiredFields]) body[field] = "12";
  return body;
}

// Signed in, workspace resolved, every write refused.
function stubFetch() {
  const json = (value) => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => value });
  return async (url, options = {}) => {
    const target = String(url);
    if (target.includes("/auth/v1/user")) return json(USER);
    if (String(options.method || "GET").toUpperCase() !== "GET") {
      return { ok: false, status: 500, headers: { get: () => null }, json: async () => ({}) };
    }
    if (target.includes("/rest/v1/organization_memberships")) return json([{ organization_id: ORGANIZATION_ID }]);
    if (target.includes("/rest/v1/billing_entitlements")) {
      const asked = decodeURIComponent((target.match(/entitlement_key=in\.\(([^)]*)\)/) || ["", ""])[1]).split(",").filter(Boolean);
      return json(asked[0] ? [{ entitlement_key: asked[0], status: "active" }] : []);
    }
    return { ok: false, status: 500, headers: { get: () => null }, json: async () => ({}) };
  };
}

function visibleText(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
}

describe("every tool result page survives an outage", () => {
  const tools = app.locals.sonaraFreeTools || [];
  const leaks = [];
  const missingOutput = [];
  const blamedSetup = [];
  let submitted = 0;
  let realFetch;

  before(async function submitEveryTool() {
    this.timeout(120000);
    Object.assign(process.env, SUPABASE_ENV);
    realFetch = global.fetch;
    global.fetch = stubFetch();

    for (const tool of tools) {
      const response = await request(app)
        .post(tool.path)
        .set("Authorization", "Bearer customer-session")
        .set("Accept", "text/html")
        .type("form")
        .send(bodyFor(tool));

      // 503 is the honest answer for a write that stored nothing; the page still
      // renders. Anything else means the submission never reached the tool, and
      // this file would be measuring its own request rather than the page.
      if (![200, 503].includes(response.status)) {
        missingOutput.push(`${tool.path} answered ${response.status}, so nothing was rendered to check`);
        continue;
      }
      submitted += 1;
      const visible = visibleText(response.text);

      for (const match of visible.matchAll(PLACEHOLDER_LEAK_ALL)) {
        const context = visible.slice(Math.max(0, match.index - 70), match.index + 70);
        leaks.push(`${tool.path} shows "${match[0]}" in: ${context.trim().slice(0, 130)}`);
      }

      // The tool worked. Losing its answer to a save failure would be a worse
      // product than any wording problem on the same page.
      if (!/result/i.test(visible)) missingOutput.push(`${tool.path} rendered no result at all`);

      // The workspace is configured and the membership read answered. Telling
      // this customer to go and finish setup sends them somewhere with nothing
      // to do.
      if (/requires account database setup/i.test(visible)) blamedSetup.push(tool.path);
    }
  });

  after(() => {
    global.fetch = realFetch;
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("submitted every tool, so the checks below have something to read", () => {
    assert.ok(tools.length >= 10, `only ${tools.length} free tools exposed; the crawl has gone blind`);
    assert.equal(submitted, tools.length, `only ${submitted} of ${tools.length} tools rendered a page`);
  });

  it("prints no value it failed to work out", () => {
    assert.deepEqual(leaks, [], "a tool result page showed a JavaScript placeholder where a value should have been");
  });

  it("still shows the customer the answer the tool produced", () => {
    assert.deepEqual(missingOutput, [], "a tool lost its own output because the save failed");
  });

  it("does not blame setup for a write that failed under a finished workspace", () => {
    assert.deepEqual(blamedSetup, [], "these pages sent a fully set-up customer to a setup page");
  });

  it("would recognise a placeholder if one appeared", () => {
    for (const sentence of ["Reference ID: null.", "Saved undefined records.", "Total: NaN", "Owner: [object Object]"]) {
      assert.match(sentence, PLACEHOLDER_LEAK, `the pattern no longer recognises "${sentence}"`);
    }
    assert.doesNotMatch("Your annulled booking was refunded in full.", PLACEHOLDER_LEAK);
  });
});

"use strict";

// A free tool always shows its output. Whether it was *saved* is a separate
// question, and the result page answers it in a card.
//
// Two things were wrong with the unsaved card, one of them mine.
//
// **"Reference ID: null".** `saveModuleOutput` used to mint a reference with
// randomUUID() when nothing had been written — a number identifying no row
// anywhere — and that was fixed by returning null instead. `sendToolResult`
// printed the value unconditionally, so the fix turned a misleading reference
// into the literal string "null" on a customer-facing page. No test rendered
// that page, so nothing objected. A reference number for unsaved work should
// not be shown at all, which is what the page beside it (`sendWorkspacePostResult`)
// already does.
//
// **"Save requires account database setup."** stated a cause. It is true when
// the workspace is genuinely unconfigured and false when a read failed —
// `workspace_unreadable` and `records_unavailable` both arrive here, and both
// told the customer to go and finish a setup that is already finished.
//
// And a JSON caller got HTTP 200 with `ok: true` for a write that saved
// nothing, while the two sibling endpoints answer 503 with `ok: false` for the
// same failure. One product, one kind of failure, two answers.

const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../server");

const SUPABASE_KEYS = ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
const CUSTOMER_USER = { id: "00000000-0000-0000-0000-000000000301", email: "tools@example.com" };
const ORGANIZATION_ID = "00000000-0000-0000-0000-00000000ac01";
const INPUT = { costBasis: "100", hoursPerUnit: "2", hourlyRate: "50", targetMargin: "50" };

function snapshotEnv() {
  return Object.fromEntries(SUPABASE_KEYS.map((key) => [key, process.env[key]]));
}

// Signed in, with a workspace, and every write failing. That is the state this
// file is about: the customer is set up, and the save did not happen anyway.
function stubFetch() {
  return async (url) => {
    const address = String(url);
    if (address.includes("/auth/v1/user")) return { ok: true, json: async () => CUSTOMER_USER };
    if (address.includes("/rest/v1/organization_memberships")) return { ok: true, json: async () => [{ organization_id: ORGANIZATION_ID }] };
    return { ok: false, status: 500, json: async () => [] };
  };
}

// `.send(object)` sets Content-Type: application/json, and this application
// reads that as "answer me in JSON" regardless of Accept. The first draft of
// this file asked for text/html that way and got JSON back, so its two
// page-content assertions passed against a body that has no page in it at all.
// The HTML case has to post a form, the way a browser does.
function runPage() {
  return request(app)
    .post("/business-builder/tools/pricing")
    .set("Authorization", "Bearer customer-session")
    .set("Accept", "text/html")
    .type("form")
    .send(INPUT);
}

function runJson() {
  return request(app)
    .post("/business-builder/tools/pricing")
    .set("Authorization", "Bearer customer-session")
    .set("Accept", "application/json")
    .send(INPUT);
}

describe("an unsaved tool result does not print null", () => {
  let snapshot;
  let originalFetch;

  beforeEach(() => {
    snapshot = snapshotEnv();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-placeholder";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-placeholder";
    originalFetch = global.fetch;
    global.fetch = stubFetch();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    for (const [key, value] of Object.entries(snapshot)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  // The whole point of a free tool: the answer is shown whether or not it could
  // be filed. Asserted first, so nothing below is green against a page that
  // stopped working.
  it("still shows the output it worked out", async () => {
    const response = await runPage();
    assert.match(response.text, /\$400\.00/, "the customer lost the result the tool exists to produce");
  });

  it("shows no reference number at all when nothing was saved", async () => {
    const response = await runPage();
    assert.doesNotMatch(response.text, /Reference ID:\s*null/i, "the page printed the literal string null at the customer");
    assert.doesNotMatch(response.text, /Reference ID/, "a reference number was shown for work that was not saved");
  });

  it("does not blame setup for a save that failed for another reason", async () => {
    // The workspace here is configured and the membership read succeeds; it is
    // the write that fails. Telling this customer to finish account setup sends
    // them to a page where there is nothing to do.
    const response = await runPage();
    assert.doesNotMatch(response.text, /requires account database setup/i);
    assert.match(response.text, /could not be saved/i);
  });

  it("answers a JSON caller the way its sibling endpoints do", async () => {
    const response = await runJson();
    assert.equal(response.status, 503, "a write that saved nothing answered 200");
    assert.equal(response.body.ok, false, "ok: true for a write that saved nothing");
    assert.equal(response.body.saved, false);
    assert.equal(response.body.referenceId, null);
    assert.ok(response.body.output, "the output must survive: the customer still gets their answer");
  });
});

"use strict";

// Every page, rendered with every data read failing.
//
// tests/signed-in-workspace-crawl.test.js crawls with the database answering
// and empty, which is the state a new customer is in. This crawls with the
// database answering nothing at all, which is the state everybody is in for the
// few minutes a year it happens -- and it is the state where a page is most
// likely to tell a customer something false about their own records.
//
// Four were found the first time it ran:
//
//   * all three workspace dashboards said "No activity yet." -- the read
//     outcome was dropped before the card saw it, while countLabel beside it
//     already answered "unavailable", so the two halves of the same card
//     disagreed about what a failure looks like
//   * the billing panel said "No active paid plan found." to a paying customer,
//     which is the one place in the product where being wrong in that direction
//     costs a cancellation
//   * "No areas yet" and "No consent records yet" were card headings printed
//     above bodies explaining the read had failed; a customer skims headings,
//     and a creator reading the second one could reasonably conclude a recorded
//     permission had been lost
//
// The session and the organization still resolve. Only the data fails, because
// a page that cannot identify the customer has a different and already-tested
// answer.

const assert = require("node:assert/strict");
const request = require("supertest");

const SUPABASE_ENV = Object.freeze({
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-anon-key-for-outage",
  SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-service-role-for-outage"
});
const original = Object.fromEntries(Object.keys(SUPABASE_ENV).map((key) => [key, process.env[key]]));

const app = require("../server");
const { CUSTOMER_SESSION_COOKIE } = require("../lib/sonara-customer-auth.cjs");
const { ROUTE_REGISTRY } = require("../lib/sonara-route-registry.cjs");

const USER = { id: "33333333-3333-4333-8333-333333333333", email: "outage@example.com" };
const ORGANIZATION_ID = "44444444-4444-4444-8444-444444444444";

const json = (body, status = 200) => ({ ok: status < 400, status, headers: { get: () => null }, json: async () => body });
const unreachable = () => ({ ok: false, status: 500, headers: { get: () => null }, json: async () => ({}) });

function stubFetch() {
  return async (url) => {
    const target = String(url);
    if (target.includes("/auth/v1/user")) return json(USER);
    if (target.includes("/rest/v1/rpc/")) return json({});
    if (!target.includes("/rest/v1/")) return undefined;
    const table = (target.split("/rest/v1/")[1] || "").split("?")[0];
    // Identity resolves; everything about the customer's own records does not.
    if (table === "organization_memberships") return json([{ organization_id: ORGANIZATION_ID, user_id: USER.id, role: "owner", status: "active" }]);
    if (table === "business_memberships") return json([{ id: "m", organization_id: ORGANIZATION_ID, workspace_id: "w", role: "owner", status: "active" }]);
    if (table === "organizations") return json([{ id: ORGANIZATION_ID, name: "Outage Ltd" }]);
    if (table === "billing_entitlements") {
      const asked = decodeURIComponent((target.match(/entitlement_key=in\.\(([^)]*)\)/) || ["", ""])[1]).split(",").filter(Boolean);
      return json(asked[0] ? [{ entitlement_key: asked[0], status: "active" }] : []);
    }
    return unreachable();
  };
}

// A sentence claiming the customer has none of something.
const CLAIMS_EMPTY = /(no |nothing |not added |have not )[^.]{0,60}(yet|here|anybody|any )/i;
const CLAIMS_EMPTY_ALL = new RegExp(CLAIMS_EMPTY.source, "gi");

// Prose that matches the pattern and is not a claim about the customer's
// records. Each says why it is allowed to stay.
const NOT_A_CLAIM_ABOUT_RECORDS = [
  [/no guarantee of revenue/i, "The earnings disclaimer. A statement about what is not promised, not about what is stored."],
  [/nothing here has been changed/i, "The assistant pages, saying they only read and link. A safety statement about the page's own behaviour."],
  [/nothing is sent from here/i, "Campaigns, saying no message leaves without authorization. Same kind of statement."],
  [/nothing is sent to anybody/i, "The consent page, saying suppression is honoured. Same."],
  [/nothing runs on its own/i, "Staff check-ins, saying nothing tracks in the background."],
  [/nothing writes them yet/i, "Food costs, stating honestly that the daily figures are not calculated."],
  [/nothing here reflects your plan/i, "The billing panel's own failure wording, added by this check's first run."],
  [/no reviews are published/i, "Proof and review publishing is owner-gated; a statement of policy."],
  [/nothing here has been sent/i, "Chase drafts, saying a draft is not a message. A statement about what the page does not do."],
  [/nothing here publishes anything on its own/i, "The release calendar, saying it schedules rather than publishes."]
];

function excused(context) {
  return NOT_A_CLAIM_ABOUT_RECORDS.some(([pattern]) => pattern.test(context));
}

describe("no page lies when the database is down", () => {
  let realFetch;
  const findings = [];
  let rendered = 0;

// A value the page meant to print and could not.
//
// "Reference ID: null." reached a customer-facing page on 17 August, because a
// fix correctly stopped inventing a reference for unsaved work and the template
// printed the null through String() anyway. Nothing objected: the coverage read
// the JSON body, and the page-level assertions checked for the *presence* of the
// string "Reference ID", which "null" satisfies.
//
// These four tokens are what a JavaScript template produces when the value
// behind it is missing. None of them is a word this product's copy would ever
// use, so any appearance in visible page text is a defect rather than a style
// question. Checked over the same stripped text as the claims above, which is
// what a customer actually reads -- attribute values, class names and inline
// data are none of this check's business.
// Two copies, the same way CLAIMS_EMPTY and CLAIMS_EMPTY_ALL are two copies.
// A /g regex carries lastIndex between calls, so the first draft of the
// recognition test below matched its first sentence, resumed from that offset
// for the second, and reported that the pattern had stopped working. The check
// written to prove this check works is the thing that caught it.
const PLACEHOLDER_LEAK = /(?:\[object Object\]|\bundefined\b|\bNaN\b|\bnull\b)/;
const PLACEHOLDER_LEAK_ALL = new RegExp(PLACEHOLDER_LEAK.source, "g");
const leaks = [];

  before(async function crawl() {
    this.timeout(180000);
    Object.assign(process.env, SUPABASE_ENV);
    realFetch = global.fetch;
    global.fetch = stubFetch();

    const routes = ROUTE_REGISTRY
      .filter((entry) => entry.method === "GET" && !entry.route.includes(":"))
      .map((entry) => entry.route);

    for (const route of routes) {
      let response;
      try {
        response = await request(app).get(route).set("Accept", "text/html").set("Cookie", `${CUSTOMER_SESSION_COOKIE}=stub`).redirects(0);
      } catch (error) {
        findings.push(`${route} threw with the database down: ${error.message}`);
        continue;
      }
      if (response.status !== 200) continue;
      rendered += 1;
      const visible = String(response.text || "")
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ");
      // Excused against the surrounding sentence rather than the matched
      // fragment. CLAIMS_EMPTY matches as few words as it can, so "nothing
      // here reflects your plan" arrives as "nothing here" and no excuse for
      // the longer phrase could ever fire.
      // Every match on the page, not the first. The first version stopped at
      // one, so a page whose opening safety statement is excused could carry a
      // real claim further down and never be looked at -- a check that goes
      // blind exactly where a page has the most to say.
      for (const match of visible.matchAll(CLAIMS_EMPTY_ALL)) {
        const context = visible.slice(Math.max(0, match.index - 60), match.index + 140);
        if (!excused(context)) findings.push(`${route} says "${match[0].trim()}" in: ${context.trim().slice(0, 120)}`);
      }

      for (const match of visible.matchAll(PLACEHOLDER_LEAK_ALL)) {
        const context = visible.slice(Math.max(0, match.index - 70), match.index + 70);
        leaks.push(`${route} shows "${match[0]}" in: ${context.trim().slice(0, 130)}`);
      }
    }
  });

  after(() => {
    global.fetch = realFetch;
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("rendered enough pages to be measuring something", () => {
    assert.ok(rendered >= 150, `only ${rendered} pages rendered with the database down; the crawl has gone blind`);
  });

  it("prints no value it failed to work out", () => {
    assert.deepEqual(
      leaks,
      [],
      "a page showed a JavaScript placeholder where a value should have been; the customer reads that as part of the sentence"
    );
  });

  it("would recognise a placeholder if one appeared", () => {
    // The assertion above passes by finding nothing, which is also what it does
    // when the pattern has stopped matching. This is the difference.
    for (const sentence of ["Reference ID: null.", "Saved undefined records.", "Total: NaN", "Owner: [object Object]"]) {
      assert.match(sentence, PLACEHOLDER_LEAK, `the pattern no longer recognises "${sentence}"`);
    }
    assert.doesNotMatch("Your annulled booking was refunded in full.", PLACEHOLDER_LEAK, "the pattern matches ordinary prose");
  });

  it("tells nobody they have no records when the records could not be read", () => {
    assert.deepEqual(
      findings,
      [],
      `these pages report an empty state while every read is failing:\n  ${findings.join("\n  ")}\n\n` +
        "Carry the read outcome to the card, or add the phrase to NOT_A_CLAIM_ABOUT_RECORDS with the reason it is not about the customer's records."
    );
  });

  it("gives every excused phrase a real reason", () => {
    assert.ok(NOT_A_CLAIM_ABOUT_RECORDS.length >= 5, "the excuse list has been emptied rather than earned");
    for (const [, reason] of NOT_A_CLAIM_ABOUT_RECORDS) {
      assert.ok(String(reason).length >= 40, "an excused phrase needs a stated reason, not a placeholder");
    }
  });

  // The pattern has to match something, or the crawl above proves nothing.
  it("would recognise the claim it is looking for", () => {
    for (const sentence of ["No activity yet.", "You have not added anybody yet.", "Nothing here yet.", "No consent records yet"]) {
      assert.match(sentence, CLAIMS_EMPTY, `the pattern no longer recognises "${sentence}"`);
    }
    assert.ok(excused("No guarantee of revenue"), "the excuse list is not being consulted");
  });
});

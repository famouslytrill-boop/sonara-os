"use strict";

// A share link publishes a `module_outputs` row to anybody holding the URL.
// `lib/sonara-shared-results.cjs` forbids two columns on that read:
//
//   forbidden: Object.freeze(["input_payload", "user_id"]),
//
// and `tests/a-shared-link-is-a-link-not-a-leak.test.js` asserts the select
// against that list, so the *columns* are held. **That is not the same
// guarantee as "what the customer typed is never published", and the first
// reads like the second.**
//
// Two facts make the difference matter:
//
//   1. `presentableLines()` publishes **every scalar key** in `output_payload`.
//      Not a declared subset -- whatever happens to be in the blob.
//   2. A share link can be made for any `module_outputs` row in the caller's
//      organization, whatever its `module_key`. `owned()` in
//      routes/sonara-shared-result-routes.cjs checks ownership and the resource
//      type, and `module_output` covers the whole table.
//
// So the row written by POST /api/growth-studio/leads -- whose input is a real
// person's name and email address -- is shareable, and whatever its
// `output_payload` contains becomes public. Today that payload is a fixed
// two-key object carrying neither. **Nothing enforces that.** A later edit
// adding `name: req.body.name` so the workspace card reads better would publish
// a lead's name through every existing share link, and the forbidden-column
// list would still be green: it guards columns, and this would arrive inside
// output_payload.
//
// This file drives the four real endpoints that save a module output and
// asserts, against what was actually written, that nothing the caller supplied
// comes back out through the public renderer. The inputs are distinctive
// strings so that a match is a match rather than a coincidence.
//
// Checked and *not* a defect, recorded so nobody redoes it: the asset catalogue
// deliberately copies `title` into its output, and that is right -- the title is
// the thing being shared. It is listed as a permitted echo rather than handled
// by making the check weaker.

const assert = require("node:assert/strict");
const request = require("supertest");

const shared = require("../lib/sonara-shared-results.cjs");

const ORG = "00000000-0000-0000-0000-0000000000a1";
const USER = "00000000-0000-0000-0000-0000000000a2";

// Distinctive on purpose. "Alex" would match prose in a footnote; these cannot
// turn up in an output payload by chance.
const SECRETS = Object.freeze({
  name: "Zsofia Quintrell-Vasquez",
  email: "zsofia.quintrell@private-fixture.example",
  audience: "left-handed harpsichord restorers in Reykjavik",
  offer: "a nine-week gilding retainer",
  rightsNotes: "assigned by deed on 14 March, contract QV-88213",
  priceIdea: "743 pounds a month",
  deliverables: "one gilded harpsichord lid"
});

// Values a module may legitimately copy into its output, and why.
//
// The rule this file holds is **not** "nothing the caller typed may be
// published". That rule would be wrong, and writing this test is what made the
// difference clear: an offer page that does not say what the offer is or who it
// is for has no reason to exist. The rule is that **no third party's personal
// data may be published**, and the one module whose input carries a third
// party -- lead_follow_up, which takes a real person's name and email -- echoes
// nothing at all. That is the guarantee, and it is asserted twice below.
//
// Everything listed here is the owner's own description of their own offer or
// market, in a page the owner pressed Share on. Each was checked against the
// builder that produces it rather than assumed:
//
//   buildCreatorOffer  (lib/sonara-offer-drafts.cjs:64)
//   buildCampaignPlan  (server.js:3158)
//
// A field appearing here that is not in one of those two is a finding.
const PERMITTED_ECHOES = Object.freeze({
  // The title is the thing being shared; a share page without one is worse.
  "creator_studio/asset_catalog": ["title"],
  // buildCreatorOffer copies offerType, audience, deliverables and priceIdea
  // (as pricePosition). All four are what an offer *is*.
  "creator_studio/creator_offers": ["audience", "deliverables", "priceIdea"],
  // buildCampaignPlan copies goal, audience, offer, channel and timeline. Same
  // reasoning: a shared campaign plan that names none of them says nothing.
  "growth_studio/campaign_workspace": ["audience", "offer"]
});

function capture() {
  const written = [];
  const previous = global.fetch;
  global.fetch = async (url, options = {}) => {
    const target = String(url);
    const method = String(options.method || "GET").toUpperCase();
    if (target.includes("/auth/v1/user")) {
      return { ok: true, status: 200, json: async () => ({ id: USER, email: "owner@example.com" }) };
    }
    if (target.includes("/organization_members")) {
      return { ok: true, status: 200, json: async () => [{ organization_id: ORG }] };
    }
    if (target.includes("/module_outputs") && method === "POST") {
      written.push(JSON.parse(String(options.body)));
      return { ok: true, status: 201, json: async () => [{ id: "mo-1" }] };
    }
    if (method === "POST") return { ok: true, status: 201, json: async () => [{ id: "row-1" }] };
    return { ok: true, status: 200, json: async () => [] };
  };
  return { written, restore: () => { global.fetch = previous; } };
}

/** Every scalar a stranger would see, exactly as the public page renders it. */
function publishedValues(outputPayload) {
  return shared.presentableLines(outputPayload).map((line) => String(line.value));
}

const CASES = [
  {
    path: "/api/creator-studio/assets",
    key: "creator_studio/asset_catalog",
    body: { title: "Launch photo set", type: "image", platform: "site", status: "ready", rightsNotes: SECRETS.rightsNotes }
  },
  {
    path: "/api/creator-studio/offers",
    key: "creator_studio/creator_offers",
    body: { offerType: "retainer", audience: SECRETS.audience, deliverables: [SECRETS.deliverables], priceIdea: SECRETS.priceIdea }
  },
  {
    path: "/api/growth-studio/campaigns",
    key: "growth_studio/campaign_workspace",
    body: { goal: "book consults", audience: SECRETS.audience, offer: SECRETS.offer, channel: "email", timeline: "14 days" }
  },
  {
    path: "/api/growth-studio/leads",
    key: "growth_studio/lead_follow_up",
    body: { name: SECRETS.name, email: SECRETS.email, source: "website", consentStatus: "explicit" }
  }
];

describe("what a module saves is what a stranger can read", () => {
  let saved;

  before(async () => {
    saved = {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
    };
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon_placeholder_key_1234567890";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service_role_placeholder_key_1234567890";
    const app = require("../server");

    const live = capture();
    try {
      for (const testCase of CASES) {
        const response = await request(app).post(testCase.path)
          .set("Authorization", "Bearer customer-session")
          .send(testCase.body);
        testCase.status = response.status;
        testCase.row = live.written[live.written.length - 1] || null;
      }
    } finally {
      live.restore();
    }
  });

  after(() => {
    for (const [key, value] of Object.entries(saved || {})) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  describe("the harness is capable of failing", () => {
    it("saved a row for every module, so the checks below are not vacuous", () => {
      for (const testCase of CASES) {
        assert.equal(testCase.status, 200, `${testCase.path} answered ${testCase.status}; nothing was measured`);
        assert.ok(testCase.row, `${testCase.path} wrote no module_outputs row`);
        assert.ok(testCase.row.output_payload, `${testCase.path} wrote no output_payload`);
      }
      assert.equal(CASES.length, 4, "the case list has shrunk; this check has gone blind");
    });

    it("put the marked values into the requests, so a leak would be visible", () => {
      // Without this, "the secret did not appear" can be true because the secret
      // was never sent -- the shape every vacuous leak test has.
      const sent = JSON.stringify(CASES.map((testCase) => testCase.body));
      for (const [field, value] of Object.entries(SECRETS)) {
        assert.ok(sent.includes(value), `${field} was never sent, so nothing tested whether it comes back`);
      }
    });

    it("still stores the input, which is what the forbidden-column list is for", () => {
      // The input is kept: it is the customer's own record of what they typed.
      // The guarantee here is about what the *public* page reads, not about
      // deleting anything, and asserting that stops this file being read as the
      // stronger claim.
      const leads = CASES.find((testCase) => testCase.key === "growth_studio/lead_follow_up");
      assert.equal(leads.row.input_payload.email, SECRETS.email);
      assert.ok(shared.SHAREABLE.module_output.forbidden.includes("input_payload"));
    });
  });

  describe("what the public renderer would publish", () => {
    for (const key of ["creator_studio/asset_catalog", "creator_studio/creator_offers",
      "growth_studio/campaign_workspace", "growth_studio/lead_follow_up"]) {
      it(`carries nothing the caller typed into ${key}, beyond what it declares`, () => {
        const testCase = CASES.find((entry) => entry.key === key);
        const permitted = PERMITTED_ECHOES[key] || [];
        const published = publishedValues(testCase.row.output_payload).join("   ");
        for (const [field, value] of Object.entries(SECRETS)) {
          if (permitted.includes(field)) continue;
          assert.ok(
            !published.includes(value),
            `${key} publishes the caller's ${field} through presentableLines(). A share link on this row would ` +
              "put it in front of anybody holding the URL, and the forbidden-column list would still be green -- " +
              "it guards columns, and this came through inside output_payload"
          );
        }
      });
    }

    it("never publishes a lead's name or email address, whatever else changes", () => {
      // The one that matters, called out on its own and with no permitted-echo
      // list applied to it. Every other module here echoes the owner's own
      // words about their own offer; this one is the only module whose input is
      // somebody else's personal data, and AGENTS.md puts consent and contact
      // data above convenience.
      const leads = CASES.find((testCase) => testCase.key === "growth_studio/lead_follow_up");
      assert.deepEqual(
        PERMITTED_ECHOES["growth_studio/lead_follow_up"],
        undefined,
        "lead_follow_up has been given a permitted-echo list; the module that holds a third party's data is the " +
          "one that must echo nothing"
      );
      const published = publishedValues(leads.row.output_payload).join("   ");
      assert.ok(published.length > 0, "the lead output published nothing at all; this check has gone blind");
      assert.ok(!published.includes(SECRETS.name), "a lead's name is published through a share link");
      assert.ok(!published.includes(SECRETS.email), "a lead's email address is published through a share link");
      // Not just these two: nothing the caller sent at all.
      for (const value of Object.values(SECRETS)) {
        assert.ok(!published.includes(value), `the lead output publishes "${value}", which the caller supplied`);
      }
    });
  });

  describe("the renderer this depends on", () => {
    it("publishes every scalar in the payload, which is why the above is checked at the source", () => {
      // Not an aspiration -- the current behaviour, asserted so that if it ever
      // becomes a declared subset instead, this file is revisited rather than
      // left asserting something weaker than it reads.
      const values = publishedValues({ shown: "a plain value", alsoShown: 42, nested: { hidden: "x" } });
      assert.ok(values.includes("a plain value"));
      assert.ok(values.includes("42"));
      assert.ok(!values.includes("x"), "presentableLines has started publishing nested objects");
    });
  });
});

"use strict";

// The widget a stranger can open, and the four things it must not do.
//
// **Capture against the wrong business.** The service-role key bypasses row
// level security, so the organization_id filter is the entire tenant boundary
// and a public page has no session to derive one from. The resolution order
// answers that: the slug finds one enabled `lead_capture_pages` row, that row
// names the organization, and the profile read, the rules read, the people read
// and the lead finally written are all filtered on it. The visitor never chooses
// an organization -- they are told one by the row its owner published.
//
// **Let a token from one business's widget open another's conversation.** The
// token is the only credential a visitor holds. It is checked against a fixed
// pattern before it reaches a filter, and the row is fetched filtered on the
// organization the slug named as well as on the token.
//
// **Show the visitor the working.** Not the score, not the band, not the profile
// it was scored against, and not who it was routed to. A visitor who could see
// the score would learn what this business is not interested in.
//
// **Report a lead as scored when nothing scored it.** A profile that could not
// be read is not a profile with no criteria, and a routing table that could not
// be read is not a business with no rules.
//
// Assertions come in two kinds, as they do in the booking tests. "The other
// business's lead did not appear" can be true by accident. "Nothing was written"
// and "what was written carries this organization" are the properties worth
// holding, and the fake Supabase records every request so they can be asserted
// directly.

const assert = require("node:assert/strict");
const request = require("supertest");
const { createFakeSupabase } = require("./helpers/fake-supabase.cjs");

const ORG = "a1a1a1a1-0000-4000-8000-0000000000c1";
const OTHER_ORG = "b2b2b2b2-0000-4000-8000-0000000000c2";
const BARE_ORG = "c3c3c3c3-0000-4000-8000-0000000000c3";

const ANA = "d4d4d4d4-0000-4000-8000-0000000000d4";
const BEN = "e5e5e5e5-0000-4000-8000-0000000000e5";

const OTHER_LEAD_NAME = "Nadia Okonkwo";
const OTHER_LEAD_EMAIL = "nadia@private.example.com";

function seed() {
  return {
    organizations: [
      { id: ORG, name: "Bright Plumbing" },
      { id: OTHER_ORG, name: "Somebody Else Ltd" },
      { id: BARE_ORG, name: "Nothing Written Down Ltd" }
    ],
    lead_capture_pages: [
      {
        id: "lcp-1", organization_id: ORG, slug: "bright-plumbing", enabled: true,
        headline: "Talk to Bright Plumbing", greeting: "Two quick questions.", closing: "We will ring you."
      },
      // Reserved and switched off. Reserving an address must not publish it.
      { id: "lcp-2", organization_id: OTHER_ORG, slug: "somebody-else", enabled: false },
      // Live, with no profile behind it: the widget can only ask for contact
      // details, and that has to be visible rather than silently fine.
      { id: "lcp-3", organization_id: BARE_ORG, slug: "bare-business", enabled: true }
    ],
    lead_icp_profiles: [
      {
        id: "icp-1", organization_id: ORG,
        industries: ["plumbing", "heating"], regions: [],
        team_size_min: 5, team_size_max: 200,
        budget_min_cents: null, budget_max_cents: null,
        timeline_days: null, disqualifiers: ["competitor"],
        fit_weight: 40, urgency_weight: 25, engagement_weight: 20, risk_weight: 15
      },
      // The other business scores on something quite different, so a leak would
      // be visible rather than coincidentally identical.
      {
        id: "icp-2", organization_id: OTHER_ORG,
        industries: ["florist"], regions: ["AU"],
        team_size_min: null, team_size_max: null,
        budget_min_cents: null, budget_max_cents: null,
        timeline_days: null, disqualifiers: [],
        fit_weight: 40, urgency_weight: 25, engagement_weight: 20, risk_weight: 15
      }
    ],
    lead_routing_rules: [
      {
        id: "lrr-1", organization_id: ORG, name: "Plumbing to Ana", position: 0, enabled: true,
        min_score: null, max_score: null, match_unscored: false,
        bands: [], industries: ["plumbing"], regions: [], sources: [], assign_to: ANA
      },
      {
        id: "lrr-2", organization_id: OTHER_ORG, name: "Everything to Ben", position: 0, enabled: true,
        min_score: null, max_score: null, match_unscored: false,
        bands: [], industries: [], regions: [], sources: [], assign_to: BEN
      }
    ],
    business_employee_profiles: [
      { id: ANA, organization_id: ORG, full_name: "Ana Rivera", status: "active" },
      { id: BEN, organization_id: OTHER_ORG, full_name: "Ben Okafor", status: "active" }
    ],
    growth_leads: [
      {
        id: "gl-other", organization_id: OTHER_ORG, name: OTHER_LEAD_NAME, email: OTHER_LEAD_EMAIL,
        source: "chat_widget", status: "new", score: 91, score_band: "hot", assigned_to: BEN
      }
    ],
    lead_conversations: []
  };
}

// Walk the widget to the end, returning the last response and the token.
async function converse(app, slug, answers) {
  let token = null;
  let response = await request(app).get(`/chat/${slug}`).set("accept", "text/html").redirects(0);
  for (const answer of answers) {
    const body = { question: answer.question, ...answer.fields };
    if (token) body.token = token;
    response = await request(app).post(`/chat/${slug}`).type("form").send(body).redirects(0);
    const match = String(response.text || "").match(/name="token" value="([A-Za-z0-9_-]{32})"/);
    if (match) token = match[1];
  }
  return { response, token };
}

describe("a chat widget captures one business's lead", () => {
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
    fake = createFakeSupabase({ users: {}, tables: seed() });
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

  describe("the harness is capable of failing", () => {
    it("has the other business's lead in it, so a leak would be visible", () => {
      const rows = fake.rows("growth_leads");
      assert.ok(rows.length >= 1, "the fixture has no other-business lead, so every leak check below is vacuous");
      assert.ok(rows.some((row) => row.name === OTHER_LEAD_NAME));
    });
  });

  describe("who can open it", () => {
    it("opens for somebody with no account at all", async () => {
      const response = await request(app).get("/chat/bright-plumbing").set("accept", "text/html").redirects(0);
      assert.equal(response.status, 200, "a public widget that needs an account is not a public widget");
      assert.ok(response.text.includes("Two quick questions"), "the business's own greeting is not on the page");
    });

    it("does not open an address that is reserved but switched off", async () => {
      const response = await request(app).get("/chat/somebody-else").set("accept", "text/html").redirects(0);
      assert.equal(response.status, 404, "reserving an address published it");
    });

    it("answers a slug that does not exist the same way as one that is off", async () => {
      const missing = await request(app).get("/chat/nobody-at-all").set("accept", "text/html").redirects(0);
      const off = await request(app).get("/chat/somebody-else").set("accept", "text/html").redirects(0);
      assert.equal(missing.status, off.status, "telling them apart tells somebody guessing addresses when they have guessed one that exists");
    });

    it("refuses a slug shaped like a query fragment before it reaches a filter", async () => {
      for (const bad of ["a", "-leading", "trailing-", "Has-Capitals", "with_underscore", "x&limit=99"]) {
        const response = await request(app).get(`/chat/${encodeURIComponent(bad)}`).set("accept", "text/html").redirects(0);
        assert.equal(response.status, 404, `accepted ${bad}`);
      }
    });
  });

  describe("what it asks", () => {
    it("asks the question the profile declares, not a question of its own", async () => {
      const response = await request(app).get("/chat/bright-plumbing").set("accept", "text/html").redirects(0);
      assert.ok(response.text.includes("What kind of work do you do?"), "the first profile question is not on the page");
      assert.ok(response.text.includes("plumbing"), "an option from this business's profile is missing");
      assert.ok(!response.text.includes("florist"), "an option from another business's profile is on this page");
    });

    it("asks only for contact details when the business has written nothing down", async () => {
      const response = await request(app).get("/chat/bare-business").set("accept", "text/html").redirects(0);
      assert.equal(response.status, 200);
      assert.ok(response.text.includes("Who should we get back to"), "a widget with no profile asked nothing at all");
      assert.ok(!response.text.includes("What kind of work do you do?"), "a question was asked that no profile declared");
    });
  });

  describe("what a visitor never sees", () => {
    it("shows no score, no band and nobody's name", async () => {
      const { response } = await converse(app, "bright-plumbing", [
        { question: "industry", fields: { answer: "plumbing" } },
        { question: "teamSize", fields: { answer: "20" } },
        { question: "contact", fields: { name: "Ana's Prospect", email: "prospect@example.com" } }
      ]);
      const text = String(response.text || "");
      assert.ok(!/\bhot\b/i.test(text), "the band was shown to the visitor");
      assert.ok(!text.includes("Ana Rivera"), "the visitor was told who picks their enquiry up");
      assert.ok(!text.includes("score"), "the visitor was shown the business's scoring");
    });

    it("never shows another business's lead", async () => {
      const response = await request(app).get("/chat/bright-plumbing").set("accept", "text/html").redirects(0);
      assert.ok(!response.text.includes(OTHER_LEAD_NAME));
      assert.ok(!response.text.includes(OTHER_LEAD_EMAIL));
    });
  });

  describe("what gets written", () => {
    it("writes one lead, carrying the organization the slug named", async () => {
      const before = fake.queries.length;
      await converse(app, "bright-plumbing", [
        { question: "industry", fields: { answer: "plumbing" } },
        { question: "teamSize", fields: { answer: "20" } },
        { question: "contact", fields: { name: "Rita Shaw", email: "rita@example.com" } }
      ]);

      const written = fake.queries
        .slice(before)
        .filter((entry) => entry.method === "POST" && entry.table === "growth_leads");
      assert.equal(written.length, 1, "a finished conversation wrote something other than exactly one lead");
      const row = Array.isArray(written[0].body) ? written[0].body[0] : written[0].body;
      assert.equal(row.organization_id, ORG, "a lead was written against an organization the slug did not name");
      assert.equal(row.email, "rita@example.com");
      assert.equal(row.source, "chat_widget");
      assert.equal(row.status, "new");
    });

    it("scores it against this business's profile and records the working", async () => {
      const before = fake.queries.length;
      await converse(app, "bright-plumbing", [
        { question: "industry", fields: { answer: "plumbing" } },
        { question: "teamSize", fields: { answer: "20" } },
        { question: "contact", fields: { name: "Ideal Prospect", email: "ideal@example.com" } }
      ]);
      const written = fake.queries
        .slice(before)
        .filter((entry) => entry.method === "POST" && entry.table === "growth_leads");
      const row = Array.isArray(written[0].body) ? written[0].body[0] : written[0].body;

      assert.equal(typeof row.score, "number", "a fully answered conversation produced no score");
      assert.ok(row.score_band, "a scored lead was written with no band");
      assert.equal(row.score_provisional, false, "a fully answered conversation was recorded as provisional");
      assert.ok(row.score_breakdown, "a score was written with no working");
      assert.equal(row.score_breakdown.confidence, 1);
      assert.ok(Array.isArray(row.score_breakdown.perCriterion));
      assert.ok(row.score_breakdown.perCriterion.length >= 2, "the working came back empty");
    });

    it("routes it by this business's rules and says which rule ran", async () => {
      const before = fake.queries.length;
      await converse(app, "bright-plumbing", [
        { question: "industry", fields: { answer: "plumbing" } },
        { question: "teamSize", fields: { answer: "20" } },
        { question: "contact", fields: { name: "Routed Prospect", email: "routed@example.com" } }
      ]);
      const written = fake.queries
        .slice(before)
        .filter((entry) => entry.method === "POST" && entry.table === "growth_leads");
      const row = Array.isArray(written[0].body) ? written[0].body[0] : written[0].body;

      assert.equal(row.assigned_to, ANA, "the rule naming this business's person did not run");
      assert.notEqual(row.assigned_to, BEN, "a lead was routed to another business's employee");
      assert.ok(row.assigned_at, "an assigned lead has no time on it");
      assert.equal(row.routing_note.rule, "lrr-1", "the decision does not record which rule ran");
    });

    it("records a lead the profile could not score as unscored rather than as zero", async () => {
      const before = fake.queries.length;
      await converse(app, "bare-business", [
        { question: "contact", fields: { name: "Unknown Fit", email: "unknown@example.com" } }
      ]);
      const written = fake.queries
        .slice(before)
        .filter((entry) => entry.method === "POST" && entry.table === "growth_leads");
      assert.equal(written.length, 1);
      const row = Array.isArray(written[0].body) ? written[0].body[0] : written[0].body;
      assert.equal(row.organization_id, BARE_ORG);
      assert.equal(row.score_breakdown.fit, null, "a business with no profile scored a stranger's fit anyway");
      assert.equal(row.score_breakdown.confidence, 0);
    });

    it("writes nothing to the lead table until the conversation finishes", async () => {
      const before = fake.queries.length;
      await converse(app, "bright-plumbing", [
        { question: "industry", fields: { answer: "plumbing" } }
      ]);
      const written = fake.queries
        .slice(before)
        .filter((entry) => entry.method === "POST" && entry.table === "growth_leads");
      assert.equal(written.length, 0, "a half-finished conversation was written up as a lead");
    });

    it("keeps the transcript of a conversation that never gave contact details", async () => {
      const before = fake.queries.length;
      await converse(app, "bright-plumbing", [
        { question: "industry", fields: { answer: "plumbing" } }
      ]);
      const conversations = fake.queries
        .slice(before)
        .filter((entry) => entry.method === "POST" && entry.table === "lead_conversations");
      assert.equal(conversations.length, 1, "an abandoned conversation was thrown away");
      const row = Array.isArray(conversations[0].body) ? conversations[0].body[0] : conversations[0].body;
      assert.equal(row.organization_id, ORG);
      assert.equal(row.status, "open", "an unfinished conversation was recorded as captured");
    });
  });

  describe("the token is a credential", () => {
    it("hands out a token that is 32 characters of the fixed alphabet", async () => {
      const { token } = await converse(app, "bright-plumbing", [
        { question: "industry", fields: { answer: "plumbing" } }
      ]);
      assert.ok(token, "no token was issued to continue the conversation");
      assert.match(token, /^[A-Za-z0-9_-]{32}$/);
    });

    it("refuses a token that is not one, before it reaches a filter", async () => {
      const before = fake.queries.length;
      const response = await request(app)
        .post("/chat/bright-plumbing")
        .type("form")
        .send({ question: "industry", answer: "plumbing", token: "" })
        .redirects(0);
      // An empty token must never become `token=eq.` -- that matches rows whose
      // token is empty rather than none.
      const queried = fake.queries
        .slice(before)
        .filter((entry) => entry.table === "lead_conversations" && String(entry.search || "").includes("token=eq."));
      const emptyFilter = queried.filter((entry) => /token=eq\.(&|$)/.test(String(entry.search)));
      assert.equal(emptyFilter.length, 0, "an empty token was interpolated into a filter");
      assert.ok(response.status < 500);
    });

    it("does not open a conversation belonging to another organization", async () => {
      const { token } = await converse(app, "bright-plumbing", [
        { question: "industry", fields: { answer: "plumbing" } }
      ]);
      const before = fake.queries.length;
      // The same token, offered to a different business's widget.
      await request(app)
        .post("/chat/bare-business")
        .type("form")
        .send({ question: "contact", name: "Thief", email: "thief@example.com", token })
        .redirects(0);

      const reads = fake.queries
        .slice(before)
        .filter((entry) => entry.table === "lead_conversations" && entry.method === "GET");
      assert.ok(reads.length >= 1, "no read was issued, so this check is looking at nothing");
      for (const read of reads) {
        assert.ok(
          String(read.search).includes(`organization_id=eq.${BARE_ORG}`),
          "a conversation was looked up by token alone, without the organization the slug named"
        );
      }
    });
  });
});

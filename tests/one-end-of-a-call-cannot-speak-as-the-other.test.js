"use strict";

// `routes/sonara-call-routes.cjs` was 71 of 273 lines, the lowest-covered file
// left in the coverage register. Two tests named it and neither drove a
// handler: one asserts registration throws when a dependency is missing, the
// other reads the source for hardcoded STUN addresses. Everything the four
// endpoints actually decide was unexercised.
//
// What they decide is a boundary. A call has two ends authenticated completely
// differently -- the business side is a signed-in member of the organization,
// the customer side is a person holding a link and nothing else -- and both
// ends use the same four endpoints. The module says the rule in its own words:
//
//   "The role is derived, never accepted. A body field naming the role would
//    let the customer read the customer's own signals back, or worse, post as
//    the business."
//
// A comment is not a check. These are the checks.
//
// Nothing is mocked at the module boundary: the real routes call the real
// `sonara-call-sessions` store, which calls `fetch`. Only `fetch` is replaced,
// with a stub that answers like PostgREST and records every URL and body. So
// the assertions below are about the query the application would really send --
// including the `from_role` filter and the `organization_id` scoping, which are
// where the boundary actually lives.

const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const registerCallRoutes = require("../routes/sonara-call-routes.cjs");

const ORG = "11111111-1111-4111-8111-111111111111";
const CALL = "22222222-2222-4222-8222-222222222222";
const OTHER_CALL = "33333333-3333-4333-8333-333333333333";
const CUSTOMER = "44444444-4444-4444-8444-444444444444";
const USER = { id: "55555555-5555-4555-8555-555555555555" };

// A join token has to satisfy the store's own shape check, or byToken refuses
// before any request is made and the test would be measuring the regex.
const TOKEN = "t".repeat(48);

function future() {
  return new Date(Date.now() + 5 * 60 * 1000).toISOString();
}

function callRow(over = {}) {
  return {
    id: CALL,
    organization_id: ORG,
    status: "ringing",
    join_token: TOKEN,
    expires_at: future(),
    created_at: "2026-09-02T10:00:00Z",
    connected_at: null,
    customer_id: CUSTOMER,
    ...over
  };
}

/**
 * A stub PostgREST.
 *
 * `routes` is a list of [predicate, responder]. Every call is recorded, which
 * is what lets a test assert on the query the application built rather than
 * only on the answer it got back.
 */
function harness({ answer = [], env = { SONARA_STUN_URLS: "stun:one.example:3478" }, signedIn = true } = {}) {
  const calls = [];
  const app = express();
  app.use(express.json());

  const fetchStub = async (url, init = {}) => {
    const record = { url: String(url), method: (init.method || "GET").toUpperCase(), body: init.body ? JSON.parse(init.body) : null };
    calls.push(record);
    for (const [matches, respond] of answer) {
      if (matches(record)) return respond(record);
    }
    return { ok: true, status: 200, json: async () => [] };
  };
  const previousFetch = global.fetch;
  global.fetch = fetchStub;

  registerCallRoutes(app, {
    layout: ({ heading }) => `<main>${heading || ""}</main>`,
    brandCard: (title, body) => `<article>${title}${body}</article>`,
    linkAction: (href, label) => `<a href="${href}">${label}</a>`,
    escapeHtml: (value) => String(value),
    // Only POST /api/calls carries this. The three signalling endpoints do not,
    // which is the whole point of the test below.
    requireCustomer: (req, _res, next) => {
      if (signedIn) req.sonaraUser = USER;
      next();
    },
    // The session as the endpoints without middleware see it: a cookie the
    // request carries, resolved by the route rather than attached for it.
    resolveCustomerSession: async () => (signedIn ? { ok: true, user: USER } : { ok: false, status: 401 }),
    getCustomerPrimaryOrganization: async () => (signedIn ? { ok: true, organizationId: ORG } : { ok: false }),
    getSupabaseServerConfig: () => ({ ok: true, url: "https://db.example" }),
    supabaseHeaders: () => ({ apikey: "service-role" }),
    getEnv: (name) => env[name] || ""
  });

  return { app, calls, restore: () => { global.fetch = previousFetch; } };
}

const ok = (rows) => ({ ok: true, status: 200, json: async () => rows });
const broken = () => ({ ok: false, status: 500, json: async () => ({}) });
const isSessions = (record) => record.url.includes("call_sessions");
const isSignals = (record) => record.url.includes("call_signals");
const isCustomers = (record) => record.url.includes("/customers?");

describe("one end of a call cannot speak as the other", () => {
  let live = null;
  afterEach(() => {
    if (live) live.restore();
    live = null;
  });

  describe("the role is derived, never accepted", () => {
    it("writes the customer's signal as the customer, however the body labels it", async () => {
      // The whole point. A customer's browser holds a join token; if the body
      // could name the role, it could post an offer that the business's browser
      // reads as coming from the business.
      live = harness({ answer: [[isSessions, () => ok([callRow()])], [isSignals, () => ok([])]] });
      const res = await request(live.app)
        .post(`/api/calls/${CALL}/signals`)
        .send({ token: TOKEN, role: "business", from_role: "business", kind: "offer", payload: { sdp: "v=0" } });

      assert.equal(res.status, 200, `expected the signal to be accepted, got ${res.status} ${JSON.stringify(res.body)}`);
      const insert = live.calls.find((call) => isSignals(call) && call.method === "POST");
      assert.ok(insert, "no signal was written");
      assert.equal(insert.body.from_role, "customer", "the body's role was believed; a customer could post as the business");
    });

    it("gives the customer only what the business sent, and the reverse", async () => {
      // signalsFor filters on the *other* role. Read off the query rather than
      // the response, because the response here is whatever the stub returns.
      live = harness({ answer: [[isSessions, () => ok([callRow()])], [isSignals, () => ok([])]] });
      const asCustomer = await request(live.app).get(`/api/calls/${CALL}/signals`).query({ token: TOKEN });
      assert.equal(asCustomer.status, 200);
      assert.equal(asCustomer.body.role, "customer");
      const customerRead = live.calls.find((call) => isSignals(call) && call.method === "GET");
      assert.match(customerRead.url, /from_role=eq\.business/, "the customer was served the customer's own signals");
      live.restore();

      live = harness({ answer: [[isSessions, () => ok([callRow()])], [isSignals, () => ok([])]] });
      const asBusiness = await request(live.app).get(`/api/calls/${CALL}/signals`);
      assert.equal(asBusiness.status, 200);
      assert.equal(asBusiness.body.role, "business");
      const businessRead = live.calls.find((call) => isSignals(call) && call.method === "GET");
      assert.match(businessRead.url, /from_role=eq\.customer/, "the business was served the business's own signals");
    });

    it("treats a token holder as the customer even when a session is present", async () => {
      // Stated in resolveCall's docstring: deciding by session first would make
      // an owner testing their own link the business end of it, and then
      // nothing would ever reach the customer end.
      live = harness({ answer: [[isSessions, () => ok([callRow()])], [isSignals, () => ok([])]] });
      const res = await request(live.app).get(`/api/calls/${CALL}/signals`).query({ token: TOKEN });
      assert.equal(res.body.role, "customer");
    });
  });

  describe("the business end can authenticate at all", () => {
    // Found by writing this file, and it made the whole feature dead.
    //
    // The three signalling endpoints deliberately carry no `requireCustomer`:
    // the customer end is a stranger with a link. But `req.sonaraUser` is set
    // ONLY by that middleware -- five assignment sites in server.js, all
    // route-level, none mounted on /api/calls -- so nothing ever populated it
    // here, `organizationFor` returned null, and the business end got
    // `no_organization` on every poll and every offer.
    //
    // The business page's client config carries no token either (checked: it
    // passes role, createEndpoint, customerId, joinBase, iceServers, relay),
    // and `sonara-call.js` sets `token` once from that config and never
    // reassigns it -- so the business browser had no token AND no readable
    // session. It could not send an offer or read an answer. No call could
    // connect from the business side.
    //
    // The session cookie was on the request the whole time: the client fetches
    // with `credentials: "same-origin"`. Nothing read it.
    it("resolves a signed-in business on an endpoint with no auth middleware", async () => {
      live = harness({ answer: [[isSessions, () => ok([callRow()])], [isSignals, () => ok([])]] });
      const res = await request(live.app).get(`/api/calls/${CALL}/signals`);
      assert.notEqual(res.status, 403, `the business end was refused: ${JSON.stringify(res.body)}`);
      assert.equal(res.status, 200);
      assert.equal(res.body.role, "business");
    });

    it("still refuses a request carrying neither a token nor a session", async () => {
      // The other side of it. Reading the session must not become accepting
      // anybody: a stranger with no cookie and no token is still refused.
      live = harness({ signedIn: false, answer: [[isSessions, () => ok([callRow()])]] });
      const res = await request(live.app).get(`/api/calls/${CALL}/signals`);
      assert.equal(res.status, 403);
      assert.equal(res.body.code, "no_organization");
      assert.ok(!live.calls.some(isSignals), "signals were read for a request with no credential at all");
    });

    it("says which dependency is missing rather than failing later", () => {
      // The new dependency is required, so a server that forgets to pass it
      // fails at startup rather than serving a calling feature that refuses
      // every business request -- which is exactly how this went unnoticed.
      const stubApp = { get: () => {}, post: () => {} };
      assert.throws(
        () => registerCallRoutes(stubApp, {
          layout: () => "", brandCard: () => "", linkAction: () => "", escapeHtml: () => "",
          requireCustomer: () => {}, getCustomerPrimaryOrganization: () => {},
          getSupabaseServerConfig: () => {}, supabaseHeaders: () => {}, getEnv: () => ""
        }),
        /resolveCustomerSession/
      );
    });
  });

  describe("a token opens one call, not any call", () => {
    it("refuses a valid token used against a different call id in the path", async () => {
      // Without this the token would read any call's signals by editing the URL.
      live = harness({ answer: [[isSessions, () => ok([callRow()])], [isSignals, () => ok([])]] });
      const res = await request(live.app).get(`/api/calls/${OTHER_CALL}/signals`).query({ token: TOKEN });
      assert.equal(res.status, 403);
      assert.equal(res.body.code, "no_such_call");
      assert.ok(!live.calls.some((call) => isSignals(call)), "signals were read before the path was checked");
    });

    it("refuses it on the write path too, not only the read", async () => {
      live = harness({ answer: [[isSessions, () => ok([callRow()])], [isSignals, () => ok([])]] });
      const res = await request(live.app)
        .post(`/api/calls/${OTHER_CALL}/signals`)
        .send({ token: TOKEN, kind: "offer", payload: { sdp: "v=0" } });
      assert.equal(res.status, 403);
      assert.ok(!live.calls.some((call) => isSignals(call) && call.method === "POST"), "a signal was written to a call the token does not name");
    });
  });

  describe("a call that is over stays over", () => {
    for (const [label, over, code] of [
      ["ended", { status: "ended" }, "call_over"],
      ["missed", { status: "missed" }, "call_over"],
      ["expired", { expires_at: new Date(Date.now() - 1000).toISOString() }, "link_expired"],
      ["without an expiry", { expires_at: null }, "no_expiry"],
      ["in a status nobody recognises", { status: "haunted" }, "unknown_status"]
    ]) {
      it(`refuses a call ${label}, with a sentence rather than a code`, async () => {
        live = harness({ answer: [[isSessions, () => ok([callRow(over)])], [isSignals, () => ok([])]] });
        const res = await request(live.app).get(`/api/calls/${CALL}/signals`).query({ token: TOKEN });
        assert.equal(res.status, 410);
        assert.equal(res.body.code, code);
        assert.ok(res.body.detail && res.body.detail.length > 20, `${label} was refused with no explanation`);
        assert.ok(!live.calls.some((call) => isSignals(call)), "signals were read for a call that cannot be joined");
      });
    }
  });

  describe("a read that did not happen is not an empty call", () => {
    it("answers 502 when the signals read fails, rather than 200 with no signals", async () => {
      // "Nothing yet" and "we could not look" are the same shape and different
      // facts. A person watching a spinner deserves the difference.
      live = harness({ answer: [[isSessions, () => ok([callRow()])], [isSignals, broken]] });
      const res = await request(live.app).get(`/api/calls/${CALL}/signals`).query({ token: TOKEN });
      assert.equal(res.status, 502);
      assert.equal(res.body.code, "unreadable");
      assert.match(res.body.detail, /says nothing about whether it is still going/);
    });

    it("answers 502 when the write fails, rather than reporting the signal sent", async () => {
      live = harness({
        answer: [[isSessions, () => ok([callRow()])], [(call) => isSignals(call) && call.method === "POST", broken]]
      });
      const res = await request(live.app)
        .post(`/api/calls/${CALL}/signals`)
        .send({ token: TOKEN, kind: "offer", payload: { sdp: "v=0" } });
      assert.equal(res.status, 502);
      assert.match(res.body.detail, /the other side will not have heard it/);
    });

    it("distinguishes a call that is not ours from a call it could not read", async () => {
      live = harness({ answer: [[isSessions, () => ok([])]] });
      const missing = await request(live.app).get(`/api/calls/${CALL}/signals`);
      assert.equal(missing.body.code, "no_such_call");
      live.restore();

      live = harness({ answer: [[isSessions, broken]] });
      const unread = await request(live.app).get(`/api/calls/${CALL}/signals`);
      assert.equal(unread.body.code, "unreadable", "a failed read was reported as a call that does not exist");
    });
  });

  describe("placing a call", () => {
    it("refuses before writing a row when there is nowhere to connect", async () => {
      // A call row with no ICE configuration is a link the business sends and
      // the customer finds out is broken.
      live = harness({ env: {}, answer: [[isSessions, () => ok([callRow()])]] });
      const res = await request(live.app).post("/api/calls").send({});
      assert.equal(res.status, 503);
      assert.equal(res.body.code, "setup_required");
      assert.ok(!live.calls.some((call) => isSessions(call) && call.method === "POST"), "a call row was written that could never connect");
    });

    it("checks the customer against this organization before attaching a call to them", async () => {
      // The service key bypasses row level security, so this filter is the whole
      // tenant boundary. The check must also read `customers` -- an earlier
      // version read call_sessions, which proved nothing about whether the
      // customer exists or is ours.
      live = harness({
        answer: [
          [isCustomers, () => ok([{ id: CUSTOMER }])],
          [(call) => isSessions(call) && call.method === "POST", () => ok([callRow()])]
        ]
      });
      const res = await request(live.app).post("/api/calls").send({ customer_id: CUSTOMER });
      assert.equal(res.status, 200, JSON.stringify(res.body));
      const check = live.calls.find(isCustomers);
      assert.ok(check, "no customers table read; the ownership check is measuring something else");
      assert.match(check.url, new RegExp(`organization_id=eq\\.${ORG}`), "the ownership check was not scoped to this organization");
      assert.match(check.url, new RegExp(`id=eq\\.${CUSTOMER}`));
    });

    it("refuses a customer id belonging to another business", async () => {
      live = harness({ answer: [[isCustomers, () => ok([])]] });
      const res = await request(live.app).post("/api/calls").send({ customer_id: CUSTOMER });
      assert.equal(res.status, 403);
      assert.equal(res.body.code, "no_such_customer");
      assert.ok(!live.calls.some((call) => isSessions(call) && call.method === "POST"), "a call was written against another business's customer");
    });

    it("does not call an unreadable customer someone else's", async () => {
      // 502 and 403 are different accusations. One says the database was
      // unreachable; the other says you guessed an id.
      live = harness({ answer: [[isCustomers, broken]] });
      const res = await request(live.app).post("/api/calls").send({ customer_id: CUSTOMER });
      assert.equal(res.status, 502);
      assert.equal(res.body.code, "unreadable");
    });

    it("refuses a customer id that is not an id at all, without asking the database", async () => {
      live = harness();
      const res = await request(live.app).post("/api/calls").send({ customer_id: "'; drop table customers;--" });
      assert.equal(res.status, 400);
      assert.equal(res.body.code, "no_such_customer");
      assert.ok(!live.calls.some(isCustomers), "a malformed id was sent to the database");
    });

    it("hands back a join link and an expiry, not a bare id", async () => {
      live = harness({
        answer: [[(call) => isSessions(call) && call.method === "POST", () => ok([callRow()])]]
      });
      const res = await request(live.app).post("/api/calls").send({});
      assert.equal(res.status, 200);
      assert.equal(res.body.joinUrl, `/call/${TOKEN}`);
      assert.ok(res.body.expiresAt, "a link with no expiry is a bearer capability with no end");
      assert.deepEqual(res.body.iceServers, [{ urls: ["stun:one.example:3478"] }]);
    });

    it("refuses a sign-in with no workspace rather than placing an unattached call", async () => {
      live = harness({ signedIn: false });
      const res = await request(live.app).post("/api/calls").send({});
      assert.equal(res.status, 403);
      assert.equal(res.body.code, "no_organization");
    });
  });

  describe("what a browser may send", () => {
    it("refuses a kind that is not part of a call", async () => {
      live = harness({ answer: [[isSessions, () => ok([callRow()])]] });
      const res = await request(live.app)
        .post(`/api/calls/${CALL}/signals`)
        .send({ token: TOKEN, kind: "transcript", payload: { text: "hello" } });
      assert.equal(res.status, 400);
      assert.equal(res.body.code, "unknown_kind");
      assert.ok(!live.calls.some((call) => isSignals(call) && call.method === "POST"));
    });

    it("refuses a payload larger than a call setup message", async () => {
      live = harness({ answer: [[isSessions, () => ok([callRow()])]] });
      const res = await request(live.app)
        .post(`/api/calls/${CALL}/signals`)
        .send({ token: TOKEN, kind: "offer", payload: { sdp: "x".repeat(40 * 1024) } });
      assert.equal(res.status, 400);
      assert.equal(res.body.code, "payload_too_large");
    });
  });
});

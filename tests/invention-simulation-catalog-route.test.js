"use strict";
const assert = require("node:assert/strict");
const register = require("../routes/invention-systems-routes.cjs");

describe("research simulation catalog at the existing invention-systems route", () => {
  function fixture() {
    const routes = new Map();
    const guard = (_req, _res, next) => next();
    const app = { get: (path, ...handlers) => {
      if (routes.has(path)) throw new Error("duplicate route " + path);
      routes.set(path, handlers);
    } };
    register(app, { requireCustomer: guard });
    function response() {
      return {
        statusCode: null, contentType: null, payload: null,
        headers: {},
        set(key, value) { this.headers[key] = value; return this; },
        status(code) { this.statusCode = code; return this; },
        type(value) { this.contentType = value; return this; },
        json(value) { this.payload = value; return this; },
        send(value) { this.payload = value; return this; }
      };
    }
    return { routes, guard, response };
  }

  it("fails closed when customer authorization middleware is missing", () => {
    const routes = new Map();
    register({ get(path, ...handlers) { routes.set(path, handlers); } }, {});
    assert.equal(routes.size, 2);
    for (const handlers of routes.values()) {
      let advanced = false;
      const res = {
        statusCode: null, payload: null,
        status(value) { this.statusCode = value; return this; },
        json(value) { this.payload = value; return this; }
      };
      handlers[0]({}, res, () => { advanced = true; });
      assert.equal(advanced, false);
      assert.equal(res.statusCode, 503);
      assert.deepEqual(res.payload, { ok: false, code: "customer_guard_unavailable" });
    }
  });

  it("retains the existing authenticated invention catalog path", () => {
    const f = fixture();
    assert.ok(f.routes.has("/api/invention-systems/catalog"));
    assert.ok(f.routes.has("/market-intelligence/invention-systems"));
    assert.equal(f.routes.get("/api/invention-systems/catalog")[0], f.guard);
    assert.equal(f.routes.get("/market-intelligence/invention-systems")[0], f.guard);
  });

  it("returns research descriptions without exposing executable runner functions", () => {
    const f = fixture();
    const res = f.response();
    f.routes.get("/api/invention-systems/catalog")[1]({}, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.researchSimulations.maturity, "research");
    assert.equal(res.payload.researchSimulations.executionEnabled, false);
    assert.equal(res.payload.researchSimulations.externalActionsEnabled, false);
    assert.equal(res.payload.researchSimulations.capabilities.length, 15);
    assert.ok(res.payload.researchSimulations.capabilities.every(c => !Object.hasOwn(c, "runner")));
  });

  it("retains existing invention intelligence while adding the simulations catalog", () => {
    const f = fixture();
    const res = f.response();
    f.routes.get("/api/invention-systems/catalog")[1]({}, res);
    assert.ok(res.payload.counts);
    assert.ok(Array.isArray(res.payload.researchSimulations.capabilities));
  });

  it("renders the research-only integration truthfully", () => {
    const f = fixture();
    const res = f.response();
    f.routes.get("/market-intelligence/invention-systems")[1]({}, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.contentType, "html");
    assert.match(res.payload, /Simulation and creative mathematics/);
    assert.match(res.payload, /No casino, betting, trading or money execution/);
    assert.match(res.payload, /SONARA One, Business Builder, Creator Studio and Growth Studio/);
    assert.match(res.payload, /Read-only mathematical examples/);
    assert.match(res.payload, /12 square units/);
    assert.match(res.payload, /MIDI notes 60, 64, 67/);
    assert.match(res.payload, /mixed-strategy row probability 0.5/);
    assert.match(res.payload, /Try a bounded research calculation/);
    assert.match(res.payload, /method="get"/);
  });

  it("calculates bounded user-supplied geometry on the existing guarded GET page", () => {
    const f = fixture();
    const res = f.response();
    f.routes.get("/market-intelligence/invention-systems")[1]({
      query: { study: "layout", width: "6.5", height: "2" }
    }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers["Cache-Control"], "private, no-store");
    assert.equal(res.headers["Referrer-Policy"], "no-referrer");
    assert.match(res.payload, /Illustrative area: 13 square units/);
    assert.match(res.payload, /No saved results/);
  });

  it("renders descriptive errors rather than unsafe request content", () => {
    const f = fixture();
    const res = f.response();
    f.routes.get("/market-intelligence/invention-systems")[1]({
      query: { study: "layout", width: "<svg onload=alert(1)>", height: "2" }
    }, res);
    assert.equal(res.statusCode, 200);
    assert.match(res.payload, /role="alert"/);
    assert.ok(!res.payload.includes("<svg"));
  });

  it("does not turn GET calculations into a mutation API or payments route", () => {
    const f = fixture();
    const res = f.response();
    f.routes.get("/market-intelligence/invention-systems")[1]({
      query: { study: "payoff", a: "1", b: "-1", c: "-1", d: "1" }
    }, res);
    assert.match(res.payload, /Mixed-strategy equilibrium/);
    assert.equal(f.routes.size, 2);
    assert.ok([...f.routes.keys()].every(path => !/\/(?:bet|wager|broker|execute|trade)/.test(path)));
  });

  it("registers no new mutation, wagering, payment or simulation-run endpoint", () => {
    const f = fixture();
    assert.equal(f.routes.size, 2);
    assert.ok([...f.routes.keys()].every(path => !/betting|wager|trade|payout|run|execute/i.test(path)));
  });
});

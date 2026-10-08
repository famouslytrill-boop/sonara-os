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
        status(code) { this.statusCode = code; return this; },
        type(value) { this.contentType = value; return this; },
        json(value) { this.payload = value; return this; },
        send(value) { this.payload = value; return this; }
      };
    }
    return { routes, guard, response };
  }

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
  });

  it("registers no new mutation, wagering, payment or simulation-run endpoint", () => {
    const f = fixture();
    assert.equal(f.routes.size, 2);
    assert.ok([...f.routes.keys()].every(path => !/betting|wager|trade|payout|run|execute/i.test(path)));
  });
});

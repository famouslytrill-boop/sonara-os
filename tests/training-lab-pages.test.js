// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const assert = require("node:assert/strict");
const { sections, PAGE } = require("../lib/sonara-training-lab-pages.cjs");
const registerOperationsExpansionRoutes = require("../routes/sonara-operations-expansion-routes.cjs");

function escape(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}
function html(query) { return sections(query, escape).join(""); }
function makeApp() {
  const registered = new Map();
  const app = {
    get(path, ...handlers) { registered.set("GET " + path, handlers); },
    post(path, ...handlers) { registered.set("POST " + path, handlers); }
  };
  const manager = (req, res, next) => req.allowed === true ? next()
    : res.status(403).send("manager_required");
  registerOperationsExpansionRoutes(app, {
    requireBusinessManager: manager,
    getCustomerPrimaryOrganization: async () => { throw Error("TRAINING SHOULD NOT READ ORG"); },
    getSupabaseServerConfig: () => { throw Error("TRAINING SHOULD NOT READ DB"); },
    supabaseHeaders: () => { throw Error("TRAINING SHOULD NOT READ AUTH SECRETS"); },
    layout: ({ heading, body, sections: blocks = [], actions = [] }) =>
      "<h1>" + escape(heading) + "</h1><p>" + escape(body) + "</p>" + actions.join("") + blocks.join(""),
    linkAction: (path, title) => '<a href="' + escape(path) + '">' + escape(title) + "</a>",
    escapeHtml: escape
  });
  return { handlers: registered.get("GET " + PAGE), manager };
}
function response() {
  return {
    statusCode: 200, headers: {}, text: "",
    status(code) { this.statusCode = code; return this; },
    set(key, value) { this.headers[key] = value; return this; },
    type(_type) { return this; },
    send(body) { this.text = String(body); return this; }
  };
}

describe("manager-visible fictional training page on canonical operations path", () => {
  it("offers labeled form controls without database, scripts or checkout", () => {
    const page = html({});
    assert.match(page, /method="get"/);
    assert.match(page, /id="training-scenario"/);
    assert.match(page, /id="training-action"/);
    assert.match(page, /id="training-points"/);
    assert.match(page, /name="view" type="hidden" value="training"/);
    assert.doesNotMatch(page, /<script|checkout|credit card|customer.email/i);
    assert.equal(PAGE, "/business-builder/owner/operations");
  });
  it("calculates one deterministic step in purely fictional values", () => {
    const page = html({ run: "1", scenario: "restaurant_shift",
      action: "fulfill", points: "100", stock: "5", units: "3" });
    assert.match(page, /Points remaining<\/dt><dd>94/);
    assert.match(page, /Resources remaining<\/dt><dd>2/);
    assert.match(page, /Training score<\/dt><dd>21/);
    assert.match(page, /This was a one-turn preview/);
  });
  it("reports invalid or unsupported data instead of running a different action", () => {
    for (const invalid of [
      { action: "send_money" }, { scenario: "casino" }, { points: "-1" },
      { points: "5e3" }, { units: "100" }, { stock: ["5", "50"] },
      { units: "0" }, { points: "1.5" }, { run: "2" }
    ]) {
      const page = html({
        run: "1", scenario: "restaurant_shift", action: "fulfill",
        points: "100", stock: "5", units: "3", ...invalid
      });
      assert.match(page, /Could not calculate this turn/, JSON.stringify(invalid));
      assert.doesNotMatch(page, /Your fictional turn/);
    }
  });
  it("does not reflect raw malicious query HTML into the page", () => {
    const page = html({ run: "1", action: '<img src=x onerror=alert(1)>',
      scenario: '<svg/onload=alert(1)>', points: '<script>alert(1)</script>', stock: "1", units: "1" });
    assert.doesNotMatch(page, /<img|<svg|<script|onerror=/);
    assert.match(page, /Could not calculate this turn/);
  });
  it("requires escaping and never accepts malformed host configuration", () => {
    assert.throws(() => sections({}, null), /HTML escaping is required/);
    assert.match(html({ run: ["1"] }), /Could not calculate this turn/);
  });
  it("keeps manager middleware before the existing GET operations handler", () => {
    const { handlers, manager } = makeApp();
    assert.equal(handlers[0], manager);
    assert.equal(typeof handlers[1], "function");
  });
  it("rejects unauthorized access through the manager middleware", async () => {
    const { handlers } = makeApp();
    const res = response();
    handlers[0]({ allowed: false, query: { view: "training" } }, res, () => {
      throw Error("manager middleware let an unapproved request through");
    });
    assert.equal(res.statusCode, 403);
    assert.equal(res.text, "manager_required");
  });
  it("serves manager preview without any tenant or database reads, no-cache", async () => {
    const { handlers } = makeApp();
    const res = response();
    await handlers[1]({
      allowed: true, query: { view: "training", run: "1", scenario: "retail_fulfillment",
        action: "fulfill", points: "100", stock: "4", units: "2" }
    }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers["Cache-Control"], "private, no-store");
    assert.match(res.text, /Practice a business decision/);
    assert.match(res.text, /Training score<\/dt><dd>8/);
    assert.match(res.text, /Back to business operations/);
  });
});

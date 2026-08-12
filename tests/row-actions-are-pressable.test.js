"use strict";

const assert = require("node:assert/strict");
const { ALL_OWNER_PAGES } = require("../lib/sonara-owner-record-pages.cjs");
const { createShapedRoutes } = require("../lib/sonara-form-reachability.cjs");
const app = require("../server");

// An endpoint that takes a path parameter is invisible to the form-reachability
// scan, which only looks at create-shaped routes without one.
//
// Turning an accepted quote into an invoice was built, tested, documented and
// shipped with **no way to press it**. So was turning a won lead into a
// customer. Both endpoints worked; neither had a button; nothing reported it,
// because the one check that would have asked skips parameterised paths.
//
// This is that question, asked of the actions themselves.
describe("every declared row action can actually be pressed", () => {
  const withActions = ALL_OWNER_PAGES.filter((page) => page.rowAction);

  it("has row actions to check", () => {
    assert.ok(withActions.length > 0, "no page declares a rowAction; this check is inert");
  });

  it("points each action at a route the server actually registers", () => {
    const registered = new Set();
    const walk = (stack) => {
      for (const layer of stack || []) {
        if (layer.route) registered.add(layer.route.path);
        else if (layer.handle && layer.handle.stack) walk(layer.handle.stack);
      }
    };
    walk(app._router ? app._router.stack : app.router?.stack);

    const missing = withActions
      .map((page) => page.rowAction.api.replace(":id", ":quoteId"))
      .filter((path) => !registered.has(path));

    assert.deepEqual(missing, [], `these row actions post to routes nothing registers: ${missing.join(", ")}`);
  });

  it("declares a reason for rows that cannot take the action", () => {
    // A button that refuses when pressed teaches people the product is broken.
    // The row that cannot act says why in the same column instead.
    for (const page of withActions) {
      assert.equal(typeof page.rowAction.reasonUnavailable, "function", `${page.path} has an action with no reasonUnavailable`);
      assert.ok(page.rowAction.label, `${page.path} has an action with no label`);
    }
  });

  it("refuses the row it cannot convert, and offers the one it can", () => {
    const quotes = withActions.find((page) => page.table === "quotes");
    assert.ok(quotes, "the quotes page must declare its conversion action");
    assert.equal(
      quotes.rowAction.reasonUnavailable({ status: "accepted", customer_id: "c-1", amount_cents: 4200 }),
      null,
      "an accepted quote with a customer and an amount must offer the button"
    );
    for (const row of [
      { status: "sent", customer_id: "c-1", amount_cents: 4200 },
      { status: "draft", customer_id: "c-1", amount_cents: 4200 },
      { status: "accepted", customer_id: null, amount_cents: 4200 },
      { status: "accepted", customer_id: "c-1", amount_cents: 0 }
    ]) {
      assert.ok(quotes.rowAction.reasonUnavailable(row), `${JSON.stringify(row)} must not offer the button`);
    }
  });

  it("survives a malformed row rather than failing the page", () => {
    for (const page of withActions) {
      for (const row of [null, undefined, {}, { status: 5 }]) {
        assert.doesNotThrow(() => page.rowAction.reasonUnavailable(row), `${page.path} threw on ${JSON.stringify(row)}`);
      }
    }
  });

  it("records that parameterised endpoints are outside the create-shaped scan", () => {
    // Stated as a test so the blind spot is visible rather than folklore. If
    // this ever starts including them, the exemption above can go.
    const shaped = createShapedRoutes(app).map(String);
    assert.equal(
      shaped.some((route) => route.includes(":")),
      false,
      "createShapedRoutes now includes parameterised routes; row actions can rely on it instead"
    );
  });
});

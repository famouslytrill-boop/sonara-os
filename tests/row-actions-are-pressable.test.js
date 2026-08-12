"use strict";

const assert = require("node:assert/strict");
const { ALL_OWNER_PAGES } = require("../lib/sonara-owner-record-pages.cjs");
const { GROWTH_RECORD_PAGES } = require("../lib/sonara-growth-record-pages.cjs");
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
// Two renderers grew row actions, and this file originally read one of them.
// The comment above already named the lead conversion as a victim of the same
// defect, while the code below iterated ALL_OWNER_PAGES and nothing else -- so
// the lead action could be declared, mis-wired, or absent and every assertion
// here would still pass. The collections are listed together now, and the
// count is asserted, so adding a third renderer without adding it here fails
// loudly rather than quietly narrowing what this file means.
const COLLECTIONS = [
  ["owner record pages", ALL_OWNER_PAGES],
  ["growth record pages", GROWTH_RECORD_PAGES]
];

const ALL_PAGES = COLLECTIONS.flatMap(([, pages]) => pages);

// Express records the parameter name the route was declared with (:quoteId,
// :leadId), while a page declares its action with :id because the renderer
// substitutes on that exact literal. Comparing them means normalising both.
const shape = (path) => String(path).replace(/:[A-Za-z0-9_]+/g, ":param");

describe("every declared row action can actually be pressed", () => {
  const withActions = ALL_PAGES.filter((page) => page.rowAction);

  it("has row actions to check", () => {
    assert.ok(withActions.length > 0, "no page declares a rowAction; this check is inert");
  });

  it("is reading every collection that can declare one", () => {
    // Guards the widening itself. If a collection is emptied or an import goes
    // stale, this says so instead of passing over a shorter list.
    for (const [name, pages] of COLLECTIONS) {
      assert.ok(Array.isArray(pages) && pages.length > 0, `${name} is empty; this check has gone blind`);
    }
    const covered = COLLECTIONS.filter(([, pages]) => pages.some((page) => page.rowAction));
    assert.ok(covered.length >= 2, `only ${covered.length} collection declares a row action; both renderers should`);
  });

  it("substitutes the id the renderer actually replaces", () => {
    // Both renderers do api.replace(":id", id). An action declared with the
    // route's own parameter name -- :leadId, :quoteId -- passes every other
    // check here and posts to a literal ":leadId" path when pressed.
    for (const page of withActions) {
      assert.ok(
        page.rowAction.api.includes(":id"),
        `${page.path} declares ${page.rowAction.api}, which has no :id for the renderer to replace`
      );
    }
  });

  it("points each action at a route the server actually registers", () => {
    const registered = new Set();
    const walk = (stack) => {
      for (const layer of stack || []) {
        if (layer.route) registered.add(shape(layer.route.path));
        else if (layer.handle && layer.handle.stack) walk(layer.handle.stack);
      }
    };
    walk(app._router ? app._router.stack : app.router?.stack);

    const missing = withActions
      .map((page) => page.rowAction.api)
      .filter((path) => !registered.has(shape(path)));

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
        // Both arities: an action whose rules need more than the row still has
        // to survive being handed a row and nothing else.
        assert.doesNotThrow(() => page.rowAction.reasonUnavailable(row), `${page.path} threw on ${JSON.stringify(row)}`);
        assert.doesNotThrow(() => page.rowAction.reasonUnavailable(row, { customers: [] }), `${page.path} threw on ${JSON.stringify(row)} with context`);
      }
    }
  });

  it("offers the won lead and refuses the rest", () => {
    const leads = withActions.find((page) => page.tableKey === "leads");
    assert.ok(leads, "the enquiries page must declare its conversion action");
    const reason = (row, customers = []) => leads.rowAction.reasonUnavailable(row, { customers });

    assert.equal(
      reason({ id: "l-1", status: "won", name: "Sam", email: "sam@example.com" }),
      null,
      "a won lead with a name and an email must offer the button"
    );
    for (const row of [
      { id: "l-1", status: "qualified", name: "Sam", email: "sam@example.com" },
      { id: "l-1", status: "new", name: "Sam", email: "sam@example.com" },
      { id: "l-1", status: "won", name: "", email: "sam@example.com" },
      { id: "l-1", status: "won", name: "Sam" },
      { id: "l-1", status: "won", name: "Sam", email: "sam@example.com", customer_id: "c-1" }
    ]) {
      assert.ok(reason(row), `${JSON.stringify(row)} must not offer the button`);
    }

    // The duplicate guard the endpoint enforces has to be the one the page
    // shows, or the button appears and then refuses.
    assert.ok(
      reason({ id: "l-1", status: "won", name: "Sam", email: "sam@example.com" }, [{ email: "SAM@EXAMPLE.COM", name: "Sam" }]),
      "a lead whose email already belongs to a customer must not offer the button"
    );

    // An unreadable customer list is not an empty one.
    assert.ok(
      leads.rowAction.reasonUnavailable({ id: "l-1", status: "won", name: "Sam", email: "sam@example.com" }, { customers: null }),
      "an unreadable customer list must not be treated as no duplicates"
    );
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

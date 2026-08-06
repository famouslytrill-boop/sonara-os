"use strict";

// The business assistant's checks, tested against the schema and against rows.
//
// Two failures this file exists to prevent, both of which have happened in this
// codebase before.
//
// A column typed from memory. Seventeen owner forms once sent `user_id` to
// tables that do not have it; every save failed in production while the tests
// passed against a stub, because a stub answers whatever it is asked. The
// column check below reads supabase/migrations/ instead.
//
// A check that finds nothing because it cannot see. Every check here would
// report "nothing to fix" if its predicate silently stopped matching, and
// "nothing to fix" is the answer an owner most wants to believe. So each one is
// given a row it must catch and a row it must leave alone.

const assert = require("node:assert/strict");
const {
  CHECKS,
  validate,
  selectFor,
  runCheck,
  summarise
} = require("../lib/sonara-business-checks.cjs");

const DAY = 24 * 60 * 60 * 1000;
const past = new Date(Date.now() - 40 * DAY).toISOString().slice(0, 10);
const future = new Date(Date.now() + 400 * DAY).toISOString().slice(0, 10);

// One row that must be caught and one that must not, per check. Written from
// what the check claims to be about rather than from its implementation.
const CASES = {
  menu_items_priced_below_cost: {
    catches: { id: "1", name: "Burger", selling_price_cents: 900, theoretical_cost_cents: 1100 },
    ignores: { id: "2", name: "Salad", selling_price_cents: 1200, theoretical_cost_cents: 400 }
  },
  menu_items_without_cost: {
    catches: { id: "1", name: "Soup", selling_price_cents: 700, theoretical_cost_cents: null },
    ignores: { id: "2", name: "Pasta", selling_price_cents: 1400, theoretical_cost_cents: 500 }
  },
  invoices_overdue_unpaid: {
    catches: { id: "1", invoice_number: "INV-1", due_date: past, total_cents: 25000, payment_status: "pending" },
    ignores: { id: "2", invoice_number: "INV-2", due_date: past, total_cents: 25000, payment_status: "paid" }
  },
  services_without_price: {
    catches: { id: "1", name: "Consultation", price_cents: 0, status: "active" },
    ignores: { id: "2", name: "Deep clean", price_cents: 15000, status: "active" }
  },
  bookings_without_contact: {
    catches: { id: "1", customer_name: "Sam", customer_email: "", customer_phone: null, starts_at: future, status: "confirmed" },
    ignores: { id: "2", customer_name: "Alex", customer_email: "a@example.com", customer_phone: null, starts_at: future, status: "confirmed" }
  },
  inventory_at_or_below_reorder: {
    catches: { id: "1", name: "Flour", quantity: 2, reorder_level: 5, unit: "kg", status: "active" },
    ignores: { id: "2", name: "Sugar", quantity: 40, reorder_level: 5, unit: "kg", status: "active" }
  },
  vehicle_registration_expiring: {
    catches: { id: "1", make: "Ford", model: "Transit", plate_number: "AB12", registration_expires_at: past, status: "active" },
    ignores: { id: "2", make: "Ford", model: "Transit", plate_number: "CD34", registration_expires_at: future, status: "active" }
  },
  staff_without_contact: {
    catches: { id: "1", display_name: "Jo", email: null, phone: "", status: "active" },
    ignores: { id: "2", display_name: "Kim", email: null, phone: "555-0100", status: "active" }
  },
  locations_without_address: {
    catches: { id: "1", name: "Main St", address_line1: "", city: "Leeds", status: "open" },
    ignores: { id: "2", name: "Second St", address_line1: "12 Second St", city: "Leeds", status: "open" }
  }
};

describe("the business assistant's checks", () => {
  it("names only columns the schema actually has", () => {
    // The whole point: no column here is typed from memory.
    assert.deepEqual(validate(), [], "these checks reference columns or tables that supabase/migrations does not define");
  });

  it("has a test case for every check", () => {
    // Without this, adding a check silently adds one nobody proved works.
    const untested = CHECKS.map((check) => check.id).filter((id) => !CASES[id]);
    assert.deepEqual(untested, [], "these checks have no row proving they catch anything");
  });

  it("asks for the columns it reads and no more", () => {
    for (const check of CHECKS) {
      const select = selectFor(check).split(",");
      assert.ok(select.includes("id"), `${check.id} must select id so a finding can be pointed at a record`);
      assert.ok(
        !select.includes("organization_id"),
        `${check.id} selects organization_id; the tenant filter carries it and returning it invites something downstream to trust the row instead of the query`
      );
      assert.deepEqual([...new Set(select)], select, `${check.id} selects a column twice`);
    }
  });

  for (const check of CHECKS) {
    describe(check.id, () => {
      const testCase = CASES[check.id];

      it("catches the row it is for", () => {
        const result = runCheck(check, [testCase.catches]);
        assert.equal(result.count, 1, `${check.id} did not catch the row it exists to catch`);
        assert.ok(result.findings[0].sentence.length > 10, "a finding has to say something to the owner");
      });

      it("leaves the healthy row alone", () => {
        const result = runCheck(check, [testCase.ignores]);
        assert.equal(result.count, 0, `${check.id} flagged a row that is fine, which trains owners to ignore it`);
      });

      it("survives a malformed row rather than failing the page", () => {
        // One bad record should not take out the whole assistant.
        assert.doesNotThrow(() => runCheck(check, [{}, null, { id: "x" }]));
      });

      it("says why it matters, and where to fix it", () => {
        assert.ok(check.why && check.why.length > 20, `${check.id} has no reason an owner would care`);
        assert.ok(check.fixPath && check.fixPath.startsWith("/"), `${check.id} has no page to fix it on`);
      });
    });
  }

  describe("the summary", () => {
    it("keeps checks that found nothing", () => {
      // "We looked and it is fine" and "we did not look" must not render the
      // same way. Dropping empty results makes them identical.
      const results = CHECKS.map((check) => runCheck(check, []));
      const summary = summarise(results);
      assert.equal(summary.results.length, CHECKS.length);
      assert.equal(summary.total, 0);
      assert.equal(summary.clean, CHECKS.length);
    });

    it("puts what costs money first", () => {
      const results = CHECKS.map((check) => runCheck(check, [CASES[check.id].catches]));
      const summary = summarise(results);
      assert.equal(summary.results[0].severity, "money");
      assert.equal(summary.total, CHECKS.length);

      const severities = summary.results.map((result) => result.severity);
      const firstTidy = severities.indexOf("tidy");
      const lastMoney = severities.lastIndexOf("money");
      assert.ok(firstTidy === -1 || lastMoney < firstTidy, "a tidy-up is ordered above something costing money");
    });
  });
});

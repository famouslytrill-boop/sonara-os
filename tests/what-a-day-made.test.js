"use strict";

// The food cost of a day's trading, and the part it does not include.
//
// Net sales and what sold are both recordable now, so the food cost against a
// day's takings can be worked out. Labour cannot: hours sit on
// employee_time_entries and rates on employee_wage_rates, and until this change
// the rates table had a schema, row level security and no page at all.
//
// The temptation here is to call the figure gross profit. In a food business
// labour is the second-largest cost after food, so a "profit" that quietly
// omits wages is not an approximation, it is a wrong number a person might act
// on. The card names what it leaves out.

const assert = require("node:assert/strict");
const { ALL_OWNER_PAGES, childrenOf } = require("../lib/sonara-owner-record-pages.cjs");
const { tableColumns } = require("../lib/sonara-migration-columns.cjs");

const sales = ALL_OWNER_PAGES.find((page) => page.path === "/business-builder/owner/sales");
const staff = ALL_OWNER_PAGES.find((page) => page.path === "/business-builder/owner/staff");
const ui = { card: (title, body) => ({ title, body }) };
const loaded = (rows) => [{ ok: true, rows }];
const card = (day, childRows) => sales.derivedCard(day, childRows, ui).body;

describe("what a day made", () => {
  it("has the two inputs it needs, and the third has a page at last", () => {
    assert.ok(sales, "no daily sales page");
    assert.equal(childrenOf(sales)[0].table, "pos_menu_mix_items");

    const wages = childrenOf(staff).find((spec) => spec.table === "employee_wage_rates");
    assert.ok(wages, "employee_wage_rates still has no page, so labour cost stays uncomputable");
    const columns = tableColumns("employee_wage_rates");
    assert.ok(columns, "employee_wage_rates is not in the migrations");
    for (const field of wages.form.fields) {
      assert.ok(columns.has(field.name), `employee_wage_rates has no column ${field.name}`);
    }
  });

  it("works out the food cost and what it is as a share of sales", () => {
    const body = card({ net_sales_cents: 120000 }, loaded([{ theoretical_cost_cents: 30000 }, { theoretical_cost_cents: 6000 }]));
    assert.match(body, /Net sales \$1200\.00/);
    assert.match(body, /food cost \$360\.00/);
    assert.match(body, /30\.0% of sales/);
    assert.match(body, /leaving \$840\.00 before labour/);
  });

  // The whole point of the card's wording.
  it("never calls the figure profit, and says labour is missing from it", () => {
    const body = card({ net_sales_cents: 50000 }, loaded([{ theoretical_cost_cents: 10000 }]));
    assert.match(body, /before labour/);
    assert.match(body, /Labour is not in this figure/);
    assert.doesNotMatch(
      body,
      /\b(gross profit|profit|you (made|kept)|net profit)\b/i,
      "a figure that omits wages must not be called profit in a business where labour is the second-largest cost"
    );
  });

  it("refuses the food cost when an item that sold has none", () => {
    const body = card({ net_sales_cents: 120000 }, loaded([{ theoretical_cost_cents: 30000 }, { theoretical_cost_cents: null }]));
    assert.match(body, /no cost recorded/);
    assert.match(body, /Net sales were \$1200\.00/, "the half that is known is still stated");
    assert.doesNotMatch(body, /before labour|% of sales/, "a short food cost must not be presented as the food cost");
  });

  it("asks for the sales rather than working out a share of nothing", () => {
    for (const day of [{}, { net_sales_cents: null }]) {
      const body = card(day, loaded([{ theoretical_cost_cents: 100 }]));
      assert.match(body, /Record the net sales/);
      assert.doesNotMatch(body, /NaN|Infinity|%/, "a share of an unrecorded figure reached the customer");
    }
  });

  it("does not divide by a day that took nothing", () => {
    const body = card({ net_sales_cents: 0 }, loaded([{ theoretical_cost_cents: 100 }]));
    assert.doesNotMatch(body, /NaN|Infinity/, "zero sales produced a share");
    assert.doesNotMatch(body, /% of sales/, "there is no share of zero to state");
    assert.match(body, /food cost \$1\.00/, "what is known is still stated");
  });

  it("says the items could not be read, rather than that none sold", () => {
    const failed = card({ net_sales_cents: 50000 }, [{ ok: false, rows: [] }]);
    assert.match(failed, /could not read/);
    assert.doesNotMatch(failed, /Add what sold below/, "a failed read must not be reported as a day with no sales");

    const empty = card({ net_sales_cents: 50000 }, loaded([]));
    assert.match(empty, /Add what sold below/);
    assert.doesNotMatch(empty, /could not read/);
  });
});

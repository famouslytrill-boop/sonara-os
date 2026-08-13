"use strict";

// A recipe that costs something.
//
// recipe_cards shipped with a page; recipe_ingredients shipped with a schema,
// row level security, an index and no way to add one. So a recipe was a name, a
// yield and a block of method text, and the number a food business is actually
// buying -- what one portion costs -- could not be worked out from anything the
// product held.
//
// Two things here are not about recipes and are the reason this file is longer
// than the feature. The cost is derived from its inputs rather than asked for
// again, and the cost of a portion is only stated when it can be. Both are
// places where the obvious version prints a confident number over data that
// does not support one.

const assert = require("node:assert/strict");
const { ALL_OWNER_PAGES, childrenOf } = require("../lib/sonara-owner-record-pages.cjs");
const { tableColumns } = require("../lib/sonara-migration-columns.cjs");

const recipes = ALL_OWNER_PAGES.find((page) => page.path === "/business-builder/owner/recipes");
const ingredients = childrenOf(recipes)[0];

// The card is rendered with the injected ui, so a stub is enough to read what
// it says.
const ui = { card: (title, body) => ({ title, body }) };
const loaded = (rows) => [{ ok: true, rows }];

describe("recipe costing", () => {
  it("is wired to the table the schema already had", () => {
    assert.ok(ingredients, "the recipes page has no ingredients child");
    assert.equal(ingredients.table, "recipe_ingredients");
    assert.equal(ingredients.parentColumn, "recipe_id");
    const columns = tableColumns("recipe_ingredients");
    assert.ok(columns, "recipe_ingredients is not in the migrations");
    for (const field of ingredients.form.fields) {
      assert.ok(columns.has(field.name), `recipe_ingredients has no column ${field.name}`);
    }
    assert.ok(columns.has(ingredients.totalFrom), `no column ${ingredients.totalFrom} to total from`);
  });

  describe("the cost of an ingredient", () => {
    it("is computed, not asked for twice", () => {
      const asked = ingredients.form.fields.map((field) => field.name);
      assert.ok(
        !asked.includes("calculated_cost_cents"),
        "the form asks for the cost it also computes, so the two can disagree about the same ingredient"
      );
      assert.ok(asked.includes("quantity") && asked.includes("unit_cost_cents"), "the inputs to the cost must be asked for");
    });

    it("multiplies quantity by unit cost", () => {
      assert.deepEqual(ingredients.derive({ quantity: "2", unit_cost_cents: "150" }), { calculated_cost_cents: 300 });
      assert.deepEqual(ingredients.derive({ quantity: "0.5", unit_cost_cents: "1000" }), { calculated_cost_cents: 500 });
    });

    it("adds waste as a percentage, because that is what the field asks for", () => {
      // 200g at 250 per unit is 50; 5% waste makes it 52.5, rounded to 53.
      assert.deepEqual(ingredients.derive({ quantity: "0.2", unit_cost_cents: "250", waste_percent: "5" }), { calculated_cost_cents: 53 });
      // The convention is set by this feature -- nothing read waste_percent
      // before it. A customer typing 5 and meaning 5% getting 500% back is the
      // failure the other reading of numeric(7,4) would have caused, so it is
      // asserted rather than left to the field hint.
      const fivePercent = ingredients.derive({ quantity: "1", unit_cost_cents: "100", waste_percent: "5" });
      assert.equal(fivePercent.calculated_cost_cents, 105, "5 must mean 5%, not 500%");
      const hint = ingredients.form.fields.find((field) => field.name === "waste_percent").hint;
      assert.match(hint, /5 means 5%/, "the convention must be on the field a person types into");
    });

    it("stores nothing rather than NaN when an input is not a number", () => {
      assert.deepEqual(ingredients.derive({ quantity: "a lot", unit_cost_cents: "150" }), {});
      assert.deepEqual(ingredients.derive({ quantity: "2", unit_cost_cents: "" }), {});
      assert.deepEqual(ingredients.derive({}), {});
    });

    it("treats a missing or negative waste as none, not as a discount", () => {
      assert.equal(ingredients.derive({ quantity: "1", unit_cost_cents: "100" }).calculated_cost_cents, 100);
      assert.equal(ingredients.derive({ quantity: "1", unit_cost_cents: "100", waste_percent: "" }).calculated_cost_cents, 100);
      assert.equal(
        ingredients.derive({ quantity: "1", unit_cost_cents: "100", waste_percent: "-20" }).calculated_cost_cents,
        100,
        "negative waste must not make an ingredient cheaper than it is"
      );
    });
  });

  describe("the cost of a portion", () => {
    const card = (recipe, childRows) => recipes.derivedCard(recipe, childRows, ui);

    it("divides the ingredients by what the recipe makes", () => {
      const body = card(
        { yield_quantity: 4, yield_unit: "portions" },
        loaded([{ calculated_cost_cents: 400 }, { calculated_cost_cents: 400 }])
      ).body;
      assert.match(body, /\$8\.00 of ingredients/);
      assert.match(body, /\$2\.00 per portions/);
    });

    it("says what it does not include", () => {
      const body = card({ yield_quantity: 2 }, loaded([{ calculated_cost_cents: 100 }])).body;
      assert.match(body, /does not include labour, energy or overheads/);
    });

    it("gives the total and asks for the yield rather than dividing by zero", () => {
      for (const recipe of [{}, { yield_quantity: 0 }, { yield_quantity: null }, { yield_quantity: "some" }]) {
        const body = card(recipe, loaded([{ calculated_cost_cents: 250 }])).body;
        assert.match(body, /\$2\.50 in total/, "the total is known even when the yield is not");
        assert.doesNotMatch(body, /Infinity|NaN/, `dividing by ${JSON.stringify(recipe.yield_quantity)} reached the customer`);
        assert.match(body, /Record how much this recipe makes/);
      }
    });

    it("refuses to total when an ingredient has no cost", () => {
      const body = card({ yield_quantity: 4 }, loaded([{ calculated_cost_cents: 400 }, { calculated_cost_cents: null }])).body;
      assert.match(body, /no cost recorded/);
      assert.doesNotMatch(body, /per portion is|\$4\.00/, "a short total must not be presented as the cost");
    });

    // The distinction the whole session keeps coming back to.
    it("says the ingredients could not be read, rather than that there are none", () => {
      const failed = recipes.derivedCard({ yield_quantity: 4 }, [{ ok: false, rows: [] }], ui).body;
      assert.match(failed, /could not read/);
      assert.doesNotMatch(failed, /Add the ingredients below/, "a failed read must not be reported as an empty recipe");

      const empty = card({ yield_quantity: 4 }, loaded([])).body;
      assert.match(empty, /Add the ingredients below/);
      assert.doesNotMatch(empty, /could not read/);
    });
  });
});

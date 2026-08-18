"use strict";

// Selling something that is not a service.
//
// Business Builder could price work and had no way to list a thing. The
// catalogue added merchant_products and merchant_product_variants, and the one
// decision worth guarding is where the price lives: on the version, never on
// the product. A product with two sizes at one price is a product with two
// versions that happen to agree, and a price on the parent as well would give
// two answers to "what does this cost".
//
// That decision is only real if the page can answer "can I sell this" from the
// versions, and answer it in the three states this codebase keeps getting
// wrong -- none, unreadable, and present-but-blank. `null` is not `[]` is not
// `0`, and a version with no price is not a free product.

const assert = require("node:assert/strict");
const request = require("supertest");

const SUPABASE_ENV = Object.freeze({
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-anon-key-for-catalogue",
  SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-service-role-for-catalogue"
});
const original = Object.fromEntries(Object.keys(SUPABASE_ENV).map((key) => [key, process.env[key]]));

const app = require("../server");
const { CUSTOMER_SESSION_COOKIE } = require("../lib/sonara-customer-auth.cjs");
const {
  ALL_OWNER_PAGES,
  childrenOf,
  REFERENCE_SOURCES
} = require("../lib/sonara-owner-record-pages.cjs");
const { tableColumns } = require("../lib/sonara-migration-columns.cjs");

const USER = { id: "77777777-7777-4777-8777-777777777777", email: "owner@example.com" };
const ORGANIZATION_ID = "88888888-8888-4888-8888-888888888888";
const PRODUCT = "12345678-1234-4234-8234-123456789012";

const page = ALL_OWNER_PAGES.find((entry) => entry.table === "merchant_products");
const versions = page ? childrenOf(page)[0] : null;

// A card, kept as its two halves rather than rendered, so an assertion about
// what it says is not an assertion about the markup around it.
const asCard = { card: (title, body) => ({ title, body }) };

function json(body, status = 200) {
  return { ok: status < 400, status, headers: { get: () => null }, json: async () => body };
}

let requested = [];

function stubFetch({ versionRows = [], versionsReadable = true } = {}) {
  return async (url, options = {}) => {
    const target = String(url);
    requested.push(target);
    const method = (options.method || "GET").toUpperCase();
    if (target.includes("/auth/v1/user")) return json(USER);
    if (target.includes("/rest/v1/rpc/")) return json({});
    if (!target.includes("/rest/v1/")) return undefined;
    const table = (target.split("/rest/v1/")[1] || "").split("?")[0];
    if (table === "organization_memberships") {
      return json([{ organization_id: ORGANIZATION_ID, user_id: USER.id, role: "owner", status: "active" }]);
    }
    if (table === "business_memberships") {
      return json([{ id: "membership", organization_id: ORGANIZATION_ID, workspace_id: "workspace", role: "owner", status: "active" }]);
    }
    if (method === "POST") return json([{ id: "created" }], 201);
    if (table === "merchant_products") {
      const scoped = target.includes(`organization_id=eq.${ORGANIZATION_ID}`);
      if (!scoped) return json([]);
      return json([{ id: PRODUCT, name: "Oak shelf", category: "Furniture", status: "active", created_at: "2026-08-18T09:00:00Z" }]);
    }
    if (table === "merchant_product_variants") {
      if (!versionsReadable) return json({ message: "no" }, 500);
      return json(versionRows);
    }
    return json([]);
  };
}

function asManager(path) {
  return request(app).get(path).set("Accept", "text/html").set("Cookie", `${CUSTOMER_SESSION_COOKIE}=stub`).redirects(0);
}

describe("a product is priced through its versions", () => {
  let realFetch;

  before(() => {
    Object.assign(process.env, SUPABASE_ENV);
    realFetch = global.fetch;
  });

  after(() => {
    global.fetch = realFetch;
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  beforeEach(() => {
    requested = [];
    global.fetch = stubFetch();
  });

  it("has a page, and its versions hang off it rather than standing alone", () => {
    assert.ok(page, "no owner page reads merchant_products; the catalogue has no way in");
    assert.ok(versions, "merchant_products has no child table; a product with no versions has no price");
    assert.equal(versions.table, "merchant_product_variants");
    assert.equal(versions.parentColumn, "product_id");
    const standalone = ALL_OWNER_PAGES.filter((entry) => entry.table === "merchant_product_variants");
    assert.deepEqual(standalone, [], "a version reached without its product is a row belonging to nothing");
  });

  // The decision the whole design rests on. A price column on merchant_products
  // would be a second answer to the same question, and the two would disagree
  // the first time somebody edited one.
  it("keeps the price on the version and off the product", () => {
    const product = tableColumns("merchant_products");
    const version = tableColumns("merchant_product_variants");
    assert.ok(product, "merchant_products is not in the migrations");
    assert.ok(version, "merchant_product_variants is not in the migrations");
    assert.ok(version.has("price_cents"), "a version with no price cannot be sold");
    for (const column of [...product]) {
      assert.ok(!/price|amount|cost/.test(column), `merchant_products.${column} is a second answer to what this costs`);
    }
    // And the page must not offer one either, which is the way a column like
    // that gets asked for before it exists.
    const asked = page.form.fields.map((field) => field.name);
    assert.ok(!asked.some((name) => /price|amount|cost/.test(name)), `the product form asks for ${asked.join(", ")}`);
  });

  it("says a product with no versions cannot be sold yet", () => {
    const card = page.derivedCard({ id: PRODUCT }, [{ ok: true, rows: [] }], asCard);
    assert.match(card.body, /Not yet/);
    assert.match(card.body, /add at least one/i);
  });

  // The state this codebase keeps getting wrong. A failed read rendered as
  // "no versions" tells a customer a definite thing about their own records on
  // the strength of a request that did not happen.
  it("refuses to answer when the versions could not be read", () => {
    const card = page.derivedCard({ id: PRODUCT }, [{ ok: false, rows: [] }], asCard);
    assert.match(card.body, /could not read/i);
    assert.doesNotMatch(card.body, /Not yet/, "an unreadable list must not read as an empty one");
    const missing = page.derivedCard({ id: PRODUCT }, [], asCard);
    assert.match(missing.body, /could not read/i, "no entry at all is not an empty list either");
  });

  it("gives the price range when there are versions on sale", () => {
    const card = page.derivedCard({ id: PRODUCT }, [{
      ok: true,
      rows: [
        { id: "a", variant_name: "Small", price_cents: 2500, status: "active" },
        { id: "b", variant_name: "Large", price_cents: 4000, status: "active" }
      ]
    }], asCard);
    assert.match(card.body, /\$25\.00 to \$40\.00/, `read: ${card.body}`);
    assert.doesNotMatch(card.body, /2500/, "cents were printed at somebody trying to read their own prices");
  });

  it("says one price, not a range, when every version agrees", () => {
    const card = page.derivedCard({ id: PRODUCT }, [{
      ok: true,
      rows: [
        { id: "a", variant_name: "Blue", price_cents: 2500, status: "active" },
        { id: "b", variant_name: "Green", price_cents: 2500, status: "active" }
      ]
    }], asCard);
    assert.match(card.body, /at \$25\.00\./, `read: ${card.body}`);
    assert.doesNotMatch(card.body, /to \$25\.00/, "one price is not a range");
  });

  // A blank price is not a free product, and the range must not quietly
  // include it as zero.
  it("does not treat a version with no price as costing nothing", () => {
    const card = page.derivedCard({ id: PRODUCT }, [{
      ok: true,
      rows: [
        { id: "a", variant_name: "Small", price_cents: 2500, status: "active" },
        { id: "b", variant_name: "Large", price_cents: null, status: "active" }
      ]
    }], asCard);
    assert.doesNotMatch(card.body, /\$0\.00/, "a blank price was counted as free");
    assert.match(card.body, /no price recorded/i, "the blank one was left out silently");

    const none = page.derivedCard({ id: PRODUCT }, [{
      ok: true,
      rows: [{ id: "a", variant_name: "Small", price_cents: null, status: "active" }]
    }], asCard);
    assert.match(none.body, /none of them has a price/i, `read: ${none.body}`);
    assert.doesNotMatch(none.body, /\$0\.00/);
  });

  it("does not count an archived version as something a customer could buy", () => {
    const card = page.derivedCard({ id: PRODUCT }, [{
      ok: true,
      rows: [
        { id: "a", variant_name: "Old", price_cents: 2500, status: "archived" },
        { id: "b", variant_name: "Older", price_cents: 4000, status: "inactive" }
      ]
    }], asCard);
    assert.match(card.body, /Not yet/);
    assert.doesNotMatch(card.body, /\$25\.00/, "an archived version was offered as a price");
  });

  it("renders the product, its versions and their prices as money", async () => {
    global.fetch = stubFetch({
      versionRows: [
        { id: "v1", product_id: PRODUCT, variant_name: "Small", sku: "OAK-S", price_cents: 2500, currency: "usd", status: "active" },
        { id: "v2", product_id: PRODUCT, variant_name: "Large", sku: "OAK-L", price_cents: 4000, currency: "usd", status: "active" }
      ]
    });
    const response = await asManager(`${page.path}/${PRODUCT}`);
    assert.equal(response.status, 200);
    assert.match(response.text, /Oak shelf/);
    assert.match(response.text, /OAK-S/);
    assert.match(response.text, /\$25\.00/);
    assert.match(response.text, /\$40\.00/);
    assert.doesNotMatch(response.text, /&gt;2500&lt;|>2500</, "a price was printed in cents");
  });

  it("scopes both reads to this business, not just the product", async () => {
    await asManager(`${page.path}/${PRODUCT}`);
    const reads = requested.filter((url) => url.includes("/rest/v1/merchant_product_variants"));
    assert.ok(reads.length, "the versions were never read");
    for (const url of reads) {
      assert.ok(url.includes(`organization_id=eq.${ORGANIZATION_ID}`), `unscoped read: ${url}`);
      assert.ok(url.includes(`product_id=eq.${PRODUCT}`), `every version in the business was read: ${url}`);
    }
  });

  // The service key bypasses row level security, so a product id guessed from
  // another business would otherwise open.
  it("will not open another business's product", async () => {
    global.fetch = async (url) => {
      const target = String(url);
      if (target.includes("/auth/v1/user")) return json(USER);
      if (target.includes("/rest/v1/rpc/")) return json({});
      if (!target.includes("/rest/v1/")) return undefined;
      const table = (target.split("/rest/v1/")[1] || "").split("?")[0];
      if (table === "organization_memberships") {
        return json([{ organization_id: ORGANIZATION_ID, user_id: USER.id, role: "owner", status: "active" }]);
      }
      if (table === "business_memberships") {
        return json([{ id: "m", organization_id: ORGANIZATION_ID, workspace_id: "w", role: "owner", status: "active" }]);
      }
      // PostgREST honours both filters. The product belongs to someone else, so
      // the organization filter excludes it.
      if (table === "merchant_products") return json([]);
      return json([]);
    };
    const response = await asManager(`${page.path}/99999999-9999-4999-8999-999999999999`);
    assert.equal(response.status, 404);
    assert.doesNotMatch(response.text, /Oak shelf/);
  });

  // A version row on its own says "Large". Every other picker in the record
  // pages holds a name that means something alone; this one holds the half of
  // a name that does not, and three products' "Large" in one dropdown is a
  // control that looks like a choice and is not one.
  describe("the picker that puts a product on an invoice", () => {
    const source = REFERENCE_SOURCES.productVariants;

    it("exists, and asks for the parent's name alongside the version", () => {
      assert.ok(source, "no reference source for product versions");
      assert.equal(source.table, "merchant_product_variants");
      assert.ok(source.select && source.select.includes("merchant_products"), "the picker cannot name the product it is offering");
    });

    it("labels an option with the product and the version", () => {
      const label = source.label({ merchant_products: { name: "Oak shelf" }, variant_name: "Large", sku: "OAK-L" });
      assert.match(label, /Oak shelf/);
      assert.match(label, /Large/);
    });

    it("falls back to the code rather than offering a bare adjective", () => {
      assert.equal(source.label({ variant_name: "Large", sku: "OAK-L" }), "OAK-L");
      assert.equal(source.label({ variant_name: "Large" }), "", "\"Large\" was offered as though it identified something");
    });

    it("is offered on an invoice line, beside the services picker", () => {
      const invoices = ALL_OWNER_PAGES.find((entry) => entry.table === "customer_invoices");
      const lines = childrenOf(invoices).find((spec) => spec.table === "customer_invoice_lines");
      const field = lines.form.fields.find((entry) => entry.name === "variant_id");
      assert.ok(field, "the catalogue cannot reach an invoice, so nothing can be charged for");
      assert.equal(field.from, "productVariants");
      assert.ok(!field.required, "a line must still be able to be free text");
      const columns = tableColumns("customer_invoice_lines");
      assert.ok(columns.has("variant_id"), "the form asks for a column that is not there, so nothing would save");
    });

    // The promise the catalogue is for. Recording which version a line came
    // from and then making somebody retype its name and price is a catalogue
    // that saves nobody anything.
    describe("putting a version on an invoice line", () => {
      const INVOICE = "12345678-1234-4234-8234-123456789012";
      const VARIANT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
      let inserted;

      function stub({ variantRows, readable = true } = {}) {
        return async (url, options = {}) => {
          const target = String(url);
          requested.push(target);
          const method = (options.method || "GET").toUpperCase();
          if (target.includes("/auth/v1/user")) return json(USER);
          if (target.includes("/rest/v1/rpc/")) return json({});
          if (!target.includes("/rest/v1/")) return undefined;
          const table = (target.split("/rest/v1/")[1] || "").split("?")[0];
          if (table === "organization_memberships") {
            return json([{ organization_id: ORGANIZATION_ID, user_id: USER.id, role: "owner", status: "active" }]);
          }
          if (table === "business_memberships") {
            return json([{ id: "m", organization_id: ORGANIZATION_ID, workspace_id: "w", role: "owner", status: "active" }]);
          }
          if (method === "POST") {
            inserted = JSON.parse(options.body || "{}");
            return json([{ id: "created" }], 201);
          }
          if (table === "customer_invoices") return json([{ id: INVOICE }]);
          if (table === "merchant_product_variants") {
            if (!readable) return json({ message: "no" }, 500);
            return json(variantRows === undefined
              ? [{ id: VARIANT, variant_name: "Large", price_cents: 4000, merchant_products: { name: "Oak shelf" } }]
              : variantRows);
          }
          return json([]);
        };
      }

      function addLine(body, options) {
        inserted = null;
        global.fetch = stub(options);
        return request(app)
          .post("/api/business/invoice-lines")
          .set("Cookie", `${CUSTOMER_SESSION_COOKIE}=stub`)
          .set("Accept", "text/html")
          .type("form")
          .send({ invoice_id: INVOICE, ...body })
          .redirects(0);
      }

      it("fills the description, the price and the total from the version", async () => {
        await addLine({ variant_id: VARIANT, quantity: "3" });
        assert.ok(inserted, "nothing was saved");
        assert.equal(inserted.description, "Oak shelf \u2014 Large");
        assert.equal(inserted.unit_price_cents, 4000);
        assert.equal(inserted.line_total_cents, 12000);
      });

      // A blank quantity is the column's own `not null default 1`. Without this
      // a version picked with nothing else typed saves a priced line totalling
      // zero.
      it("totals a version picked on its own at its own price", async () => {
        await addLine({ variant_id: VARIANT });
        assert.equal(inserted.line_total_cents, 4000);
      });

      // The rule the migration is explicit about: a line total is what the
      // business decided to charge, and a typed price is a discount somebody
      // meant.
      it("never overwrites a price somebody typed", async () => {
        await addLine({ variant_id: VARIANT, quantity: "2", line_total_cents: "5000", description: "Two shelves, agreed rate" });
        assert.equal(inserted.line_total_cents, "5000", "a discount was overwritten by the catalogue price");
        assert.equal(inserted.description, "Two shelves, agreed rate");
      });

      it("still takes a line typed out with no version at all", async () => {
        await addLine({ description: "Call-out fee", line_total_cents: "4500" });
        assert.equal(inserted.description, "Call-out fee");
        assert.equal(inserted.line_total_cents, "4500");
      });

      it("refuses a line with neither a version nor a description", async () => {
        const result = await addLine({ quantity: "1" });
        assert.match(result.headers.location || "", /problem=missing_required/);
        assert.equal(inserted, null, "a line with no description was saved");
      });

      // The service key bypasses row level security, so the variant lookup is
      // scoped by organization exactly like the parent check above it.
      it("will not price a line from another business's catalogue", async () => {
        const result = await addLine({ variant_id: VARIANT }, { variantRows: [] });
        assert.match(result.headers.location || "", /problem=reference_not_yours/);
        assert.equal(inserted, null);
      });

      // A read that failed is not a version that does not exist. Saving here
      // would put a null into a not-null column and fail as a database error
      // nobody can act on.
      it("refuses rather than saving a blank line when the catalogue cannot be read", async () => {
        const result = await addLine({ variant_id: VARIANT }, { readable: false });
        assert.match(result.headers.location || "", /problem=catalogue_unreadable/);
        assert.equal(inserted, null);
      });

      it("scopes the version lookup to this business", async () => {
        requested = [];
        await addLine({ variant_id: VARIANT });
        const reads = requested.filter((url) => url.includes("/rest/v1/merchant_product_variants"));
        assert.ok(reads.length, "the version was never looked up");
        for (const url of reads) assert.ok(url.includes(`organization_id=eq.${ORGANIZATION_ID}`), `unscoped: ${url}`);
      });
    });

    // The embed is the whole point of the source. If loadReferences dropped it
    // the picker would still render, and every option in it would be an
    // adjective -- a page that works and means nothing.
    it("asks Supabase for the embed when the invoice page renders", async () => {
      const invoices = ALL_OWNER_PAGES.find((entry) => entry.table === "customer_invoices");
      global.fetch = async (url, init = {}) => {
        const target = String(url);
        requested.push(target);
        const method = (init.method || "GET").toUpperCase();
        if (target.includes("/auth/v1/user")) return json(USER);
        if (target.includes("/rest/v1/rpc/")) return json({});
        if (!target.includes("/rest/v1/")) return undefined;
        const table = (target.split("/rest/v1/")[1] || "").split("?")[0];
        if (table === "organization_memberships") {
          return json([{ organization_id: ORGANIZATION_ID, user_id: USER.id, role: "owner", status: "active" }]);
        }
        if (table === "business_memberships") {
          return json([{ id: "m", organization_id: ORGANIZATION_ID, workspace_id: "w", role: "owner", status: "active" }]);
        }
        if (method === "POST") return json([{ id: "created" }], 201);
        if (table === "customer_invoices") return json([{ id: PRODUCT, invoice_number: "INV-1", status: "sent", total_cents: 4500, currency: "usd" }]);
        return json([]);
      };
      await asManager(`${invoices.path}/${PRODUCT}`);
      const reads = requested.filter((url) => url.includes("/rest/v1/merchant_product_variants"));
      assert.ok(reads.length, "the picker never read the versions");
      for (const url of reads) {
        assert.ok(/merchant_products/.test(decodeURIComponent(url)), `the embed was dropped: ${url}`);
      }
    });
  });
});

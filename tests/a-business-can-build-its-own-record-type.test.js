"use strict";

// Records this product does not have a page for.
//
// Five business_sub_app_* tables were created on 30 May 2026 and nothing has
// ever read them. lib/sonara-subsystem-registry.cjs records why, honestly:
// "Designed, never built."
//
// The reason it could not have been built as it stood is the interesting part.
// business_sub_app_database_schemas holds a `fields` jsonb describing what a
// record looks like, and **there was no table holding records**. A customer
// could design a record type and have nowhere to put one -- a schema designer
// with no rows, which is the same shape as the feature it was meant to be.
//
// So this covers three things: that a field list means something specific, that
// a record is checked against the schema stored in the database rather than
// against the form that was submitted, and that a business cannot reach another
// business's sub-app.

const assert = require("node:assert/strict");
const request = require("supertest");

const SUPABASE_ENV = Object.freeze({
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-anon-key-for-subapps",
  SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-service-role-for-subapps"
});
const original = Object.fromEntries(Object.keys(SUPABASE_ENV).map((key) => [key, process.env[key]]));

const app = require("../server");
const { CUSTOMER_SESSION_COOKIE } = require("../lib/sonara-customer-auth.cjs");
const subApps = require("../lib/sonara-sub-apps.cjs");

const USER = { id: "51515151-5151-4151-8151-515151515151", email: "owner@example.com" };
const OURS = "52525252-5252-4252-8252-525252525252";
const MY_SUB_APP = "53535353-5353-4353-8353-535353535353";
const THEIR_SUB_APP = "54545454-5454-4454-8454-545454545454";
const MY_SCHEMA = "55555555-5555-4555-8555-555555555555";
const THEIR_SCHEMA = "56565656-5656-4656-8656-565656565656";

const FIELDS = [
  { key: "kennel_name", label: "Kennel name", type: "text", required: true },
  { key: "nightly_rate", label: "Nightly rate", type: "money", required: false },
  { key: "heated", label: "Heated", type: "yes_no", required: false },
  { key: "size", label: "Size", type: "choice", required: false, choices: ["Small", "Medium", "Large"] }
];

let inserted;
let readable;

function json(body, status = 200) {
  return { ok: status < 400, status, headers: { get: () => null }, json: async () => body };
}

function stub() {
  return async (url, options = {}) => {
    const target = String(url);
    const method = (options.method || "GET").toUpperCase();
    if (target.includes("/auth/v1/user")) return json(USER);
    if (target.includes("/rest/v1/rpc/")) return json({});
    if (!target.includes("/rest/v1/")) return undefined;
    const table = (target.split("/rest/v1/")[1] || "").split("?")[0];
    if (table === "organization_memberships") return json([{ organization_id: OURS, user_id: USER.id, role: "owner", status: "active" }]);
    if (table === "business_memberships") return json([{ id: "m", organization_id: OURS, workspace_id: "w", role: "owner", status: "active" }]);
    if (method === "POST") {
      inserted = { table, body: JSON.parse(options.body || "{}") };
      return json([{ id: "created" }], 201);
    }
    if (!readable) return json({ message: "no" }, 500);

    // PostgREST honours both filters, so only rows scoped to us come back.
    const scoped = target.includes(`organization_id=eq.${OURS}`);
    if (table === "business_sub_apps") {
      if (target.includes(`&id=eq.${MY_SUB_APP}`)) return json(scoped ? [{ id: MY_SUB_APP, name: "Kennels", slug: "kennels", status: "draft" }] : []);
      if (target.includes("&id=eq.")) return json([]);
      return json(scoped ? [{ id: MY_SUB_APP, name: "Kennels", slug: "kennels", status: "draft", created_at: "2026-08-19T00:00:00Z" }] : []);
    }
    if (table === "business_sub_app_database_schemas") {
      if (target.includes(`&id=eq.${MY_SCHEMA}`)) return json(scoped ? [{ id: MY_SCHEMA, sub_app_id: MY_SUB_APP, schema_key: "kennel", fields: FIELDS }] : []);
      if (target.includes("&id=eq.")) return json([]);
      if (target.includes("schema_key=eq.kennel")) return json(scoped ? [{ id: MY_SCHEMA, schema_key: "kennel", fields: FIELDS, status: "draft" }] : []);
      if (target.includes("schema_key=eq.")) return json([]);
      return json(scoped ? [{ id: MY_SCHEMA, schema_key: "kennel", fields: FIELDS, status: "draft", created_at: "2026-08-19T00:00:00Z" }] : []);
    }
    if (table === "business_sub_app_records") {
      return json(scoped ? [{ id: "r1", data: { kennel_name: "Rex", nightly_rate: 4250, heated: true, size: "Large" }, created_at: "2026-08-19T00:00:00Z" }] : []);
    }
    return json([]);
  };
}

function post(path, body) {
  inserted = null;
  return request(app).post(path).set("Cookie", `${CUSTOMER_SESSION_COOKIE}=stub`).set("Accept", "application/json").send(body).redirects(0);
}

function open(path) {
  return request(app).get(path).set("Cookie", `${CUSTOMER_SESSION_COOKIE}=stub`).set("Accept", "text/html").redirects(0);
}

describe("a business can build its own record type", () => {
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
    readable = true;
    inserted = null;
    global.fetch = stub();
  });

  describe("what a field list means", () => {
    it("offers types that all render, validate and read back", () => {
      assert.ok(subApps.FIELD_TYPE_KEYS.length >= 5, "too few field types to be useful");
      for (const key of subApps.FIELD_TYPE_KEYS) {
        const spec = subApps.FIELD_TYPES[key];
        assert.ok(spec.label, `${key} has no label for the picker`);
        assert.ok(["text", "textarea", "number", "date", "checkbox", "select"].includes(spec.input), `${key} has no input to render as`);
      }
    });

    it("refuses a record type with no fields, which nothing could be entered against", () => {
      const result = subApps.normalizeFields([]);
      assert.equal(result.ok, false);
      assert.equal(result.code, "no_fields");
    });

    it("refuses a list field with no options, which would offer nothing", () => {
      const result = subApps.normalizeFields([{ label: "Size", type: "choice", choices: "" }]);
      assert.equal(result.ok, false);
      assert.equal(result.code, "choice_needs_options");
    });

    it("refuses two fields that would be stored under one key", () => {
      const result = subApps.normalizeFields([
        { label: "Kennel name", type: "text" },
        { label: "Kennel  Name", type: "text" }
      ]);
      assert.equal(result.ok, false);
      assert.equal(result.code, "duplicate_field");
    });

    it("refuses a type this product does not have", () => {
      const result = subApps.normalizeFields([{ label: "Photo", type: "file" }]);
      assert.equal(result.ok, false);
      assert.equal(result.code, "unknown_field_type");
    });
  });

  describe("what a record holds", () => {
    it("stores money in whole cents rather than as a float", () => {
      const result = subApps.coerceRecord(FIELDS, { kennel_name: "Rex", nightly_rate: "42.50" });
      assert.equal(result.ok, true);
      assert.equal(result.data.nightly_rate, 4250);
      assert.equal(subApps.displayValue(FIELDS[1], 4250), "$42.50");
    });

    it("refuses a negative amount rather than storing one", () => {
      const result = subApps.coerceRecord(FIELDS, { kennel_name: "Rex", nightly_rate: "-5" });
      assert.equal(result.ok, false);
      assert.equal(result.code, "negative_amount");
    });

    it("refuses a choice that is not one of the options", () => {
      const result = subApps.coerceRecord(FIELDS, { kennel_name: "Rex", size: "Enormous" });
      assert.equal(result.ok, false);
      assert.equal(result.code, "not_an_option");
    });

    it("keeps a blank optional field as null rather than dropping it", () => {
      const result = subApps.coerceRecord(FIELDS, { kennel_name: "Rex" });
      assert.equal(result.ok, true);
      // Present and null, so a reader can tell "left blank" from "this field
      // did not exist when the record was made".
      assert.ok(Object.prototype.hasOwnProperty.call(result.data, "nightly_rate"));
      assert.equal(result.data.nightly_rate, null);
    });

    it("treats an unticked checkbox as no rather than as unknown", () => {
      const result = subApps.coerceRecord(FIELDS, { kennel_name: "Rex" });
      assert.equal(result.data.heated, false);
    });

    it("keeps a date on the day it was written, whatever the timezone", () => {
      const dateField = [{ key: "starts", label: "Starts", type: "date", required: true }];
      const result = subApps.coerceRecord(dateField, { starts: "2026-08-19" });
      assert.equal(result.data.starts, "2026-08-19");
      assert.equal(subApps.coerceRecord(dateField, { starts: "19/08/2026" }).code, "not_a_date");
    });
  });

  describe("the pages", () => {
    it("opens the list of sub-apps", async () => {
      const result = await open("/business-builder/owner/sub-apps");
      assert.equal(result.status, 200);
      assert.match(result.text, /Kennels/);
    });

    it("opens one sub-app and shows its record types", async () => {
      const result = await open(`/business-builder/owner/sub-apps/${MY_SUB_APP}`);
      assert.equal(result.status, 200);
      assert.match(result.text, /kennel/i);
    });

    it("opens a record type and renders a field for each column", async () => {
      const result = await open(`/business-builder/owner/sub-apps/${MY_SUB_APP}/kennel`);
      assert.equal(result.status, 200);
      for (const field of FIELDS) {
        assert.match(result.text, new RegExp(`name="${field.key}"`), `no input for ${field.key}`);
      }
      // The choice field's options come from the stored schema, not from a list
      // written into the page.
      assert.match(result.text, /Medium/);
      // And a stored record reads back through the field's own type.
      assert.match(result.text, /\$42\.50/);
    });

    it("will not open another business's sub-app", async () => {
      const result = await open(`/business-builder/owner/sub-apps/${THEIR_SUB_APP}`);
      assert.equal(result.status, 404);
    });

    // A read that failed is not a business with no sub-apps.
    it("says the records could not be read rather than that there are none", async () => {
      readable = false;
      const result = await open("/business-builder/owner/sub-apps");
      assert.equal(result.status, 200);
      assert.match(result.text, /could not read/i);
      assert.doesNotMatch(result.text, /have not built one yet/i);
    });
  });

  describe("the writes", () => {
    it("creates a sub-app under this business", async () => {
      const result = await post("/api/business/sub-apps", { name: "Boat slips" });
      assert.equal(result.status, 201, JSON.stringify(result.body));
      assert.equal(inserted.table, "business_sub_apps");
      assert.equal(inserted.body.organization_id, OURS);
      assert.equal(inserted.body.slug, "boat_slips");
    });

    it("will not add a record type to another business's sub-app", async () => {
      const result = await post("/api/business/sub-app-schemas", {
        sub_app_id: THEIR_SUB_APP,
        schema_key: "slip",
        fields: [{ label: "Number", type: "text" }]
      });
      assert.equal(result.status, 404);
      assert.equal(result.body.code, "sub_app_not_yours");
      assert.equal(inserted, null, "another business's sub-app was written to");
    });

    // A read that failed is not a sub-app belonging to somebody else.
    it("says it could not check rather than that the sub-app is not yours", async () => {
      readable = false;
      const result = await post("/api/business/sub-app-schemas", {
        sub_app_id: MY_SUB_APP,
        schema_key: "slip",
        fields: [{ label: "Number", type: "text" }]
      });
      assert.equal(result.status, 503);
      assert.equal(result.body.code, "sub_app_unreadable");
      assert.equal(inserted, null);
    });

    it("saves a record against the schema stored in the database", async () => {
      const result = await post("/api/business/sub-app-records", {
        schema_id: MY_SCHEMA,
        kennel_name: "Rex",
        nightly_rate: "42.50",
        size: "Large"
      });
      assert.equal(result.status, 201, JSON.stringify(result.body));
      assert.equal(inserted.table, "business_sub_app_records");
      assert.equal(inserted.body.organization_id, OURS);
      assert.equal(inserted.body.schema_id, MY_SCHEMA);
      assert.equal(inserted.body.data.nightly_rate, 4250);
    });

    // The form is HTML and a browser can edit it. The stored schema cannot be.
    it("checks a record against the stored fields, not against what was submitted", async () => {
      const result = await post("/api/business/sub-app-records", {
        schema_id: MY_SCHEMA,
        kennel_name: "Rex",
        size: "Enormous"
      });
      assert.equal(result.status, 400);
      assert.equal(result.body.code, "not_an_option");
      assert.equal(inserted, null);
    });

    it("will not save a record against another business's record type", async () => {
      const result = await post("/api/business/sub-app-records", { schema_id: THEIR_SCHEMA, kennel_name: "Rex" });
      assert.equal(result.status, 404);
      assert.equal(result.body.code, "record_type_not_yours");
      assert.equal(inserted, null);
    });

    it("refuses an id that is not an id, rather than putting it in a filter", async () => {
      const result = await post("/api/business/sub-app-records", { schema_id: "not-a-uuid" });
      assert.equal(result.status, 400);
      assert.equal(inserted, null);
    });
  });

  // The column exists and this product cannot fill it. Asserted rather than
  // only commented, because the next person to see `deployment_url` will
  // reasonably assume it is meant to be written to.
  it("promises no deployment it cannot perform", () => {
    const fs = require("node:fs");
    const routeSource = fs.readFileSync(require.resolve("../routes/sonara-sub-app-routes.cjs"), "utf8");
    assert.doesNotMatch(routeSource, /deployment_url/, "a route writes deployment_url, and nothing here can deploy");
    assert.doesNotMatch(routeSource, /business_sub_app_deployments/, "a route writes to the deployments table, and nothing here deploys");
  });
});

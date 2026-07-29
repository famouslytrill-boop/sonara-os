"use strict";

// Every read of a tenant-scoped table has to name the organization.
//
// The Business Builder owner endpoints went out with the service key, which
// bypasses row level security, and the list handler built its query as
//
//     ?select=*&order=created_at.desc&limit=50
//
// with no organization filter at all. The matching POST had always scoped
// correctly, which is what made it easy to miss: writing was safe, reading was
// not. A signed-in manager at one business received every other business's
// staff profiles, customer bookings and vendor invoices.
//
// The page counts had the same hole from the other direction. Each owner page
// printed "Staff: N records" counted across every organization on the system,
// so a business with no staff could be shown somebody else's headcount.
//
// This test drives the real routes and inspects the queries they actually send,
// rather than asserting on the handler's return value -- the leak was in the URL
// and a response-shaped test would have passed while it was live.

const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const registerRoutes = require("../routes/sonara-last9-routes.cjs");
const { TENANT_SCOPED_TABLES } = require("../lib/sonara-tenant-scoped-tables.cjs");

const ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

// Every resource path the owner area exposes, with the table behind it.
const OWNER_RESOURCES = [
  ["/api/business/locations", "business_locations"],
  ["/api/business/services", "business_service_catalog"],
  ["/api/business/bookings", "business_bookings"],
  ["/api/business/staff", "business_employee_profiles"],
  ["/api/business/schedules", "employee_schedules"],
  ["/api/business/vendors", "vendor_accounts"],
  ["/api/business/invoices", "vendor_invoices"],
  ["/api/business/inventory", "inventory_items"],
  ["/api/business/recipes", "recipe_cards"],
  ["/api/business/menu-items", "menu_items"],
  ["/api/business/vehicles", "vehicle_records"],
  ["/api/business/maintenance", "maintenance_logs"],
  ["/api/business/waste", "waste_logs"],
  ["/api/creator/music-projects", "music_projects"],
  ["/api/integrations/jobs", "integration_jobs"],
  ["/api/sensory/profiles", "sensory_feedback_profiles"],
  ["/api/sensory/sound-cues", "sound_cues"],
  ["/api/sensory/haptic-patterns", "haptic_patterns"],
  ["/api/location/zones", "location_zones"]
];

function buildApp({ organization = ORGANIZATION_ID } = {}) {
  const app = express();
  app.use(express.json());
  const authenticate = (req, res, next) => {
    req.sonaraUser = { id: USER_ID, email: "owner@example.com" };
    return next();
  };
  registerRoutes(app, {
    layout: ({ title, heading, sections = [] }) => `<html><title>${title}</title><h1>${heading}</h1>${sections.join("")}</html>`,
    brandCard: (cardTitle, cardBody) => `<article><h2>${cardTitle}</h2><p>${cardBody}</p></article>`,
    linkAction: (href, label) => `<a href="${href}">${label}</a>`,
    escapeHtml: (value) => String(value).replace(/[&<>"']/g, ""),
    requireCustomer: authenticate,
    requireBusinessManager: authenticate,
    requireWorkspaceAccess: () => authenticate,
    getCustomerPrimaryOrganization: async () => (organization ? { ok: true, organizationId: organization } : { ok: false, code: "organization_setup_required" }),
    getSupabaseServerConfig: () => ({ ok: true, url: "https://project.supabase.co", serviceRoleKey: "server-only" })
  });
  return app;
}

function spyOnReads() {
  const reads = [];
  global.fetch = async (url) => {
    reads.push(String(url));
    return {
      ok: true,
      status: 200,
      headers: { get: () => "0-0/7" },
      json: async () => [{ id: "row", organization_id: "some-other-organization" }]
    };
  };
  return reads;
}

describe("Business Builder owner reads stay inside one business", () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("names the organization on every listing", async () => {
    const unscoped = [];
    for (const [path, table] of OWNER_RESOURCES) {
      const reads = spyOnReads();
      await request(buildApp()).get(path);
      const query = reads.find((url) => url.includes(`/rest/v1/${table}`));
      if (!query || !query.includes(`organization_id=eq.${ORGANIZATION_ID}`)) unscoped.push(`${path} -> ${query ? query.split("/rest/v1/")[1] : "(no read)"}`);
    }
    assert.deepEqual(
      unscoped,
      [],
      `These listings read a tenant table without naming the organization:\n  ${unscoped.join("\n  ")}\n\n` +
        "The service key bypasses row level security, so this filter is the only thing keeping one business's records away from another."
    );
  });

  it("refuses to list anything when it cannot tell which business is asking", async () => {
    // Better to answer nothing than to answer with everything.
    for (const [path, table] of OWNER_RESOURCES) {
      const reads = spyOnReads();
      const result = await request(buildApp({ organization: null })).get(path);
      assert.equal(result.status, 403, `${path} answered ${result.status} with no organization resolved`);
      assert.equal(reads.some((url) => url.includes(`/rest/v1/${table}`)), false, `${path} read ${table} before knowing who was asking`);
    }
  });

  it("counts only this business's records on the owner pages", async () => {
    const reads = spyOnReads();
    const result = await request(buildApp()).get("/business-builder/owner").set("accept", "text/html");
    assert.equal(result.status, 200);
    const counts = reads.filter((url) => url.includes("select=id"));
    assert.ok(counts.length > 0, "the owner page counted nothing at all");
    const global = counts.filter((url) => !url.includes(`organization_id=eq.${ORGANIZATION_ID}`));
    assert.deepEqual(global.map((url) => url.split("/rest/v1/")[1]), [], "these counts were taken across every organization");
  });

  it("keeps every table it touches on the tenant-scoped list", () => {
    // If one of these is ever reclassified as global, the filter above becomes
    // meaningless and this says so instead of silently passing.
    const notScoped = OWNER_RESOURCES.filter(([, table]) => !TENANT_SCOPED_TABLES.has(table)).map(([, table]) => table);
    assert.deepEqual(notScoped, [], `these owner tables are not on the tenant-scoped list: ${notScoped.join(", ")}`);
  });

  it("still tells a customer nothing about the machinery", async () => {
    spyOnReads();
    const result = await request(buildApp()).get("/business-builder/owner/staff").set("accept", "text/html");
    assert.equal(result.status, 200);
    for (const word of ["supabase", "service role", "service-role", "schema"]) {
      assert.doesNotMatch(result.text.toLowerCase(), new RegExp(word), `the owner page says "${word}" to a customer`);
    }
  });
});

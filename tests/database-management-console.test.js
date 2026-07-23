"use strict";

const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const registerDatabaseManagementRoutes = require("../routes/sonara-database-management-routes.cjs");

describe("database management console", () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("keeps the database catalog founder/admin protected", async () => {
    const app = express();
    registerDatabaseManagementRoutes(app, {
      requireAdmin: (req, res) => res.status(401).json({ ok: false, code: "admin_auth_required" })
    });

    await request(app)
      .get("/api/admin/database-management")
      .expect(401)
      .expect(({ body }) => {
        assert.equal(body.code, "admin_auth_required");
      });
  });

  it("returns live section metadata without exposing service credentials", async () => {
    const app = buildApp();
    global.fetch = async (url, options) => {
      assert.match(url, /\/rest\/v1\/rpc\/sonara_database_management_snapshot$/);
      assert.equal(options.method, "POST");
      assert.equal(options.headers.Authorization, "Bearer service-role-test");
      return jsonResponse(200, sampleSnapshot());
    };

    await request(app)
      .get("/api/admin/database-management?section=tables")
      .expect(200)
      .expect(({ body, text }) => {
        assert.equal(body.ok, true);
        assert.equal(body.status, "live_read_only");
        assert.equal(body.section.key, "tables");
        assert.equal(body.data[0].name, "organizations");
        assert.equal(text.includes("service-role-test"), false);
      });
  });

  it("reconciles local and remotely applied migration versions", async () => {
    const app = buildApp();
    global.fetch = async () => jsonResponse(200, sampleSnapshot());

    await request(app)
      .get("/api/admin/database-management?section=migrations")
      .expect(200)
      .expect(({ body }) => {
        assert.equal(Array.isArray(body.data.applied), true);
        assert.equal(Array.isArray(body.data.local), true);
        assert.equal(Array.isArray(body.data.pending), true);
        assert.equal(Array.isArray(body.data.remoteOnly), true);
        assert.equal(typeof body.data.synchronized, "boolean");
      });
  });

  it("renders the complete management navigation and real schema graph", async () => {
    const app = buildApp();
    global.fetch = async () => jsonResponse(200, sampleSnapshot());

    await request(app)
      .get("/admin/database-management?section=schema-visualizer")
      .expect(200)
      .expect("Content-Type", /html/)
      .expect(({ text }) => {
        for (const label of [
          "Schema Visualizer",
          "Tables",
          "Functions",
          "Triggers",
          "Enumerated Types",
          "Extensions",
          "Indexes",
          "Publications",
          "Access Control",
          "Policies",
          "Roles",
          "Configuration",
          "Settings",
          "Platform",
          "Replication",
          "Backups",
          "Migrations"
        ]) {
          assert.match(text, new RegExp(label));
        }
        assert.match(text, /public\.organizations/);
        assert.match(text, /public\.workspaces/);
      });
  });

  it("redirects the legacy database and migration pages into the unified console", async () => {
    const app = buildApp();

    await request(app)
      .get("/admin/database")
      .expect(302)
      .expect("Location", "/admin/database-management");

    await request(app)
      .get("/admin/migrations")
      .expect(302)
      .expect("Location", "/admin/database-management?section=migrations");
  });

  it("reports the exact required migration when the catalog RPC is missing", async () => {
    const app = buildApp();
    global.fetch = async () => jsonResponse(404, {
      code: "PGRST202",
      message: "Could not find the function public.sonara_database_management_snapshot"
    });

    await request(app)
      .get("/api/admin/database-management")
      .expect(503)
      .expect(({ body }) => {
        assert.equal(body.code, "database_catalog_migration_required");
        assert.equal(body.migration, "20260723033000_database_management_catalog.sql");
      });
  });
});

function buildApp() {
  const app = express();
  registerDatabaseManagementRoutes(app, {
    requireAdmin: (req, res, next) => {
      req.sonaraAdmin = { role: "founder" };
      next();
    },
    recordAdminAuditEvent: async () => undefined,
    getSupabaseServerConfig: () => ({
      ok: true,
      url: "https://example.supabase.co",
      serviceRoleKey: "service-role-test"
    }),
    supabaseHeaders: (config, extra = {}) => ({
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
      ...extra
    }),
    layout: ({ title, eyebrow, heading, body, sections = [], actions = [] }) =>
      `<!doctype html><html><head><title>${title}</title></head><body><p>${eyebrow}</p><h1>${heading}</h1><p>${body}</p><nav>${actions.join("")}</nav>${sections.join("")}</body></html>`,
    brandCard: (title, body) => `<article class="card"><h2>${title}</h2><p>${body}</p></article>`,
    linkAction: (href, label) => `<a class="action" href="${href}">${label}</a>`,
    escapeHtml: (value) => String(value)
  });
  return app;
}

function sampleSnapshot() {
  return {
    generatedAt: "2026-07-23T03:30:00Z",
    platform: {
      database: "postgres",
      serverVersion: "17",
      catalogMode: "live_read_only"
    },
    schemas: [{ name: "public", owner: "postgres", managed: false }],
    schemaGraph: {
      nodes: [
        { schema: "public", name: "organizations", kind: "table", columnCount: 4, rlsEnabled: true },
        { schema: "public", name: "workspaces", kind: "table", columnCount: 5, rlsEnabled: true }
      ],
      edges: [
        {
          name: "workspaces_organization_id_fkey",
          sourceSchema: "public",
          sourceTable: "workspaces",
          sourceColumns: ["organization_id"],
          targetSchema: "public",
          targetTable: "organizations",
          targetColumns: ["id"]
        }
      ]
    },
    tables: [{ schema: "public", name: "organizations", kind: "table", rlsEnabled: true }],
    functions: [{ schema: "public", name: "sonara_database_management_snapshot", kind: "function" }],
    triggers: [],
    enumTypes: [],
    extensions: [{ name: "pgcrypto", version: "1.3", schema: "extensions" }],
    indexes: [],
    publications: [],
    accessControl: { tableGrants: [], schemaGrants: [], defaultPrivileges: [] },
    policies: [],
    roles: [{ role: "service_role", canLogin: false }],
    configuration: { rowLevelSecurity: { enabledTableCount: 2, disabledTableCount: 0 } },
    settings: [],
    replication: { walLevel: "logical", senders: [], slots: [], subscriptions: [] },
    backups: {
      status: "provider_managed_verification_required",
      sqlIntrospectionAvailable: false,
      mutationAvailableInApplication: false
    },
    migrations: {
      applied: [
        { version: "20260722201500", name: "reference_intelligence_system" },
        { version: "20260722201600", name: "extend_database_contract_reference_intelligence" }
      ]
    }
  };
}

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  };
}

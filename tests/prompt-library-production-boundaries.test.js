"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const request = require("supertest");
const registerPromptLibraryRoutes = require("../routes/sonara-prompt-library-routes.cjs");

const root = path.join(__dirname, "..");
const userId = "11111111-1111-4111-8111-111111111111";
const organizationId = "22222222-2222-4222-8222-222222222222";

describe("Prompt Library production boundaries", () => {
  it("grants only the server role and replaces direct authenticated RPC access", () => {
    const sql = read("supabase/migrations/20260726194500_prompt_library_production_boundaries.sql").toLowerCase();
    assert.match(sql, /revoke all on function public\.create_sonara_prompt_version\(uuid,text,text,text,text\)[\s\S]*?from public, anon, authenticated/);
    assert.match(sql, /grant execute on function public\.create_sonara_prompt_version\(uuid,text,text,text,text\)[\s\S]*?to service_role/);
    assert.doesNotMatch(sql, /grant execute on function public\.create_sonara_prompt_version\(uuid,text,text,text,text\)[\s\S]*?to authenticated/);
    assert.match(sql, /grant select, insert, update, delete on table public\.%i to service_role/);
    assert.match(sql, /revoke all on table public\.%i from public, anon, authenticated/);
    assert.match(sql, /if auth\.role\(\) <> 'service_role' then/);
  });

  it("synchronizes variable schemas atomically for current and historical versions", () => {
    const sql = read("supabase/migrations/20260726194500_prompt_library_production_boundaries.sql").toLowerCase();
    assert.match(sql, /add column if not exists input_schema jsonb/);
    assert.match(sql, /regexp_matches\([\s\S]*?\{\\\{\\s\*\(\[a-za-z\]/i);
    assert.match(sql, /input_schema = v_input_schema/);
    assert.match(sql, /insert into public\.sonara_prompt_versions[\s\S]*?input_schema/);
    assert.match(sql, /prompt_protected_variable_name/);
  });

  it("enforces creator-only private visibility in server-mediated queries and record reads", () => {
    const routes = read("routes/sonara-prompt-library-routes.cjs");
    assert.match(routes, /promptVisibilityQuery\(req\.sonaraUser\?\.id, true\)/);
    assert.match(routes, /promptVisibilityQuery\(req\.sonaraUser\?\.id, false\)/);
    assert.match(routes, /visibility\.eq\.private,created_by\.eq/);
    assert.match(routes, /visibility\.eq\.public,status\.eq\.published/);
    assert.match(routes, /canReadVisibilityScopedRecord\(row, userId\)/);
    assert.match(routes, /row\.visibility === "private"/);
    assert.match(routes, /ownedRecordStatus/);
  });

  it("rejects PAN and CVV data before attempting a Prompt Library database write", async () => {
    let fetchCalled = false;
    const previousFetch = global.fetch;
    global.fetch = async () => {
      fetchCalled = true;
      throw new Error("database fetch should not occur for rejected payment data");
    };

    try {
      const app = buildIsolatedPromptApp();
      const pan = await request(app)
        .post("/api/prompt-library/runs")
        .send({
          productArea: "growth_studio",
          slug: "lead-follow-up-sequence",
          values: { known_context: "Card 4111 1111 1111 1111" }
        });
      assert.equal(pan.status, 400);
      assert.equal(pan.body.code, "protected_data_detected");
      assert.ok(pan.body.findings.includes("payment_card_number"));
      assert.equal(fetchCalled, false);

      const cvv = await request(app)
        .post("/api/prompt-library/runs")
        .send({
          productArea: "growth_studio",
          slug: "lead-follow-up-sequence",
          values: { known_context: "CVV: 123" }
        });
      assert.equal(cvv.status, 400);
      assert.ok(cvv.body.findings.includes("payment_card_security_code"));
      assert.equal(fetchCalled, false);
    } finally {
      global.fetch = previousFetch;
    }
  });

  it("adds visibility constraints to live template and collection list requests", async () => {
    const urls = [];
    const previousFetch = global.fetch;
    global.fetch = async (url) => {
      urls.push(String(url));
      return { ok: true, json: async () => [] };
    };

    try {
      const app = buildIsolatedPromptApp();
      const templates = await request(app).get("/api/prompt-library/templates?product=business_builder");
      assert.equal(templates.status, 200);
      const collections = await request(app).get("/api/prompt-library/collections?product=business_builder");
      assert.equal(collections.status, 200);
      assert.equal(urls.length, 2);
      assert.match(urls[0], /or=\(visibility\.eq\.organization,and\(visibility\.eq\.public,status\.eq\.published\),and\(visibility\.eq\.private,created_by\.eq\.11111111-1111-4111-8111-111111111111\)\)/);
      assert.match(urls[1], /or=\(visibility\.eq\.organization,and\(visibility\.eq\.private,created_by\.eq\.11111111-1111-4111-8111-111111111111\)\)/);
    } finally {
      global.fetch = previousFetch;
    }
  });

  it("verifies the additive security migration in the canonical Supabase gate", () => {
    const verifier = read("scripts/verify-supabase-contract.mjs");
    assert.match(verifier, /promptLibrarySecurityMigrationName/);
    assert.match(verifier, /20260726194500_prompt_library_production_boundaries\.sql/);
    assert.match(verifier, /promptLibrarySecurityMigrationPath/);
    assert.match(verifier, /to service_role/);
    assert.match(verifier, /input_schema = v_input_schema/);
  });
});

function buildIsolatedPromptApp() {
  const app = express();
  app.use(express.json());
  registerPromptLibraryRoutes(app, {
    requireWorkspaceAccess: () => (req, res, next) => {
      req.sonaraUser = { id: userId, email: "owner@example.test" };
      next();
    },
    requireAdmin: (req, res, next) => next(),
    getSupabaseServerConfig: () => ({ ok: true, url: "https://database.example.test", serviceRoleKey: "test-only" }),
    getCustomerPrimaryOrganization: async () => ({ ok: true, organizationId }),
    supabaseHeaders: () => ({ "content-type": "application/json" }),
    insertActivityEvent: async () => ({ ok: true }),
    recordAdminAuditEvent: async () => undefined
  });
  return app;
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

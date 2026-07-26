"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const request = require("supertest");
const app = require("../server");

const root = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const customerBackendLanguage = /service-role|server-side Supabase|organization_memberships|profiles, organizations|account database setup|database migrations?|environment variables?|\bRLS\b/i;

describe("customer-ready production experience", () => {
  it("uses one public login entry for customers, business managers, and approved administrators", async () => {
    const business = await request(app).get("/business-builder/login");
    assert.equal(business.status, 303);
    assert.equal(business.headers.location, "/login?next=%2Fbusiness-builder%2Fdashboard");

    const admin = await request(app).get("/admin/login");
    assert.equal(admin.status, 303);
    assert.equal(admin.headers.location, "/login?next=%2Fadmin");

    const login = await request(app).get("/login?next=%2Fcreator-studio%2Fdashboard");
    assert.equal(login.status, 200);
    assert.match(login.text, /name="next" value="\/creator-studio\/dashboard"/);
    assert.match(login.text, /Reset password/);
    assert.doesNotMatch(login.text, customerBackendLanguage);
  });

  it("renders complete password recovery and update surfaces", async () => {
    const recovery = await request(app).get("/forgot-password");
    assert.equal(recovery.status, 200);
    assert.match(recovery.text, /Send recovery link/);
    assert.doesNotMatch(recovery.text, customerBackendLanguage);

    const update = await request(app).get("/account/update-password");
    assert.equal(update.status, 200);
    assert.match(update.text, /data-sonara-recovery-token/);
    assert.match(update.text, /Update password/);
    assert.doesNotMatch(update.text, customerBackendLanguage);
  });

  it("keeps public company pages free of infrastructure language", async () => {
    for (const route of ["/", "/business-builder", "/creator-studio", "/growth-studio", "/pricing", "/free-tools"]) {
      const response = await request(app).get(route);
      assert.equal(response.status, 200, `${route} unavailable`);
      assert.doesNotMatch(response.text, customerBackendLanguage, `${route} leaks backend terminology`);
    }
  });

  it("ships a real brightness control while retaining motion, sound, and haptic controls", async () => {
    const response = await request(app).get("/");
    assert.equal(response.status, 200);
    assert.match(response.text, /data-sonara-preference="brightness"/);
    assert.match(response.text, /data-sonara-preference="motion"/);
    assert.match(response.text, /data-sonara-preference="sound"/);
    assert.match(response.text, /data-sonara-preference="haptics"/);

    const client = read("public/sonara-one.js");
    assert.match(client, /navigator\.vibrate/);
    assert.match(client, /AudioContext/);
    assert.match(client, /--sonara-brightness/);
  });

  it("locks atomic workspace bootstrap to the service role", () => {
    const migration = read("supabase/migrations/20260726093000_customer_workspace_bootstrap.sql");
    assert.match(migration, /security definer/i);
    assert.match(migration, /revoke all[\s\S]*from public, anon, authenticated/i);
    assert.match(migration, /grant execute[\s\S]*to service_role/i);
    assert.match(migration, /on conflict \(organization_id, user_id\) do update/i);
  });

  it("uses stable geometry, accessible controls, and reduced-motion fallbacks", () => {
    const styles = read("public/sonara-application-ui.css");
    assert.match(styles, /--sonara-page-max:\s*1240px/);
    assert.match(styles, /min-height:\s*48px/);
    assert.match(styles, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
    assert.match(styles, /prefers-reduced-motion:\s*reduce/);
  });
});

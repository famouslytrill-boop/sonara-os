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
  it("presents one visible public login while retaining protected compatibility routes", async () => {
    const home = await request(app).get("/");
    assert.equal(home.status, 200);
    assert.match(home.text, /href="\/login"/);
    assert.doesNotMatch(home.text, /href="\/business-builder\/login"/);
    assert.doesNotMatch(home.text, /href="\/admin\/login"/);

    const business = await request(app).get("/business-builder/login");
    assert.equal(business.status, 200);

    const login = await request(app).get("/login");
    assert.equal(login.status, 200);
    assert.match(login.text, /Login with email/);
    assert.match(login.text, /href="\/forgot-password"/);
    assert.doesNotMatch(login.text, customerBackendLanguage);
  });

  it("retains complete password recovery and update surfaces", async () => {
    const recovery = await request(app).get("/forgot-password");
    assert.equal(recovery.status, 200);
    assert.match(recovery.text, /Send reset link/);
    assert.doesNotMatch(recovery.text, customerBackendLanguage);

    const update = await request(app).get("/reset-password");
    assert.equal(update.status, 200);
    assert.match(update.text, /data-sonara-recovery-token/);
    assert.match(update.text, /Update password/);
    assert.doesNotMatch(update.text, customerBackendLanguage);
  });

  it("keeps public company pages free of visible infrastructure language", async () => {
    for (const route of ["/", "/business-builder", "/creator-studio", "/growth-studio", "/pricing", "/free-tools"]) {
      const response = await request(app).get(route);
      assert.equal(response.status, 200, `${route} unavailable`);
      assert.doesNotMatch(response.text.replace(/<[^>]+hidden[^>]*>[\s\S]*?<\/[^>]+>/gi, ""), customerBackendLanguage, `${route} leaks visible backend terminology`);
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

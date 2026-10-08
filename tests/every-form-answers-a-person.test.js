"use strict";

// Every form on every page answers the person who pressed it with a page, and
// a page that says what happened.
//
// Two defects, both invisible to every check that existed:
//
//   - Forms that answered a browser with JSON. The nine Growth Studio create
//     forms, clocking in and saving a voice permission all posted to handlers
//     that answered only in JSON, so pressing Save showed {"ok":true,...} or
//     {"ok":false,"code":"..."}. The form tests posted with
//     Accept: application/json, and tests/no-save-looks-like-it-worked.test.js
//     accepts a JSON ok:false as an honest answer -- which it is, for a script.
//
//   - Pages that did not read the problem they were sent back with. All
//     seventeen Business Builder owner pages with a create form redirected a
//     refused save to ?problem=<code> and rendered exactly as before, so a
//     person could not tell "saved" from "not saved". The no-save test was
//     green, because it checks that the redirect carries the problem and not
//     that the page it lands on mentions it.
//
// So this posts each form the way a browser does -- the body read off the
// rendered form, Accept: text/html -- twice: with every write succeeding, and
// with every write failing. No answer may be JSON. And a failed write that
// redirects must land on a page that reads differently from the same page
// without the query: a page that renders identically has said nothing.
//
// What it does not cover, stated rather than implied. The crawl renders every
// page in the empty state, as tests/every-form-posts-somewhere.test.js does, so
// a form rendered once per row -- a row action -- renders zero times and is not
// posted here. Multipart upload forms are skipped: their bodies are files.

const assert = require("node:assert/strict");
const request = require("supertest");

const SUPABASE_ENV = Object.freeze({
  SUPABASE_URL: "https://stub.supabase.co",
  NEXT_PUBLIC_SUPABASE_URL: "https://stub.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-anon-key-for-form-answers",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-anon-key-for-form-answers",
  SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-service-role-for-form-answers"
});
const original = Object.fromEntries(Object.keys(SUPABASE_ENV).map((key) => [key, process.env[key]]));

const app = require("../server");
const { CUSTOMER_SESSION_COOKIE } = require("../lib/sonara-customer-auth.cjs");

const USER = { id: "33333333-3333-4333-8333-333333333333", email: "form-answers@example.com" };
const ORGANIZATION_ID = "44444444-4444-4444-8444-444444444444";
const CREATED = "55555555-5555-4555-8555-555555555555";
const BROWSER = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
const COOKIE = [`${CUSTOMER_SESSION_COOKIE}=stub-session`];

// Floors, below what was measured on 8 October 2026 (323 pages rendered, 184
// distinct POST forms), so an empty crawl fails loudly instead of passing.
const MINIMUM_PAGES = 250;
const MINIMUM_FORMS = 150;
const MINIMUM_FAILED_WRITES = 60;

const json = (body, status = 200) => ({ ok: status < 400, status, headers: { get: () => null }, json: async () => body, text: async () => JSON.stringify(body) });

// The body this form sends: every select's first real option, every textarea,
// every input by type, every hidden field as written. Optional links are left
// empty, as a person who links nothing leaves them.
function bodyOf(form) {
  const body = {};
  for (const match of form.matchAll(/<select\b[^>]*\bname="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)) {
    const options = [...match[2].matchAll(/<option value="([^"]*)"/g)].map((option) => option[1]).filter(Boolean);
    if (options.length) body[match[1]] = options[0];
  }
  for (const match of form.matchAll(/<textarea\b[^>]*\bname="([^"]+)"/g)) body[match[1]] = "X";
  for (const match of form.matchAll(/<input\b([^>]*)>/g)) {
    const attributes = match[1];
    const name = (attributes.match(/\bname="([^"]+)"/) || [])[1];
    if (!name || body[name] !== undefined) continue;
    const type = ((attributes.match(/\btype="([^"]+)"/) || ["", "text"])[1]).toLowerCase();
    const value = (attributes.match(/\bvalue="([^"]*)"/) || [])[1];
    if (type === "hidden" || type === "submit") body[name] = value ?? "";
    else if (type === "checkbox" || type === "radio") body[name] = value ?? "on";
    else if (type === "number") body[name] = "1";
    else if (type === "date") body[name] = "2026-08-01";
    else if (type === "email") body[name] = "a@b.co";
    else if (type === "file") continue;
    else body[name] = value || (/_id$/.test(name) ? "" : "X");
  }
  return body;
}

const normalised = (html) => String(html || "").replace(/\s+/g, " ").trim();

describe("every form answers a person with a page that says what happened", function () {
  this.timeout(120000);

  let realFetch;
  let writesFail = false;
  let current = null;
  const wrote = new Set();
  const forms = new Map();
  let pagesRendered = 0;

  before(async () => {
    Object.assign(process.env, SUPABASE_ENV);
    realFetch = global.fetch;
    global.fetch = async (url, options = {}) => {
      const target = String(url);
      const method = (options.method || "GET").toUpperCase();
      if (target.includes("/auth/v1/user")) return json(USER);
      if (target.includes("/rest/v1/rpc/")) return json({});
      if (!target.includes("/rest/v1/")) return undefined;
      const table = (target.split("/rest/v1/")[1] || "").split("?")[0];
      if (table === "organization_memberships") return json([{ organization_id: ORGANIZATION_ID, user_id: USER.id, role: "owner", status: "active" }]);
      if (table === "business_memberships") return json([{ id: "membership", organization_id: ORGANIZATION_ID, workspace_id: "workspace", role: "owner", status: "active" }]);
      if (table === "organizations") return json([{ id: ORGANIZATION_ID, name: "Form Answers Ltd" }]);
      if (table === "billing_entitlements") {
        const asked = decodeURIComponent((target.match(/entitlement_key=in\.\(([^)]*)\)/) || ["", ""])[1]).split(",").filter(Boolean);
        const granted = asked.includes("all_three_monthly") ? "all_three_monthly" : asked[0];
        return json(granted ? [{ entitlement_key: granted, status: "active" }] : []);
      }
      if (method !== "GET") {
        if (current) wrote.add(current);
        return writesFail ? json({ message: "unavailable" }, 500) : json([{ id: CREATED, organization_id: ORGANIZATION_ID }], 201);
      }
      return json([]);
    };

    const routes = [];
    (function walk(stack) {
      for (const layer of stack) {
        if (layer.route) routes.push({ path: layer.route.path, methods: Object.keys(layer.route.methods) });
        else if (layer.handle && layer.handle.stack) walk(layer.handle.stack);
      }
    })(app._router ? app._router.stack : app.router.stack);
    const pages = [...new Set(routes.filter((route) => route.methods.includes("get")).map((route) => route.path))]
      .filter((path) => !path.includes(":") && !path.startsWith("/api/") && !path.startsWith("/admin") && path !== "/auth/callback")
      .sort();

    for (const page of pages) {
      let rendered;
      try {
        rendered = await request(app).get(page).set("Accept", BROWSER).set("Cookie", COOKIE);
      } catch {
        continue;
      }
      if (rendered.status !== 200 || !/text\/html/.test(rendered.headers["content-type"] || "")) continue;
      pagesRendered += 1;
      for (const match of rendered.text.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)) {
        const attributes = match[1];
        const action = (attributes.match(/\baction="([^"]*)"/i) || [])[1];
        const method = ((attributes.match(/\bmethod="([^"]*)"/i) || [])[1] || "get").toLowerCase();
        if (!action || method !== "post" || !action.startsWith("/") || /enctype="multipart/i.test(attributes)) continue;
        const key = action.split("#")[0];
        if (!forms.has(key)) forms.set(key, { action: key, page, body: bodyOf(match[2]) });
      }
    }
  });

  after(() => {
    global.fetch = realFetch;
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  async function post(form) {
    current = form.action;
    try {
      return await request(app).post(form.action).set("Accept", BROWSER).set("Cookie", COOKIE).type("form").send(form.body).redirects(0);
    } finally {
      current = null;
    }
  }

  it("crawled the pages and found the forms, rather than passing over none", () => {
    assert.ok(pagesRendered >= MINIMUM_PAGES, `only ${pagesRendered} pages rendered; this check has gone blind`);
    assert.ok(forms.size >= MINIMUM_FORMS, `only ${forms.size} POST forms found; this check has gone blind`);
  });

  it("answers no form a browser posts with JSON, when the write succeeds", async () => {
    writesFail = false;
    const answeredWithJson = [];
    for (const form of forms.values()) {
      const answer = await post(form);
      if (/application\/json/.test(answer.headers["content-type"] || "")) answeredWithJson.push(`${form.action} (on ${form.page}) answered ${answer.status} with JSON`);
    }
    assert.deepEqual(answeredWithJson, [], "a person who pressed one of these was shown raw JSON");
  });

  it("answers no form with JSON when the write fails, and lands on a page that says so", async () => {
    writesFail = true;
    wrote.clear();
    const findings = [];
    let failedWrites = 0;
    for (const form of forms.values()) {
      const answer = await post(form);
      if (/application\/json/.test(answer.headers["content-type"] || "")) {
        findings.push(`${form.action} (on ${form.page}) answered ${answer.status} with JSON after its write failed`);
        continue;
      }
      if (!wrote.has(form.action)) continue;
      failedWrites += 1;
      if (answer.status !== 303) continue;
      const location = String(answer.headers.location || "");
      const [path, query = ""] = location.split("#")[0].split("?");
      if (!path.startsWith("/")) continue;
      if (!query) {
        findings.push(`${form.action} (on ${form.page}) redirected to ${location} after its write failed, with nothing for the page to say`);
        continue;
      }
      const told = await request(app).get(`${path}?${query}`).set("Accept", BROWSER).set("Cookie", COOKIE);
      const plain = await request(app).get(path).set("Accept", BROWSER).set("Cookie", COOKIE);
      if (normalised(told.text) === normalised(plain.text)) {
        findings.push(`${form.action} (on ${form.page}) sent a failed write to ${location}, and that page says nothing about it`);
      }
    }
    writesFail = false;
    assert.ok(failedWrites >= MINIMUM_FAILED_WRITES, `only ${failedWrites} forms reached a write; this check has gone blind`);
    assert.deepEqual(findings, [], "a person whose save failed was not told");
  });
});

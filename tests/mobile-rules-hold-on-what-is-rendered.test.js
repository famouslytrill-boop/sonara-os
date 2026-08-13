"use strict";

// AGENTS.md: "Mobile layouts must avoid overflow and use large enough tap
// targets."
//
// Both rules hold. Neither was being checked.
//
// tests/design-system.test.js asserts `--sonara-tap: 44px` and
// `max-width: 100%` appear in public/sonara-design-system.css. The token is
// real, and the only selector that consumes it is `.sonara-ds-button` -- which
// the application never renders. Across six representative pages the
// interactive elements are 43 bare `<button>`, 41 `a.action`, 39 bare
// `<input>`, 14 `<select>` and 2 `<textarea>`, and not one `.sonara-ds-button`.
//
// The rules that actually govern those elements live in
// public/sonara-application-ui.css and had nothing watching them. Delete the
// line giving `.action, button, input[type=submit]` a 46px minimum and every
// control in the product collapses while the design-system test stays green.
//
// So this reads the selectors the application renders, and checks the served
// stylesheet against those.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const request = require("supertest");

const SUPABASE_ENV = Object.freeze({
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-anon-key-for-mobile",
  SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-service-role-for-mobile"
});
const original = Object.fromEntries(Object.keys(SUPABASE_ENV).map((key) => [key, process.env[key]]));

const app = require("../server");
const { CUSTOMER_SESSION_COOKIE } = require("../lib/sonara-customer-auth.cjs");

const css = fs.readFileSync(path.join(__dirname, "..", "public", "sonara-application-ui.css"), "utf8");

const USER = { id: "33333333-3333-4333-8333-333333333333", email: "mobile@example.com" };
const ORGANIZATION_ID = "44444444-4444-4444-8444-444444444444";
const MINIMUM_TAP = 44;

// Enough of the product to be representative: the public front, the pricing
// page, one record page from each studio, and an account page.
const SAMPLE = [
  "/",
  "/pricing",
  "/business-builder/owner/customers",
  "/growth-studio/segments",
  "/creator-studio/assets",
  "/account/data"
];

const json = (body, status = 200) => ({ ok: status < 400, status, headers: { get: () => null }, json: async () => body });

function stubFetch() {
  return async (url) => {
    const target = String(url);
    if (target.includes("/auth/v1/user")) return json(USER);
    if (target.includes("/rest/v1/rpc/")) return json({});
    if (!target.includes("/rest/v1/")) return undefined;
    const table = (target.split("/rest/v1/")[1] || "").split("?")[0];
    if (table === "organization_memberships") return json([{ organization_id: ORGANIZATION_ID, user_id: USER.id, role: "owner", status: "active" }]);
    if (table === "business_memberships") return json([{ id: "m", organization_id: ORGANIZATION_ID, workspace_id: "w", role: "owner", status: "active" }]);
    if (table === "organizations") return json([{ id: ORGANIZATION_ID, name: "Mobile Ltd" }]);
    if (table === "billing_entitlements") {
      const asked = decodeURIComponent((target.match(/entitlement_key=in\.\(([^)]*)\)/) || ["", ""])[1]).split(",").filter(Boolean);
      return json(asked[0] ? [{ entitlement_key: asked[0], status: "active" }] : []);
    }
    return json([]);
  };
}

// The minimum height the served stylesheet gives anything matching `selector`.
// Deliberately crude -- it looks for a rule whose selector list mentions the
// token and reads its min-height -- because the alternative is a CSS parser,
// and the failure this guards against is a rule being deleted rather than a
// cascade subtlety.
function declaredMinHeight(token) {
  let best = 0;
  for (const match of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const selectors = match[1];
    const block = match[2];
    if (!new RegExp(`(^|[,\\s])${token}(\\s|,|\\[|:|\\{|$)`).test(selectors)) continue;
    const height = block.match(/min-height:\s*(\d+)px/);
    if (height) best = Math.max(best, Number(height[1]));
  }
  return best;
}

describe("the mobile rules hold on what is actually rendered", () => {
  let realFetch;
  const used = new Map();
  let pagesRendered = 0;

  before(async function render() {
    this.timeout(60000);
    Object.assign(process.env, SUPABASE_ENV);
    realFetch = global.fetch;
    global.fetch = stubFetch();

    for (const route of SAMPLE) {
      const response = await request(app).get(route).set("Accept", "text/html").set("Cookie", `${CUSTOMER_SESSION_COOKIE}=stub`).redirects(0);
      if (response.status !== 200) continue;
      pagesRendered += 1;
      for (const match of String(response.text || "").matchAll(/<(button|a|input|select|textarea)\b([^>]*)>/g)) {
        const [, tag, attributes] = match;
        if (tag === "a" && !/href=/.test(attributes)) continue;
        if (tag === "input" && /type="hidden"/.test(attributes)) continue;
        const classes = (attributes.match(/class="([^"]*)"/) || ["", ""])[1].trim();
        const key = tag === "a" && classes ? `.${classes.split(/\s+/)[0]}` : tag;
        used.set(key, (used.get(key) || 0) + 1);
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

  it("rendered the sample, rather than measuring an empty page", () => {
    assert.ok(pagesRendered >= 5, `only ${pagesRendered} of ${SAMPLE.length} sample pages rendered`);
    const controls = [...used.values()].reduce((total, count) => total + count, 0);
    assert.ok(controls >= 100, `only ${controls} interactive elements found across the sample; the scrape has gone blind`);
  });

  // The selectors that carry a size, and are the ones the product renders.
  it("gives every control the application renders a 44px minimum", () => {
    const tooSmall = [];
    for (const token of ["button", "input", "select", "textarea", ".action"]) {
      // Only assert about controls the sample actually contains, so this
      // cannot pass by checking selectors nothing uses -- which is exactly how
      // the existing token assertion passes today.
      const rendered = token === ".action" ? used.get(".action") : used.get(token);
      if (!rendered) continue;
      const height = declaredMinHeight(token.startsWith(".") ? `\\${token}` : token);
      if (height < MINIMUM_TAP) tooSmall.push(`${token} (${rendered} rendered) has ${height ? `a ${height}px minimum` : "no minimum height at all"}`);
    }
    assert.deepEqual(
      tooSmall,
      [],
      `AGENTS.md requires large enough tap targets and these are below ${MINIMUM_TAP}px:\n  ${tooSmall.join("\n  ")}`
    );
  });

  it("checks a control the application does render, not one it does not", () => {
    // The guard on the check above. `.sonara-ds-button` carries the tap token
    // in the design system and appears in no rendered page; if the sample ever
    // consists only of selectors like that, the loop above passes over nothing.
    assert.ok(used.get("button") >= 10, `only ${used.get("button") || 0} bare buttons in the sample`);
    assert.ok(used.get(".action") >= 10, `only ${used.get(".action") || 0} .action links in the sample`);
    assert.ok(used.get("input") >= 10, `only ${used.get("input") || 0} inputs in the sample`);
  });

  it("stops the page scrolling sideways, and lets a wide table scroll inside itself", () => {
    // A record table is wider than a phone. The body must not scroll with it,
    // and the table must, or the columns are simply unreachable.
    assert.match(css, /body\{[^}]*overflow-x:\s*(clip|hidden)/, "the page body does not contain horizontal overflow");
    const mobile = css.split(/@media[^{]*max-width:\s*(?:6[0-9]{2}|7[0-9]{2})px[^{]*\{/).slice(1).join("\n");
    assert.ok(mobile.length > 200, "no small-screen media query found; this check has gone blind");
    assert.match(mobile, /table\{[^}]*overflow-x:\s*auto/, "a wide table has no way to scroll on a small screen");
  });
});

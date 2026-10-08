// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../server");
const { TRUST_DESTINATIONS } = require("../lib/sonara-trust-navigation.cjs");
const { contactForm } = require("../lib/sonara-shell.cjs");

// The shared page shell renders each company; this deliberately exercises
// actual HTTP surfaces instead of checking for links only in source code.
const PAGES = [
  "/", "/about", "/business-builder", "/creator-studio", "/growth-studio",
  "/help", "/contact", "/support", "/security", "/tutorials",
  "/tutorials/getting-started", "/tutorials/business-builder",
  "/tutorials/creator-studio", "/tutorials/growth-studio"
];

describe("trust and customer guidance across all SONARA companies", function () {
  this.timeout(30000);

  it("publishes one canonical accessible footer navigation on parent and studio pages", async () => {
    assert.ok(TRUST_DESTINATIONS.length >= 7);
    assert.equal(new Set(TRUST_DESTINATIONS.map((x) => x.href)).size, TRUST_DESTINATIONS.length);
    for (const path of PAGES) {
      const response = await request(app).get(path).set("Accept", "text/html");
      assert.equal(response.status, 200, `${path} must be reachable`);
      const html = response.text || "";
      const footer = html.match(/<footer>([\s\S]*?)<\/footer>/)?.[1] || "";
      assert.ok(footer, `${path} is missing the common footer`);
      const trust = footer.match(/<nav aria-label="Help and company information">([\s\S]*?)<\/nav>/)?.[1] || "";
      assert.ok(trust, `${path} does not inherit the trust navigation`);
      for (const { href, label } of TRUST_DESTINATIONS) {
        assert.ok(trust.includes(`href="${href}"`), `${path} missing ${label} (${href})`);
        assert.ok(trust.includes(`>${label}</a>`), `${path} missing accessible label for ${href}`);
      }
      assert.match(footer, /<nav aria-label="Legal">/);
      assert.match(footer, /href="\/legal\/terms"/);
      assert.match(footer, /href="\/legal\/privacy"/);
    }
  });

  it("gives all four tutorials recovery, account-security and privacy paths", async () => {
    for (const path of PAGES.filter((p) => p.startsWith("/tutorials/"))) {
      const response = await request(app).get(path).set("Accept", "text/html");
      assert.equal(response.status, 200);
      for (const href of ["/help", "/contact", "/account/security", "/privacy"]) {
        assert.ok(response.text.includes(`href="${href}"`), `${path} missing tutorial action ${href}`);
      }
      assert.match(response.text, /Step 1/);
    }
  });

  it("renders the same bounded, privacy-aware input contract for contact and support", async () => {
    for (const [path,action] of [["/contact","/contact"],["/support","/support/request"]]) {
      const response = await request(app).get(path);
      assert.equal(response.status, 200);
      assert.ok(response.text.includes(`action="${action}"`));
      assert.ok(response.text.includes('maxlength="120"'));
      assert.ok(response.text.includes('maxlength="254"'));
      assert.ok(response.text.includes('maxlength="160"'));
      assert.ok(response.text.includes('maxlength="4000"'));
      assert.ok(response.text.includes('name="website"'));
      assert.ok(response.text.includes("Do not include passwords"));
      assert.ok(response.text.includes('<label for="contact-category">Request type</label>'));
    }
    assert.throws(() => contactForm({}, "", { action: "https://evil.example/support" }), TypeError);
  });

  it("rejects overlong and malformed public requests before storing or sending them", async () => {
    const base = {
      name: "Example Customer", email: "customer@example.com", subject: "Help needed",
      category: "support", message: "This is a valid support request.", consent: "yes"
    };
    for (const path of ["/contact","/support/request"]) {
      for (const [key, value] of [
        ["name", "A".repeat(121)],
        ["subject", "B".repeat(161)],
        ["email", "c".repeat(246) + "@example.com"],
        ["subject", "A\r\nB"],
        ["message", "M".repeat(4001)]
      ]) {
        const response = await request(app).post(path).set("Accept", "application/json").send({ ...base, [key]: value });
        assert.equal(response.status, 400, `${path} accepted ${key} beyond the safe contract`);
        assert.equal(response.body.code, "validation_failed");
      }
    }
  });
});

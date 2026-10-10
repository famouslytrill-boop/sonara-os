// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../server");
const { QUESTIONS, renderPublicFaq } = require("../lib/sonara-public-faq.cjs");
const { escapeHtml } = require("../lib/sonara-shell.cjs");

describe("public trust, help and support", () => {
  it("keeps the FAQ structured, unique and accessible without scripts", () => {
    assert.ok(QUESTIONS.length >= 7);
    assert.equal(new Set(QUESTIONS.map(({ question }) => question)).size, QUESTIONS.length);
    const html = renderPublicFaq(escapeHtml);
    assert.match(html, /aria-labelledby="help-faq-heading"/);
    assert.equal((html.match(/<details>/g) || []).length, QUESTIONS.length);
    assert.equal((html.match(/<summary>/g) || []).length, QUESTIONS.length);
    assert.match(html, /Email acceptance does not prove delivery/);
  });

  it("makes security, FAQs, tutorials, billing and legal pages reachable from public help", async () => {
    const response = await request(app).get("/help").set("accept", "text/html");
    assert.equal(response.status, 200);
    for (const text of ["Frequently asked questions", "Account security", "Tutorials", "Privacy", "Terms", "Refund policy", "Contact"]) {
      assert.ok(response.text.includes(text), `missing help destination: ${text}`);
    }
  });

  it("labels the contact controls and warns against sending secrets", async () => {
    const response = await request(app).get("/contact").set("accept", "text/html");
    assert.equal(response.status, 200);
    assert.match(response.text, /<label for="contact-category">Request type<\/label>/);
    assert.match(response.text, /<select id="contact-category" name="category" required>/);
    assert.match(response.text, /name="message"[^>]*maxlength="4000"/);
    assert.match(response.text, /Do not include passwords/);
    assert.match(response.text, /name="website"/);
  });

  it("refuses a filled honeypot on both public submission paths", async () => {
    for (const route of ["/contact", "/support/request"]) {
      const response = await request(app).post(route).type("form").send({
        name: "Example Customer",
        email: "customer@example.com",
        subject: "Contact issue",
        category: "support",
        message: "Please help with this issue.",
        consent: "yes",
        website: "spam.example"
      });
      assert.equal(response.status, 400, `${route} accepted a honeypot`);
      assert.match(response.text, /Unable to accept this request/);
    }
  });

  it("retains entered values safely on a validation error", async () => {
    const response = await request(app).post("/contact").type("form").send({
      name: "Example Customer",
      email: "customer@example.com",
      subject: "<img src=x onerror=alert(1)>",
      category: "billing",
      message: "short",
      consent: "yes"
    });
    assert.equal(response.status, 400);
    assert.ok(response.text.includes("&lt;img src=x onerror=alert(1)&gt;"));
    assert.ok(!response.text.includes('<img src=x onerror=alert(1)>'));
    assert.match(response.text, /value="billing" selected/);
  });
});

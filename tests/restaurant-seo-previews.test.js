"use strict";

const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const { previewRestaurant, previewPublicEvent, safeJsonLd } =
  require("../lib/sonara-restaurant-seo-previews.cjs");
const register = require("../routes/sonara-catering-routes.cjs");

const address = Object.freeze({
  streetAddress: "100 Main Street", addressLocality: "Columbus",
  addressRegion: "OH", postalCode: "43215", addressCountry: "US"
});
const restaurant = (updates = {}) => ({
  name: "A Test Kitchen", address, url: "https://example.com/kitchen",
  menuUrl: "https://example.com/menu",
  openingHours: [{ dayOfWeek: "Monday", opens: "09:00", closes: "17:00" }],
  ...updates
});
const event = (updates = {}) => ({
  name: "Community Dinner", url: "https://example.com/events/dinner",
  venueName: "Community Hall", address,
  startsAt: "2026-12-01T19:00:00-05:00",
  endsAt: "2026-12-01T21:00:00-05:00",
  status: "scheduled", ...updates
});

function appFor(allowed = true) {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  register(app, {
    requireBusinessManager: (req, res, next) => {
      if (!allowed) return res.status(403).json({ ok: false, code: "manager_required" });
      req.sonaraUser = { id: "22222222-2222-4222-8222-222222222222" };
      next();
    },
    getCustomerPrimaryOrganization: async () => ({
      ok: true, organizationId: "11111111-1111-4111-8111-111111111111"
    }),
    layout: ({ title, sections = [] }) => "<title>" + title + "</title>" + sections.join(""),
    escapeHtml: String,
    linkAction: (href, label) => '<a href="' + href + '">' + label + "</a>"
  });
  return app;
}

describe("restaurant and event SEO preview safety", () => {
  it("allows only verified-shape public profile properties and never invents ratings", () => {
    const result = previewRestaurant(restaurant({
      aggregateRating: { ratingValue: 5 }, reviews: [{ rating: 5 }],
      paymentAccepted: "Any", celebrityEndorsed: true
    }));
    assert.equal(result.ok, true);
    assert.equal(result.schema["@type"], "Restaurant");
    assert.equal(result.schema.name, "A Test Kitchen");
    assert.equal(result.schema.address.addressLocality, "Columbus");
    assert.equal(result.schema.hasMenu, "https://example.com/menu");
    assert.equal(result.schema.aggregateRating, undefined);
    assert.equal(result.schema.reviews, undefined);
    assert.equal(result.schema.celebrityEndorsed, undefined);
    assert.equal(result.isPublished, false);
    assert.equal(result.googleEligibilityVerified, false);
  });
  it("rejects missing address, bad public URLs and fraudulent opening hours", () => {
    assert.equal(previewRestaurant(restaurant({ url: "javascript:alert(1)" })).ok, false);
    assert.equal(previewRestaurant(restaurant({ url: "http://example.com" })).ok, false);
    assert.equal(previewRestaurant(restaurant({ url: "https://127.0.0.1/local" })).ok, false);
    assert.equal(previewRestaurant(restaurant({ address: {} })).ok, false);
    assert.equal(previewRestaurant(restaurant({
      openingHours: [{ dayOfWeek: "Funday", opens: "09:00", closes: "17:00" }]
    })).ok, false);
  });
  it("creates public event structured data but never marks it published", () => {
    const result = previewPublicEvent(event({ offers: { price: "free" } }));
    assert.equal(result.ok, true);
    assert.equal(result.schema["@type"], "Event");
    assert.equal(result.schema.eventStatus, "https://schema.org/EventScheduled");
    assert.equal(result.schema.location.address.addressRegion, "OH");
    assert.equal(result.schema.offers, undefined);
    assert.equal(result.googleEligibilityVerified, false);
  });
  it("rejects invalid dates, missing physical venue and unsupported status", () => {
    assert.equal(previewPublicEvent(event({
      startsAt: "2026-02-30T10:00:00Z"
    })).ok, false);
    assert.equal(previewPublicEvent(event({ venueName: "" })).ok, false);
    assert.equal(previewPublicEvent(event({ status: "something_else" })).ok, false);
  });
  it("serializes JSON-LD without allowing an HTML script breakout", () => {
    const output = safeJsonLd({ name: "</script><script>alert('x')</script>" });
    assert.doesNotMatch(output, /<\/script>/);
    assert.match(output, /\\u003c/);
    assert.equal(JSON.parse(output).name, "</script><script>alert('x')</script>");
  });
  it("cannot access SEO preview endpoints without manager authorization", async () => {
    for (const [path, payload] of [
      ["/api/business/marketing/restaurant-seo-preview", restaurant()],
      ["/api/business/marketing/event-seo-preview", event()]
    ]) {
      const denied = await request(appFor(false)).post(path).send(payload);
      assert.equal(denied.status, 403);
      const result = await request(appFor(true)).post(path).send(payload);
      assert.equal(result.status, 200);
      assert.equal(result.body.state, "markup_preview_only");
      assert.equal(result.body.isPublished, false);
      assert.equal(result.headers["cache-control"], "private, no-store");
    }
  });
});

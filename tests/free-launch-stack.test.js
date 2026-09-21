"use strict";

const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../server");

describe("Free Launch Stack", () => {
  it("publishes a useful, no-secret research directory", async () => {
    const response = await request(app).get("/free-launch-stack");
    assert.equal(response.status, 200);
    assert.match(response.text, /Vercel/);
    assert.match(response.text, /Hosted data service/);
    assert.match(response.text, /Deterministic workflows/);
    assert.match(response.text, /sonara-free-launch-stack\.js/);
    assert.doesNotMatch(response.text, /(?:API_KEY|SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|RESEND_API_KEY)/);
  });

  it("has a label for every availability state it actually uses", async () => {
    // The label map falls back to "Review required" for an unknown state, so a
    // new availability value renders as something plausible instead of failing.
    // OpenTelemetry sat as "Research candidate" for a day after eight of its
    // packages became production dependencies, and the next state added would
    // have gone unlabelled the same quiet way.
    const response = await request(app).get("/api/free-launch-stack").set("Accept", "application/json");
    const states = [...new Set(response.body.items.map((item) => item.availability))];
    assert.ok(states.length >= 3, `only ${states.length} availability state(s) in use; this check has gone blind`);

    const page = await request(app).get("/free-launch-stack");
    const labels = {
      in_use: "Available in SONARA",
      setup_required: "Setup required",
      adapter_built: "Adapter built, not enabled",
      research_only: "Research candidate"
    };
    for (const state of states) {
      assert.ok(labels[state], `availability "${state}" has no label in this test, so the page may be showing "Review required"`);
      assert.match(page.text, new RegExp(labels[state].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
    assert.doesNotMatch(page.text, /Review required/, "an availability state reached the fallback label");
  });

  it("does not call an installed adapter a research candidate", async () => {
    // Eight @opentelemetry packages are production dependencies and
    // lib/sonara-observability.cjs is written and tested, so "researched" is
    // false. Nothing calls it, so "in_use" and "setup_required" are false too.
    const response = await request(app).get("/api/free-launch-stack").set("Accept", "application/json");
    const otel = response.body.items.find((item) => item.name === "OpenTelemetry");
    assert.ok(otel, "the OpenTelemetry entry is gone; this check no longer measures anything");
    assert.equal(otel.availability, "adapter_built");

    const manifest = require("../package.json");
    const installed = Object.keys(manifest.dependencies || {}).filter((name) => name.startsWith("@opentelemetry/"));
    assert.ok(
      installed.length > 0,
      "no @opentelemetry package is a production dependency any more, so adapter_built overstates it -- "
        + "move the entry back to research_only"
    );
  });

  it("offers the same safe directory data to application clients", async () => {
    const response = await request(app).get("/api/free-launch-stack").set("Accept", "application/json");
    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.status, "research_directory");
    assert.ok(response.body.itemCount >= 10);
    assert.ok(response.body.items.some((item) => item.key === "database-hosted-data-service"));
    assert.doesNotMatch(response.text, /(?:API_KEY|SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|RESEND_API_KEY)/);
  });
});

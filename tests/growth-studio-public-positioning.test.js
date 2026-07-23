"use strict";

const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../server");

describe("Growth Studio public positioning", () => {
  it("presents the deployed growth operating system instead of the former limited workspace copy", async () => {
    const response = await request(app).get("/growth-studio").set("Accept", "text/html");

    assert.equal(response.status, 200);
    assert.match(response.text, /Governed growth operating system for CRM/i);
    assert.match(response.text, /Audience Segments &amp; Consent/i);
    assert.match(response.text, /Touchpoints, Conversion &amp; Attribution/i);
    assert.match(response.text, /Provider &amp; Automation Readiness/i);
    assert.match(response.text, /href="\/growth-studio\/control-center"/);
    assert.match(response.text, /href="\/growth-studio\/segments"/);
    assert.match(response.text, /href="\/growth-studio\/attribution"/);
    assert.match(response.text, /href="\/growth-studio\/experiments"/);
    assert.match(response.text, /href="\/growth-studio\/providers"/);
    assert.match(response.text, /experiments, analytics snapshots/i);
    assert.match(response.text, /without pretending unapproved sends, posts, or ad mutations are live/i);
    assert.doesNotMatch(
      response.text,
      /Growth workspace for campaign planning, lead follow-up, consent-safe checklists, automation readiness, and growth records\./i
    );
  });
});

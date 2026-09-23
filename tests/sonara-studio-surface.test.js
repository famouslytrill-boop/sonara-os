// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");

const registerCreatorGenerationRoutes = require("../routes/creator-generation-routes.cjs");

function createApp() {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  registerCreatorGenerationRoutes(app, {
    requireWorkspaceAccess() {
      return (req, res, next) => next();
    }
  });
  return app;
}

describe("SONARA Studio capability surface", function () {
  it("renders inside Creator Studio without enabling execution", async function () {
    const response = await request(createApp()).get("/creator-studio/studio");
    assert.equal(response.status, 200);
    assert.match(response.text, /SONARA Studio/);
    assert.match(response.text, /capability map/i);
    assert.match(response.text, /do not execute from this surface/i);
    assert.match(response.text, /Generation Studio/);
  });

  it("exposes the governed capability registry without execution authority", async function () {
    const response = await request(createApp())
      .get("/api/creator/studio/capabilities")
      .set("Accept", "application/json");

    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.executionEnabledByThisSurface, false);
    assert.equal(response.body.product.placement, "Creator Studio workspace");
    assert.equal(response.body.product.newTopLevelProduct, false);
    assert.ok(Array.isArray(response.body.capabilities));
    assert.ok(response.body.capabilities.length >= 20);
    assert.ok(response.body.capabilities.every((capability) => capability.enabledByThisChange === false));
  });

  it("keeps regulated industry packs blocked", async function () {
    const response = await request(createApp()).get("/api/creator/studio/capabilities");
    const regulated = response.body.capabilities.find((capability) => capability.id === "platform.regulated-packs");
    assert.ok(regulated);
    assert.equal(regulated.adoptionState, "blocked_until_qualified_review");
    assert.equal(regulated.humanApprovalRequired, true);
  });
});

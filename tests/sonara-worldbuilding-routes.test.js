// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const register = require("../routes/creator-music-system-readonly.cjs");

function fixture() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  register(app, { requireWorkspaceAccess: () => (req, res, next) => {
    if (req.get("x-test-creator-access") !== "yes") return res.status(403).json({ ok: false, code: "forbidden" });
    return next();
  } });
  return app;
}
const allowed = (agent) => agent.set("x-test-creator-access", "yes");
const world = () => ({ title: "Original world", medium: "film",
  entities: [{ id: "artist", kind: "character", name: "Artist" }],
  scenes: [{ id: "opening", title: "Opening", entityIds: ["artist"], durationSeconds: 30 }] });

describe("Creator worldbuilding preview routes", () => {
  it("never exposes a worldbuilding page or JSON API without Creator workspace authorization", async () => {
    const app = fixture();
    assert.equal((await request(app).get("/creator-studio/worldbuilding")).status, 403);
    assert.equal((await request(app).post("/api/creator/worldbuilding/plan").send(world())).status, 403);
    assert.equal((await request(app).post("/creator-studio/worldbuilding").type("form").send({ title: "Untitled" })).status, 403);
  });
  it("serves a real planning form and deterministic API while disabling shared caching", async () => {
    const app = fixture();
    const page = await allowed(request(app).get("/creator-studio/worldbuilding"));
    assert.equal(page.status, 200);
    assert.match(page.text, /name="scenes"/);
    assert.match(page.text, /name="medium"/);
    assert.match(page.headers["cache-control"], /no-store/);
    const result = await allowed(request(app).post("/api/creator/worldbuilding/plan").send(world()));
    assert.equal(result.status, 200);
    assert.equal(result.body.ok, true);
    assert.equal(result.body.blueprint.estimates.runtimeSeconds, 30);
    assert.equal(result.body.blueprint.persistence, "not_saved");
    assert.match(result.headers["cache-control"], /no-store/);
  });
  it("escapes creator-supplied markup in HTML previews and rejects invalid JSON", async () => {
    const app = fixture();
    const result = await allowed(request(app).post("/creator-studio/worldbuilding").type("form").send({
      title: "<script>alert(1)</script>", medium: "film", scenes: "<img src=x onerror=alert(1)>", secondsPerScene: "10"
    }));
    assert.equal(result.status, 200);
    assert.doesNotMatch(result.text, /<script>alert\(1\)<\/script>/);
    assert.doesNotMatch(result.text, /<img src=x onerror=/);
    assert.match(result.text, /&lt;script&gt;/);
    const invalid = await allowed(request(app).post("/api/creator/worldbuilding/plan").send({ title: "Empty", medium: "film", scenes: [] }));
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.code, "invalid_scenes");
  });
});

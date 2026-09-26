// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const express = require("express");
const request = require("supertest");
const registerMusicRoutes = require("../routes/creator-music-system-readonly.cjs");
const { makeMelodyScore, renderScoreWav, renderTranscriptVtt } = require("../lib/sonara-deterministic-media.cjs");

function testApp() {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  registerMusicRoutes(app, {
    requireWorkspaceAccess: (key) => (req, res, next) => {
      if (key !== "creator_studio" || req.get("x-test-workspace") !== "creator_studio") return res.sendStatus(401);
      next();
    }
  });
  return app;
}

describe("Creator Studio provider-free media exports", function () {
  it("requires workspace access before rendering music tools or accepting export requests", async function () {
    const app = testApp();
    assert.equal((await request(app).get("/creator-studio/music-system")).status, 401);
    assert.equal((await request(app).post("/api/creator/media/score.wav").send({ notes: "C4", bpm: 120 })).status, 401);
    assert.equal((await request(app).post("/api/creator/media/captions.vtt").send({ text: "Hello", durationSeconds: 2 })).status, 401);
  });

  it("exposes reachable form actions and downloads a valid repeatable WAV", async function () {
    const app = testApp();
    const header = { "x-test-workspace": "creator_studio" };
    const page = await request(app).get("/creator-studio/music-system").set(header);
    assert.equal(page.status, 200);
    assert.match(page.text, /action="\/api\/creator\/media\/score\.wav"/);
    assert.match(page.text, /action="\/api\/creator\/media\/captions\.vtt"/);
    const first = await request(app).post("/api/creator/media/score.wav").set(header).type("form").send({ notes: "C4 E4 G4 - C5", bpm: 120 });
    const second = await request(app).post("/api/creator/media/score.wav").set(header).type("form").send({ notes: "C4 E4 G4 - C5", bpm: 120 });
    assert.equal(first.status, 200);
    assert.match(first.headers["content-type"], /^audio\/wav/);
    assert.match(first.headers["content-disposition"], /attachment/);
    assert.equal(first.headers["cache-control"], "private, no-store");
    assert.equal(first.body.toString("ascii", 0, 4), "RIFF");
    assert.equal(first.body.readUInt32LE(24), 24000);
    assert.equal(first.body.readUInt32LE(40), first.body.length - 44);
    assert.equal(createHash("sha256").update(first.body).digest("hex"), createHash("sha256").update(second.body).digest("hex"));
  });

  it("rejects excessive work and invalid notes before rendering", async function () {
    const app = testApp();
    const invalid = await request(app).post("/api/creator/media/score.wav").set("x-test-workspace", "creator_studio")
      .set("Accept", "application/json").send({ notes: "C4 " .repeat(17), bpm: 60 });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.code, "invalid_media_input");
    assert.throws(() => makeMelodyScore({ notes: "C4 DROP TABLE", bpm: 120 }), /Invalid note/);
    assert.throws(() => makeMelodyScore({ notes: "Cb3", bpm: 120 }), /outside C3/);
    assert.throws(() => renderScoreWav({ durationMs: 11000, events: [] }), /Duration/);
  });

  it("exports caption text without allowing WebVTT markup or line injection", async function () {
    const app = testApp();
    const response = await request(app).post("/api/creator/media/captions.vtt")
      .set("x-test-workspace", "creator_studio").type("form")
      .send({ text: "First line\n<script>bad</script> & text", durationSeconds: 3 });
    assert.equal(response.status, 200);
    assert.match(response.headers["content-type"], /^text\/vtt/);
    assert.equal(response.text, "WEBVTT\n\n00:00:00.000 --> 00:00:03.000\nFirst line &lt;script&gt;bad&lt;/script&gt; &amp; text\n");
    assert.throws(() => renderTranscriptVtt({ text: " ", durationSeconds: 3 }), /transcript/);
  });
});

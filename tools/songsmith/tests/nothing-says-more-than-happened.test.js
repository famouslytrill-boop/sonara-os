"use strict";

// The recurring defect in this codebase is a signal that reports success
// without being true. A song generator has four good places to grow one:
//
//   1. a progress bar that moves because time passed
//   2. a job the backend called COMPLETED with no audio in it, left `ready`
//   3. an unreachable backend recorded as a failed song
//   4. a writing helper that produces a scaffold and calls it a draft
//
// One test each, and each one names the lie it is looking for.

const test = require("node:test");
const assert = require("node:assert/strict");
const db = require("../src/db.js");
const { pollAll, pollOne, GIVE_UP_AFTER_MS } = require("../src/songs.js");
const { read } = require("../src/runpod.js");
const { createDrafter } = require("../src/lyrics.js");
const { boot, withTwoPeople, tinyM4a } = require("./helpers/app.js");

async function submitOne(harness, agent, fields = {}) {
  await agent.post("/new", { title: "A Song", lyrics: "[Verse 1]\nwords", style: "folk", ...fields }, { from: "/new" });
  return harness.store.prepare("SELECT * FROM songs ORDER BY rowid DESC").get();
}

test("a job with no reported percentage shows no bar, because nothing measured one", async (t) => {
  const harness = await boot();
  t.after(() => harness.close());
  const { singer } = await withTwoPeople(harness);

  const song = await submitOne(harness, singer);
  harness.backend.say(song.job_id, { status: "IN_PROGRESS" });
  await pollAll(harness.app.ctx);

  const stored = db.findSong(harness.store, song.id);
  assert.equal(stored.state, "running");
  assert.equal(stored.progress, null, "null is 'no news'; 0 would be 'started and got nowhere'");

  const page = await singer.get(`/songs/${song.id}`);
  assert.match(page.text, /Working on it/);
  assert.doesNotMatch(page.text, /<progress/, "a bar here would be an animation standing in for a measurement");
});

test("a percentage the backend actually reported is shown, and it is that number", async (t) => {
  const harness = await boot();
  t.after(() => harness.close());
  const { singer } = await withTwoPeople(harness);

  const song = await submitOne(harness, singer);
  harness.backend.say(song.job_id, { status: "IN_PROGRESS", output: { progress: 42 } });
  await pollAll(harness.app.ctx);

  assert.equal(db.findSong(harness.store, song.id).progress, 42);
  const page = await singer.get(`/songs/${song.id}`);
  assert.match(page.text, /value="42"/);
  assert.match(page.text, /42%/);
});

test("COMPLETED with no audio is a failure, not a song with a play button that does nothing", async (t) => {
  const harness = await boot();
  t.after(() => harness.close());
  const { singer } = await withTwoPeople(harness);

  const song = await submitOne(harness, singer);
  harness.backend.say(song.job_id, { status: "COMPLETED", output: { note: "all done!" } });
  await pollAll(harness.app.ctx);

  const stored = db.findSong(harness.store, song.id);
  assert.equal(stored.state, "failed");
  assert.equal(stored.audio_path, "");
  assert.match(stored.error, /no audio/);

  const page = await singer.get(`/songs/${song.id}`);
  assert.doesNotMatch(page.text, /<audio/, "a player over nothing is the worst version of this");
});

test("a backend that answers with an error page instead of audio is caught before it is stored", async (t) => {
  const harness = await boot();
  t.after(() => harness.close());
  const { singer } = await withTwoPeople(harness);

  const song = await submitOne(harness, singer);
  harness.backend.say(song.job_id, {
    status: "COMPLETED",
    output: { audio_base64: Buffer.from('{"error":"out of memory"}').toString("base64") }
  });
  await pollAll(harness.app.ctx);

  const stored = db.findSong(harness.store, song.id);
  assert.equal(stored.state, "failed");
  assert.match(stored.error, /not playable audio/);
  // The bytes are quoted back, because "it failed" tells whoever runs this
  // nothing and "out of memory" tells them what to change.
  assert.match(stored.error, /out of memory/);
});

test("mono comes back playable, and says it came back mono", async (t) => {
  const harness = await boot();
  t.after(() => harness.close());
  const { singer } = await withTwoPeople(harness);

  const song = await submitOne(harness, singer);
  harness.backend.say(song.job_id, {
    status: "COMPLETED",
    output: { audio_base64: tinyM4a({ channels: 1 }).toString("base64"), duration_ms: 9000 }
  });
  await pollAll(harness.app.ctx);

  const stored = db.findSong(harness.store, song.id);
  assert.equal(stored.state, "ready", "the song plays; throwing it away over a channel count would be worse");
  assert.match(stored.error, /mono rather than stereo/);
  const page = await singer.get(`/songs/${song.id}`);
  assert.match(page.text, /<audio/);
  assert.match(page.text, /mono rather than stereo/);
});

test("an unreachable backend is not a failed song", async (t) => {
  const harness = await boot();
  t.after(() => harness.close());
  const { singer } = await withTwoPeople(harness);

  const song = await submitOne(harness, singer);
  harness.app.ctx.backend.status = async () => {
    throw Object.assign(new Error("connect ECONNREFUSED"), { unreachable: true });
  };

  await pollAll(harness.app.ctx);
  const stored = db.findSong(harness.store, song.id);
  assert.equal(stored.state, "queued", "the network being down is news about the network, not about the song");
  assert.equal(stored.error, "");
});

test("but a job nobody could ask about for long enough is failed rather than left spinning", async (t) => {
  const harness = await boot();
  t.after(() => harness.close());
  const { singer } = await withTwoPeople(harness);

  const song = await submitOne(harness, singer);
  harness.app.ctx.backend.status = async () => {
    throw new Error("connect ECONNREFUSED");
  };

  await pollOne(harness.app.ctx, song, song.created_at + GIVE_UP_AFTER_MS + 1000);
  const stored = db.findSong(harness.store, song.id);
  assert.equal(stored.state, "failed");
  assert.match(stored.error, /Gave up/);
});

test("a job still running past the window RunPod keeps results for is failed, and says why", async (t) => {
  const harness = await boot();
  t.after(() => harness.close());
  const { singer } = await withTwoPeople(harness);

  const song = await submitOne(harness, singer);
  harness.backend.say(song.job_id, { status: "IN_PROGRESS", output: { progress: 3 } });
  await pollOne(harness.app.ctx, song, song.created_at + GIVE_UP_AFTER_MS + 1000);

  const stored = db.findSong(harness.store, song.id);
  assert.equal(stored.state, "failed");
  assert.match(stored.error, /thirty minutes/, "the reason is a fact about RunPod, and whoever reads it should get that fact");
});

test("with no backend configured nothing is submitted, and the song says so", async (t) => {
  const { NotConfigured } = require("../src/runpod.js");
  const refusing = {
    configured: false,
    async submit() {
      throw new NotConfigured();
    },
    async status() {
      throw new NotConfigured();
    }
  };
  const harness = await boot({ backend: refusing });
  t.after(() => harness.close());
  const { singer } = await withTwoPeople(harness);

  const page = await singer.get("/new");
  assert.match(page.text, /No generation backend is configured/);
  assert.match(page.text, /disabled/, "the button says so rather than failing after the press");

  const song = await submitOne(harness, singer);
  assert.equal(song.state, "failed");
  assert.match(song.error, /Nothing has been charged/);
});

test("a RunPod status this does not know about is not read as success", () => {
  const answer = read({ status: "SOMETHING_NEW", output: { audio_base64: "AAAA" } });
  assert.equal(answer.state, "running");
  assert.equal(answer.unknownStatus, "SOMETHING_NEW");
  assert.equal(answer.audioBase64, null, "a status this cannot read must not have its output collected as finished");
});

test("the job id is on the row the moment the backend has one", async (t) => {
  const harness = await boot();
  t.after(() => harness.close());
  const { singer } = await withTwoPeople(harness);

  const song = await submitOne(harness, singer);
  assert.ok(song.job_id, "a paid job with nothing on this side that knows about it is unreachable work");
  assert.equal(song.job_id, harness.backend.submitted.at(-1).id);
});

test("a queued song whose job id never landed is failed rather than queued for ever", async (t) => {
  const harness = await boot();
  t.after(() => harness.close());
  const { singer } = await withTwoPeople(harness);

  const song = await submitOne(harness, singer);
  harness.store.prepare("UPDATE songs SET job_id = NULL WHERE id = ?").run(song.id);

  await pollOne(harness.app.ctx, { ...song, job_id: null }, song.created_at + 120000);
  const stored = db.findSong(harness.store, song.id);
  assert.equal(stored.state, "failed");
  assert.match(stored.error, /never registered/);
});

test("with no writing model, the helper says it wrote nothing", async (t) => {
  const harness = await boot();
  t.after(() => harness.close());
  const { singer } = await withTwoPeople(harness);

  const drafted = await singer.post("/draft", { idea: "a synthwave song about driving home" }, { from: "/new" });
  assert.equal(drafted.status, 200);
  assert.match(drafted.text, /not a written draft/);
  assert.match(drafted.text, /Replace every line in brackets/);
  // And the placeholder is visibly a placeholder, so nobody submits filler they
  // did not notice was not theirs.
  assert.match(drafted.text, /\(a line about/);
});

test("a writing model that breaks is not silently replaced by the outline", async () => {
  const drafter = createDrafter({
    baseUrl: "http://example.invalid/v1",
    model: "whatever",
    fetchImpl: async () => ({ ok: false, status: 502, async text() { return "nope"; } })
  });
  assert.equal(drafter.configured, true);

  const drafted = await drafter.draft({ prompt: "a song about rain" });
  assert.equal(drafted.ok, true);
  assert.equal(drafted.source, "outline");
  assert.match(drafted.problem, /could not be used/);
  assert.match(drafted.problem, /502/, "a broken endpoint that looks like a working one nobody likes is the worst outcome");
});

test("stopping a song tells the backend before it marks the row", async (t) => {
  const harness = await boot();
  t.after(() => harness.close());
  const { singer } = await withTwoPeople(harness);

  const song = await submitOne(harness, singer);
  const page = await singer.get(`/songs/${song.id}`);
  assert.match(page.text, /Stop making it/, "there is nothing to press if the button is not offered");

  const told = [];
  const realCancel = harness.app.ctx.backend.cancel.bind(harness.app.ctx.backend);
  harness.app.ctx.backend.cancel = async (id) => {
    told.push(id);
    return realCancel(id);
  };

  await singer.post(`/songs/${song.id}/cancel`, {}, { from: `/songs/${song.id}` });
  assert.deepEqual(told, [song.job_id], "a row marked cancelled while a worker carries on is the one bad outcome");
  assert.equal(db.findSong(harness.store, song.id).state, "cancelled");

  const after = await singer.get(`/songs/${song.id}`);
  assert.doesNotMatch(after.text, /Stop making it/);
});

test("a backend that will not accept the cancel leaves the song running and says so", async (t) => {
  const harness = await boot();
  t.after(() => harness.close());
  const { singer } = await withTwoPeople(harness);

  const song = await submitOne(harness, singer);
  harness.app.ctx.backend.cancel = async () => {
    throw new Error("connect ECONNREFUSED");
  };

  const answer = await singer.post(`/songs/${song.id}/cancel`, {}, { from: `/songs/${song.id}` });
  assert.equal(answer.status, 400);
  assert.match(answer.text, /could not be told to stop/);
  assert.equal(db.findSong(harness.store, song.id).state, "queued",
    "\"cancelled\" on the page has to mean the backend agreed");
});

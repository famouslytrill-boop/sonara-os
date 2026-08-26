"use strict";

// "Keep all songs private by default, with a separate area for my songs and
// shared community songs."
//
// Private by default is a claim about what *another signed-in person* can
// reach, so every test here is two agents and one of them trying. The page and
// the audio file are checked separately: a song page that 404s while
// `/songs/:id/audio` streams to anybody is a privacy setting that only works
// for people who do not view source.

const test = require("node:test");
const assert = require("node:assert/strict");
const db = require("../src/db.js");
const { boot, withTwoPeople, tinyM4a } = require("./helpers/app.js");

/** Generate a song and drive it to ready with a real M4A. */
async function readySong(harness, agent, { title = "Mine", channels = 2 } = {}) {
  await agent.post("/new", { title, lyrics: "[Verse 1]\nsomething", style: "folk" }, { from: "/new" });
  const song = harness.store.prepare("SELECT * FROM songs ORDER BY created_at DESC, rowid DESC").get();
  harness.backend.say(song.job_id, {
    status: "COMPLETED",
    output: { audio_base64: tinyM4a({ channels }).toString("base64"), duration_ms: 12000 }
  });
  const { pollAll } = require("../src/songs.js");
  await pollAll(harness.app.ctx);
  return db.findSong(harness.store, song.id);
}

test("a song is private when it is made, and stays private to its owner", async (t) => {
  const harness = await boot();
  t.after(() => harness.close());
  const { owner, singer } = await withTwoPeople(harness);

  const song = await readySong(harness, singer, { title: "Four In The Morning" });
  assert.equal(song.visibility, "private", "private is the default in the schema, not something a route remembers to set");
  assert.equal(song.state, "ready");

  assert.equal((await singer.get(`/songs/${song.id}`)).status, 200);

  // The owner of the installation is an admin, and an admin is not an
  // exception. "Songs are private" would mean very little if the person who
  // approves accounts could read everybody's.
  const asAdmin = await owner.get(`/songs/${song.id}`);
  assert.equal(asAdmin.status, 404);

  const audioAsAdmin = await owner.get(`/songs/${song.id}/audio`);
  assert.equal(audioAsAdmin.status, 404, "the file is the song; guarding only the page guards nothing");
});

test("sharing puts it in the community list, and unsharing takes it out again", async (t) => {
  const harness = await boot();
  t.after(() => harness.close());
  const { owner, singer } = await withTwoPeople(harness);

  const song = await readySong(harness, singer, { title: "Something Shared" });

  const before = await owner.get("/community");
  assert.doesNotMatch(before.text, /Something Shared/);

  await singer.post(`/songs/${song.id}/visibility`, { visibility: "shared" }, { from: `/songs/${song.id}` });
  assert.equal(db.findSong(harness.store, song.id).visibility, "shared");

  const after = await owner.get("/community");
  assert.match(after.text, /Something Shared/);
  assert.equal((await owner.get(`/songs/${song.id}`)).status, 200);
  assert.equal((await owner.get(`/songs/${song.id}/audio`)).status, 200);

  await singer.post(`/songs/${song.id}/visibility`, { visibility: "private" }, { from: `/songs/${song.id}` });
  assert.doesNotMatch((await owner.get("/community")).text, /Something Shared/);
  assert.equal((await owner.get(`/songs/${song.id}`)).status, 404);
  assert.equal((await owner.get(`/songs/${song.id}/audio`)).status, 404, "unsharing has to reach the file too");
});

test("a song that is not ready cannot be shared", async (t) => {
  const harness = await boot();
  t.after(() => harness.close());
  const { singer } = await withTwoPeople(harness);

  await singer.post("/new", { title: "Still Cooking", lyrics: "[Verse 1]\nx" }, { from: "/new" });
  const song = harness.store.prepare("SELECT * FROM songs ORDER BY rowid DESC").get();
  assert.equal(song.state, "queued");

  const attempted = await singer.post(`/songs/${song.id}/visibility`, { visibility: "shared" }, { from: `/songs/${song.id}` });
  assert.match(attempted.location, /problem=not-ready/);
  assert.equal(db.findSong(harness.store, song.id).visibility, "private",
    "sharing an unfinished song puts a broken play button in front of everybody else");
});

test("the community list holds only songs that are both shared and ready", async (t) => {
  const harness = await boot();
  t.after(() => harness.close());
  const { owner, singer } = await withTwoPeople(harness);

  const good = await readySong(harness, singer, { title: "Ready And Shared" });
  await singer.post(`/songs/${good.id}/visibility`, { visibility: "shared" }, { from: `/songs/${good.id}` });

  // A row forced into an impossible-by-the-route state, because the list has to
  // be right about what it holds even if something else wrote the row.
  await singer.post("/new", { title: "Shared But Broken", lyrics: "[Verse 1]\nx" }, { from: "/new" });
  const broken = harness.store.prepare("SELECT * FROM songs WHERE title = 'Shared But Broken'").get();
  harness.store.prepare("UPDATE songs SET visibility = 'shared', state = 'failed' WHERE id = ?").run(broken.id);

  const listed = db.listSharedSongs(harness.store);
  assert.equal(listed.length, 1);
  assert.equal(listed[0].title, "Ready And Shared");
  assert.doesNotMatch((await owner.get("/community")).text, /Shared But Broken/);
});

test("only the owner can rename, share, replay or delete", async (t) => {
  const harness = await boot();
  t.after(() => harness.close());
  const { owner, singer } = await withTwoPeople(harness);

  const song = await readySong(harness, singer, { title: "Not Yours" });
  await singer.post(`/songs/${song.id}/visibility`, { visibility: "shared" }, { from: `/songs/${song.id}` });

  // Shared, so the other person can read it. Reading is not writing.
  for (const [action, fields] of [
    ["rename", { title: "Hijacked" }],
    ["visibility", { visibility: "private" }],
    ["replay", {}],
    ["delete", {}]
  ]) {
    const attempted = await owner.post(`/songs/${song.id}/${action}`, fields, { from: `/songs/${song.id}` });
    assert.equal(attempted.status, 303, action);
    assert.match(attempted.location, /problem=not-yours/, action);
  }

  const after = db.findSong(harness.store, song.id);
  assert.equal(after.title, "Not Yours");
  assert.equal(after.visibility, "shared");
  assert.equal(db.listSongsFor(harness.store, after.user_id).length, 1, "and nothing was replayed into their account either");
});

test("renaming, replaying with the same seed, and deleting all do what they say", async (t) => {
  const harness = await boot();
  t.after(() => harness.close());
  const { singer } = await withTwoPeople(harness);

  const song = await readySong(harness, singer, { title: "First Take" });

  await singer.post(`/songs/${song.id}/rename`, { title: "Second Thoughts" }, { from: `/songs/${song.id}` });
  assert.equal(db.findSong(harness.store, song.id).title, "Second Thoughts");

  const replayed = await singer.post(`/songs/${song.id}/replay`, {}, { from: `/songs/${song.id}` });
  const newId = replayed.location.replace("/songs/", "");
  const again = db.findSong(harness.store, newId);
  assert.notEqual(again.id, song.id);
  assert.equal(again.seed, song.seed, "same seed is the whole point of replay");
  assert.equal(again.lyrics, song.lyrics);
  assert.equal(again.style, song.style);
  // And the seed actually reached the backend, rather than only being written
  // down on this side.
  assert.equal(harness.backend.submitted.at(-1).input.seed, song.seed);

  const file = db.findSong(harness.store, song.id).audio_path;
  assert.ok(require("node:fs").existsSync(file));
  await singer.post(`/songs/${song.id}/delete`, {}, { from: `/songs/${song.id}` });
  assert.equal(db.findSong(harness.store, song.id), null);
  assert.equal(require("node:fs").existsSync(file), false, "the file goes with the row");
});

test("the audio answers a byte range, so dragging the scrubber does not re-download the song", async (t) => {
  const harness = await boot();
  t.after(() => harness.close());
  const { singer } = await withTwoPeople(harness);
  const song = await readySong(harness, singer);

  const whole = await fetch(`${harness.origin}/songs/${song.id}/audio`, { headers: { cookie: singer.cookie } });
  assert.equal(whole.status, 200);
  assert.equal(whole.headers.get("content-type"), "audio/mp4");
  assert.equal(whole.headers.get("accept-ranges"), "bytes");
  assert.equal(whole.headers.get("cache-control"), "private, no-store", "a shared cache must not hold somebody's song");
  const bytes = Buffer.from(await whole.arrayBuffer());

  const part = await fetch(`${harness.origin}/songs/${song.id}/audio`, {
    headers: { cookie: singer.cookie, range: "bytes=4-11" }
  });
  assert.equal(part.status, 206);
  assert.equal(part.headers.get("content-range"), `bytes 4-11/${bytes.length}`);
  const partial = Buffer.from(await part.arrayBuffer());
  assert.equal(partial.length, 8);
  assert.deepEqual(partial, bytes.subarray(4, 12), "and it is the right eight bytes, not just eight bytes");
  assert.equal(partial.toString("latin1"), "ftypM4A ");

  const silly = await fetch(`${harness.origin}/songs/${song.id}/audio`, {
    headers: { cookie: singer.cookie, range: `bytes=${bytes.length + 500}-${bytes.length + 900}` }
  });
  assert.equal(silly.status, 416);
});

test("a signed-out visitor reaches nothing at all", async (t) => {
  const harness = await boot();
  t.after(() => harness.close());
  const { singer } = await withTwoPeople(harness);
  const song = await readySong(harness, singer);
  await singer.post(`/songs/${song.id}/visibility`, { visibility: "shared" }, { from: `/songs/${song.id}` });

  const stranger = harness.agent();
  for (const path of ["/songs", "/community", "/new", "/admin", `/songs/${song.id}`, `/songs/${song.id}/audio`]) {
    const answer = await stranger.get(path);
    assert.equal(answer.status, 303, path);
    assert.equal(answer.location, "/", path);
  }
  // Shared means shared with the people who have accounts here, not with the
  // internet. This application has no public link and does not pretend to.
});

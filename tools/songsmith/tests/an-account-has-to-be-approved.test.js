"use strict";

// The lifecycle the owner asked for, checked at the door rather than in the
// database: ask, wait, be approved, sign in. And the two things that are easy
// to get almost right -- a disabled account whose existing session keeps
// working, and an installation that can lose its last admin.

const test = require("node:test");
const assert = require("node:assert/strict");
const db = require("../src/db.js");
const auth = require("../src/auth.js");
const { boot, withTwoPeople } = require("./helpers/app.js");

test("the first account is created and signed in; the second one waits", async (t) => {
  const harness = await boot();
  t.after(() => harness.close());

  const first = harness.agent();
  const created = await first.signUp({ email: "owner@example.com" });
  assert.equal(created.status, 303);
  assert.match(created.location, /^\/songs/);

  const rows = db.listUsers(harness.store);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "active");
  assert.equal(rows[0].is_admin, 1, "somebody has to be able to approve the second account");

  const second = harness.agent();
  const asked = await second.signUp({ email: "singer@example.com", reason: "please" });
  assert.equal(asked.status, 303);
  assert.match(asked.location, /notice=asked/);
  assert.equal(db.findUserByEmail(harness.store, "singer@example.com").status, "pending");
});

test("a pending account cannot sign in, and is told why rather than told the password is wrong", async (t) => {
  const harness = await boot();
  t.after(() => harness.close());

  await harness.agent().signUp({ email: "owner@example.com" });
  const singer = harness.agent();
  await singer.signUp({ email: "singer@example.com" });

  const attempt = await singer.signIn({ email: "singer@example.com" });
  assert.equal(attempt.status, 401);
  assert.match(attempt.text, /waiting to be approved/);
  // A person with the right password sent round a password reset loop would
  // never get in, because a reset is not what is wrong.
  assert.doesNotMatch(attempt.text, /do not match/);

  const songs = await singer.get("/songs");
  assert.equal(songs.status, 303, "a pending account has no session at all");
});

test("approving lets them in, and their reason is on the admin page for whoever decides", async (t) => {
  const harness = await boot();
  t.after(() => harness.close());

  const owner = harness.agent();
  await owner.signUp({ email: "owner@example.com" });
  await harness.agent().signUp({ email: "singer@example.com", reason: "I write terrible songs" });

  const adminPage = await owner.get("/admin");
  assert.match(adminPage.text, /I write terrible songs/, "the queue exists so somebody reads this");

  const { singer } = await withTwoPeopleIn(harness, owner);
  const mine = await singer.get("/songs");
  assert.equal(mine.status, 200);
});

async function withTwoPeopleIn(harness, owner) {
  const row = db.findUserByEmail(harness.store, "singer@example.com");
  await owner.post(`/admin/users/${row.id}/status`, { status: "active" }, { from: "/admin" });
  const singer = harness.agent();
  await singer.signIn({ email: "singer@example.com" });
  return { singer, row };
}

test("disabling an account ends the session it is already holding", async (t) => {
  const harness = await boot();
  t.after(() => harness.close());
  const { owner, singer, singerRow } = await withTwoPeople(harness);

  assert.equal((await singer.get("/songs")).status, 200, "signed in before");

  await owner.post(`/admin/users/${singerRow.id}/status`, { status: "disabled" }, { from: "/admin" });

  // The point of the whole test: not "the next sign-in fails" but "the session
  // they are holding right now stops working". A disable that waits for a
  // cookie to expire is not a disable.
  const after = await singer.get("/songs");
  assert.equal(after.status, 303);
  assert.equal(after.location, "/");
});

// Two things make the test above pass, and each on its own is enough: the
// session rows are deleted, *and* a live session is refused when its user is
// not active. That is deliberate, and it means a probe removing either one
// leaves the outcome test green -- which was found by running exactly that
// probe and watching it not fire.
//
// So each layer gets its own test below. A guard nothing can falsify is a guard
// nobody has checked.

test("disabling deletes the session rows, rather than leaving them to expire", async (t) => {
  const harness = await boot();
  t.after(() => harness.close());
  const { owner, singerRow } = await withTwoPeople(harness);

  assert.equal(harness.store.prepare("SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?").get(singerRow.id).n, 1);
  await owner.post(`/admin/users/${singerRow.id}/status`, { status: "disabled" }, { from: "/admin" });
  assert.equal(harness.store.prepare("SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?").get(singerRow.id).n, 0);
});

test("a session that outlives a status change is still refused", async (t) => {
  const harness = await boot();
  t.after(() => harness.close());
  const { singer, singerRow } = await withTwoPeople(harness);

  // The status is changed *underneath* the session, without going through the
  // path that deletes sessions -- somebody editing the database by hand, a
  // restore from a backup, or a future writer who forgets. The live session
  // must still stop working.
  harness.store.prepare("UPDATE users SET status = 'disabled' WHERE id = ?").run(singerRow.id);
  assert.equal(harness.store.prepare("SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?").get(singerRow.id).n, 1,
    "the session row is deliberately still there; that is what this test is about");

  const after = await singer.get("/songs");
  assert.equal(after.status, 303, "the row survived, and it must not work");
});

test("the last admin cannot disable or delete themselves", async (t) => {
  const harness = await boot();
  t.after(() => harness.close());

  const owner = harness.agent();
  await owner.signUp({ email: "owner@example.com" });
  const row = db.findUserByEmail(harness.store, "owner@example.com");

  const disabled = await owner.post(`/admin/users/${row.id}/status`, { status: "disabled" }, { from: "/admin" });
  assert.equal(disabled.status, 400);
  assert.match(disabled.text, /only admin left/);
  assert.equal(db.findUserByEmail(harness.store, "owner@example.com").status, "active");

  const deleted = await owner.post(`/admin/users/${row.id}/delete`, {}, { from: "/admin" });
  assert.equal(deleted.status, 400);
  assert.ok(db.findUserByEmail(harness.store, "owner@example.com"), "an installation with no admin has no way back");
});

test("deleting somebody takes their songs with them", async (t) => {
  const harness = await boot();
  t.after(() => harness.close());
  const { owner, singer, singerRow } = await withTwoPeople(harness);

  await singer.post("/new", { title: "Theirs", lyrics: "[Verse 1]\nwords", style: "folk" }, { from: "/new" });
  assert.equal(db.listSongsFor(harness.store, singerRow.id).length, 1);

  await owner.post(`/admin/users/${singerRow.id}/delete`, {}, { from: "/admin" });
  assert.equal(db.listSongsFor(harness.store, singerRow.id).length, 0);
  assert.equal(db.findUserById(harness.store, singerRow.id), null);
});

test("an ordinary account cannot reach the admin page at all", async (t) => {
  const harness = await boot();
  t.after(() => harness.close());
  const { singer, singerRow } = await withTwoPeople(harness);

  assert.equal((await singer.get("/admin")).status, 403);
  const attempted = await singer.post(`/admin/users/${singerRow.id}/status`, { status: "active" }, { from: "/songs" });
  assert.equal(attempted.status, 403);
});

test("a stale form is refused rather than acted on", async (t) => {
  const harness = await boot();
  t.after(() => harness.close());
  const { singer } = await withTwoPeople(harness);

  const withoutToken = await singer.post("/new", { title: "x", lyrics: "y", csrf: "" });
  assert.equal(withoutToken.status, 303);
  assert.match(withoutToken.location, /problem=bad-form/);

  const wrongToken = await singer.post("/new", { title: "x", lyrics: "y", csrf: "not-the-token" });
  assert.match(wrongToken.location, /problem=bad-form/);
});

test("the password record carries its own parameters, so raising the cost later does not lock anybody out", () => {
  // Written at a deliberately cheap setting -- the point is the record, not the
  // cost -- and verified against the expensive default reader.
  const cheap = auth.hashPassword("hunter-two-hunter-two", { N: 1024, r: 8, p: 1, keylen: 32, maxmem: 32 * 1024 * 1024 });
  assert.match(cheap, /^scrypt\$1024\$8\$1\$/);
  assert.equal(auth.verifyPassword("hunter-two-hunter-two", cheap), true);
  assert.equal(auth.verifyPassword("something else", cheap), false);
});

test("a malformed password record refuses rather than throwing", () => {
  for (const record of ["", "scrypt$x$y$z$q$r", "not-even-close", "scrypt$1024$8$1$$", "$$$$$"]) {
    assert.equal(auth.verifyPassword("anything", record), false, `record: ${JSON.stringify(record)}`);
  }
});

test("the session token is stored hashed, so the database is not a set of working logins", async (t) => {
  const harness = await boot();
  t.after(() => harness.close());

  const owner = harness.agent();
  await owner.signUp({ email: "owner@example.com" });
  const cookieValue = decodeURIComponent(owner.cookie.split("=").slice(1).join("="));
  assert.ok(cookieValue.length > 20);

  const stored = harness.store.prepare("SELECT token_hash FROM sessions").all();
  assert.equal(stored.length, 1);
  assert.notEqual(stored[0].token_hash, cookieValue);
  assert.equal(stored[0].token_hash, auth.hashToken(cookieValue), "and it is the hash of that token, not of something else");
});

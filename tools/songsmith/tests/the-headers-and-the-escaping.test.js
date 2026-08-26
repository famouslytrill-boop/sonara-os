"use strict";

// The two things that make the rest of the application's safety claims hold up:
// a title somebody typed cannot become script, and the headers that would catch
// it if the escaping were wrong are actually sent.

const test = require("node:test");
const assert = require("node:assert/strict");
const { escape, html, raw } = require("../src/html.js");
const { boot, withTwoPeople } = require("./helpers/app.js");

test("a title that is an attack renders as text", async (t) => {
  const harness = await boot();
  t.after(() => harness.close());
  const { singer } = await withTwoPeople(harness);

  const nasty = '"><script>fetch("/admin")</script>';
  await singer.post("/new", { title: nasty, lyrics: `[Verse 1]\n${nasty}`, style: nasty }, { from: "/new" });
  const song = harness.store.prepare("SELECT * FROM songs ORDER BY rowid DESC").get();

  const page = await singer.get(`/songs/${song.id}`);
  assert.equal(page.status, 200);
  assert.doesNotMatch(page.text, /<script>fetch/);
  assert.match(page.text, /&lt;script&gt;fetch/);
  // The value goes back into the rename box as an attribute, which is the other
  // half of the same question and the one that gets forgotten.
  assert.match(page.text, /value="&quot;&gt;&lt;script&gt;/);

  const list = await singer.get("/songs");
  assert.doesNotMatch(list.text, /<script>fetch/);
});

test("the template tag escapes by default and only raw() gets through", () => {
  assert.equal(String(html`<p>${"<b>"}</p>`), "<p>&lt;b&gt;</p>");
  assert.equal(String(html`<p>${raw("<b>")}</p>`), "<p><b></p>");
  assert.equal(String(html`<p>${["<", ">"]}</p>`), "<p>&lt;&gt;</p>");
  assert.equal(String(html`<p>${null}${undefined}${false}</p>`), "<p></p>");
  assert.equal(escape(`&<>"'`), "&amp;&lt;&gt;&quot;&#39;");
});

test("every page carries a policy that would stop an injected script even if the escaping failed", async (t) => {
  const harness = await boot();
  t.after(() => harness.close());
  const { singer } = await withTwoPeople(harness);

  for (const path of ["/songs", "/new", "/community"]) {
    const answer = await singer.get(path);
    const policy = answer.headers.get("content-security-policy");
    assert.ok(policy, path);
    assert.match(policy, /script-src 'self'/, path);
    assert.doesNotMatch(policy, /unsafe-inline/, path);
    assert.match(policy, /frame-ancestors 'none'/, path);
    assert.match(policy, /form-action 'self'/, path);
    assert.equal(answer.headers.get("x-content-type-options"), "nosniff", path);
    assert.equal(answer.headers.get("cache-control"), "no-store", path);
  }
});

test("the session cookie is HttpOnly and SameSite=Strict", async (t) => {
  const harness = await boot();
  t.after(() => harness.close());

  const owner = harness.agent();
  const created = await owner.signUp({ email: "owner@example.com" });
  const cookie = created.headers.get("set-cookie");
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Path=\//);
  // Not Secure here: the test server is plain http, and marking a cookie Secure
  // over http means the browser drops it and nobody can sign in at all.
  assert.doesNotMatch(cookie, /Secure/);
});

test("the shipped page contains no inline script for the policy to have to allow", async (t) => {
  const harness = await boot();
  t.after(() => harness.close());
  const { singer } = await withTwoPeople(harness);

  const page = await singer.get("/songs");
  const scripts = page.text.match(/<script\b[^>]*>([\s\S]*?)<\/script>/g) || [];
  assert.ok(scripts.length >= 1, "there is one script tag, and this check has not gone blind");
  for (const tag of scripts) {
    assert.match(tag, /<script src="[^"]+" defer><\/script>/, `inline script found: ${tag.slice(0, 80)}`);
  }
  assert.doesNotMatch(page.text, /\son[a-z]+="/, "no onclick= either; that is inline script wearing a different hat");
});

test("a body far bigger than any lyric is refused rather than buffered", async (t) => {
  const harness = await boot();
  t.after(() => harness.close());
  const { singer } = await withTwoPeople(harness);

  const answer = await fetch(`${harness.origin}/new`, {
    method: "POST",
    headers: { cookie: singer.cookie, "content-type": "application/x-www-form-urlencoded" },
    body: `lyrics=${"x".repeat(400 * 1024)}`
  });
  assert.equal(answer.status, 413);
});

test("the rate limiter counts, and stops", async (t) => {
  const harness = await boot();
  t.after(() => harness.close());
  await harness.agent().signUp({ email: "owner@example.com" });

  const guessing = harness.agent();
  let stopped = 0;
  for (let attempt = 0; attempt < 14; attempt += 1) {
    const answer = await guessing.signIn({ email: "owner@example.com", password: "wrong-password-here" });
    if (answer.status === 303 && String(answer.location).includes("too-many")) stopped += 1;
  }
  assert.ok(stopped >= 3, `expected the limiter to bite; it stopped ${stopped} of 14`);
});

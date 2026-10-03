"use strict";

// A channel shows what the business published, and nothing about who wrote or
// flagged it. The decision module, held to its three invariants; the routes are
// driven through the real tenant guard in
// tests/a-channel-is-read-past-the-guard.test.js.

const assert = require("node:assert/strict");
const channels = require("../lib/sonara-growth-channels.cjs");

const PUBLIC = { state: "public" };
const row = (overrides) => ({
  id: "11111111-1111-4111-8111-111111111111",
  kind: "post",
  body: "Doors at seven.",
  event_id: null,
  state: "published",
  created_at: "2026-10-01T10:00:00Z",
  author_user_id: "AUTHOR-SECRET",
  organization_id: "ORG-SECRET",
  ...overrides
});

describe("a removed post is not public", () => {
  describe("public means published, on a public channel, now", () => {
    it("drops a removed post even when the query hands it over", () => {
      const arranged = channels.arrangePublicPosts([row({ state: "removed", body: "TAKEN-DOWN" }), row({ id: "b", body: "STILL-UP" })], { channel: PUBLIC });
      const bodies = [...arranged.announcements, ...arranged.posts].map((post) => post.body);
      assert.deepEqual(bodies, ["STILL-UP"]);
    });

    it("shows nothing at all for a channel that is not public", () => {
      for (const state of ["draft", "hidden", "unknown", undefined]) {
        const arranged = channels.arrangePublicPosts([row({})], { channel: { state } });
        assert.equal(arranged.posts.length + arranged.announcements.length, 0, `a ${state} channel showed a post`);
      }
    });

    it("says a read failed rather than showing an empty channel", () => {
      assert.equal(channels.arrangePublicPosts(null, { channel: PUBLIC }).ok, false);
      assert.equal(channels.reportSummary(undefined).ok, false);
      assert.equal(channels.reportSummary(undefined).open, null, "an unreadable report list is not zero reports");
    });

    it("puts at most three announcements first, newest first, and the rest after", () => {
      const rows = [
        row({ id: "a1", kind: "announcement", created_at: "2026-10-01T01:00:00Z" }),
        row({ id: "a2", kind: "announcement", created_at: "2026-10-01T02:00:00Z" }),
        row({ id: "a3", kind: "announcement", created_at: "2026-10-01T03:00:00Z" }),
        row({ id: "a4", kind: "announcement", created_at: "2026-10-01T04:00:00Z" }),
        row({ id: "p1", kind: "post", created_at: "2026-10-01T05:00:00Z" })
      ];
      const arranged = channels.arrangePublicPosts(rows, { channel: PUBLIC });
      assert.deepEqual(arranged.announcements.map((post) => post.id), ["a4", "a3", "a2"]);
      assert.deepEqual(arranged.posts.map((post) => post.id), ["p1", "a1"], "an announcement past the third is still shown, in order");
    });

    it("says when there was more than it showed", () => {
      const rows = Array.from({ length: channels.POSTS_SHOWN + 1 }, (_, index) => row({ id: `p${index}`, created_at: `2026-10-01T00:00:${String(index).padStart(2, "0")}Z` }));
      assert.equal(channels.arrangePublicPosts(rows, { channel: PUBLIC }).truncated, true);
      assert.equal(channels.arrangePublicPosts(rows.slice(1), { channel: PUBLIC }).truncated, false);
    });
  });

  describe("a stranger sees what was said, never who said it", () => {
    it("builds a public post from named fields only", () => {
      const post = channels.publicPost(row({}));
      assert.deepEqual(Object.keys(post).sort(), ["body", "createdAt", "event", "id", "kind"]);
      assert.doesNotMatch(JSON.stringify(post), /SECRET/);
    });

    it("links an event only when the route confirmed it", () => {
      const eventId = "22222222-2222-4222-8222-222222222222";
      assert.equal(channels.publicPost(row({ event_id: eventId })).event, null, "an unconfirmed event became a link");
      const linked = channels.publicPost(row({ event_id: eventId }), new Map([[eventId, { slug: "spring-fair", title: "Spring Fair", organization_id: "ORG-SECRET" }]]));
      assert.deepEqual({ ...linked.event }, { slug: "spring-fair", title: "Spring Fair" });
    });

    it("escapes a body and makes nothing in it a link", () => {
      const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
      const html = channels.bodyHtml('Visit https://example.test <script>alert(1)</script>\nline two', escape);
      assert.doesNotMatch(html, /<script|<a\b/);
      assert.match(html, /https:\/\/example\.test/);
      assert.match(html, /<br>line two/);
    });

    it("writes the directory row with exactly the public columns", () => {
      const listed = channels.directoryRow({ id: "c", handle: "nova", title: "Nova", about: null, organization_id: "ORG-SECRET", state: "public" });
      assert.deepEqual(Object.keys(listed).sort(), ["about", "channel_id", "handle", "title"]);
    });
  });

  describe("a report is a signal to the owner, not a verdict", () => {
    it("counts open reports per post and ignores decided ones", () => {
      const summary = channels.reportSummary([
        { post_id: "p", reason: "spam", state: "open" },
        { post_id: "p", reason: "spam", state: "open" },
        { post_id: "p", reason: "hate", state: "open" },
        { post_id: "p", reason: "spam", state: "dismissed" },
        { post_id: "q", reason: "spam", state: "actioned" }
      ]);
      assert.equal(summary.open, 3);
      assert.deepEqual(summary.byPost.get("p"), { total: 3, reasons: { spam: 2, hate: 1 } });
      assert.equal(summary.byPost.has("q"), false);
    });

    it("has no function that hides a post because of reports", () => {
      // The module's whole surface. Nothing in it takes reports and returns a
      // post state; if one is added, this names it.
      const surface = Object.keys(channels).filter((name) => typeof channels[name] === "function");
      assert.deepEqual(surface.sort(), [
        "arrangePublicPosts", "atomFeed", "bodyHtml", "channelVisibility", "directoryRow", "isUuid",
        "normalizeChannel", "normalizePost", "normalizeReport", "problemSentence", "publicPost", "reportSummary"
      ]);
    });
  });

  describe("a feed carries what the page carries, and nothing more", () => {
    const channel = { id: "c1", handle: "fair-news", title: "Fair & News", about: "News <from> the fair", state: "public" };
    const rows = [
      row({ id: "p1", kind: "announcement", body: 'Doors at <7> & "bring" mates\nsecond line', created_at: "2026-10-01T10:00:00Z" }),
      row({ id: "p2", body: "TAKEN-DOWN", state: "removed", created_at: "2026-10-02T10:00:00Z" })
    ];
    const feed = (origin) => channels.atomFeed({ channel, arranged: channels.arrangePublicPosts(rows, { channel }), origin, now: new Date("2026-10-03T00:00:00Z") });

    it("leaves out a removed post and every private field", () => {
      const xml = feed("https://sonaraindustries.com");
      assert.doesNotMatch(xml, /TAKEN-DOWN|SECRET/);
      assert.equal((xml.match(/<entry>/g) || []).length, 1);
    });

    it("escapes everything a post or channel says, so the document stays well-formed", () => {
      const xml = feed("https://sonaraindustries.com");
      assert.match(xml, /<title>Fair &amp; News<\/title>/);
      assert.match(xml, /Doors at &lt;7&gt; &amp; &quot;bring&quot; mates/);
      // Every < in the document opens one of the elements this function writes.
      const tags = [...xml.matchAll(/<\/?([a-z?]+)/g)].map((match) => match[1]);
      assert.deepEqual([...new Set(tags)].sort(), ["?xml", "author", "category", "content", "entry", "feed", "id", "link", "name", "subtitle", "title", "updated"]);
      assert.match(xml, /<content type="text">/, "content is text, so a reader makes nothing in it a link");
    });

    it("drops control characters XML refuses, so one old row cannot break the feed", () => {
      const xml = channels.atomFeed({ channel: { ...channel, title: "Bad\u0001Title" }, arranged: channels.arrangePublicPosts([], { channel }) });
      assert.doesNotMatch(xml, /\u0001/);
    });

    it("prints no link at all rather than inventing an address", () => {
      const xml = feed("");
      assert.doesNotMatch(xml, /<link /);
      assert.match(xml, /<id>tag:sonaraindustries\.com,2026:post:p1<\/id>/, "ids do not depend on the address");
    });

    it("dates the feed by its newest post", () => {
      assert.match(feed(""), /<feed[\s\S]*?<updated>2026-10-01T10:00:00\.000Z<\/updated>/);
    });
  });

  describe("what a form may write", () => {
    it("takes a channel address through the same rules as a creator handle", () => {
      assert.equal(channels.normalizeChannel({ handle: "Spring-Fair", title: "Fair" }).channel.handle, "spring-fair");
      assert.deepEqual(channels.normalizeChannel({ handle: "admin", title: "Fair" }).problems, ["handle_reserved"]);
      assert.deepEqual(channels.normalizeChannel({ handle: "a/b", title: "Fair" }).problems, ["handle_shape"]);
      assert.deepEqual(channels.normalizeChannel({ handle: "fair", title: "" }).problems, ["title_missing"]);
    });

    it("refuses an empty, overlong or control-character post, and an event id that is not one", () => {
      assert.deepEqual(channels.normalizePost({ body: "   " }).problems, ["body_missing"]);
      assert.deepEqual(channels.normalizePost({ body: "x".repeat(channels.BODY_MAX + 1) }).problems, ["body_long"]);
      assert.deepEqual(channels.normalizePost({ body: "a\u0000b" }).problems, ["text_control"]);
      assert.deepEqual(channels.normalizePost({ body: "hi", event_id: "spring-fair" }).problems, ["event_missing"]);
      assert.deepEqual(channels.normalizePost({ body: "hi", kind: "broadcast" }).problems, ["kind_unknown"]);
      assert.equal(channels.normalizePost({ body: "one\r\ntwo" }).post.body, "one\ntwo");
    });

    it("takes a report only with a reason and a post id", () => {
      const post = "33333333-3333-4333-8333-333333333333";
      assert.equal(channels.normalizeReport({ post_id: post, reason: "spam" }).ok, true);
      assert.deepEqual(channels.normalizeReport({ post_id: post, reason: "" }).problems, ["reason_missing"]);
      assert.deepEqual(channels.normalizeReport({ post_id: "1 or 1=1", reason: "spam" }).problems, ["post_missing"]);
      assert.deepEqual(channels.normalizeReport({ post_id: post, reason: "spam", note: "x".repeat(channels.NOTE_MAX + 1) }).problems, ["note_long"]);
    });

    it("has a sentence for every code it can produce", () => {
      const codes = ["handle_required", "handle_too_short", "handle_too_long", "handle_shape", "handle_reserved", "handle_taken",
        "title_missing", "title_long", "about_long", "text_control", "kind_unknown", "body_missing", "body_long",
        "event_missing", "channel_missing", "channel_cap", "post_missing", "reason_missing", "note_long", "not_listed",
        "still_public", "save_failed"];
      for (const code of codes) assert.ok(channels.problemSentence(code), `${code} has no sentence`);
    });
  });
});

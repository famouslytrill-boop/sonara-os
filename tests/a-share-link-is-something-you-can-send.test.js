"use strict";

// The Share button's whole purpose is producing something you can paste into a
// message. It printed a path:
//
//   Anyone with this link can read this result: /shared/abc123...
//
// The anchor worked when clicked in the page, so nothing was broken in a way a
// test asserting a 200 would notice. But the text a person reads and copies was
// a path, and a path pasted into an email or a text message goes nowhere. The
// feature quietly did not do the thing it exists for.
//
// `shareUrl(origin, token)` was already written for this, in
// lib/sonara-shared-results.cjs, and **was called by nothing in the
// repository** -- the page had its own copy of `/shared/${token}` instead. That
// second copy is the other half of the finding: the share address had two
// definitions and only one of them checked the token, because `sharePath()`
// returns null for anything that is not a share token and the hand-built string
// rendered a link for whatever it was handed.
//
// Three states, not two, as everywhere else here:
//
//   a full origin  -> the address a person can send
//   no origin      -> the path, which is short but true
//   a bad token    -> no link at all, and the Share button instead
//
// The third is why the origin is never defaulted. An invented host looks
// sendable and is not, which is worse than a path that is obviously partial.

const assert = require("node:assert/strict");
const { renderShareControl } = require("../lib/sonara-module-crud.cjs");
const { siteOrigin } = require("../lib/sonara-site-origin.cjs");
const { sharePath, shareUrl, mintShareToken } = require("../lib/sonara-shared-results.cjs");

const RECORD = "11111111-1111-4111-8111-111111111111";
const TOKEN = mintShareToken();

const shared = (token) => ({ [RECORD]: token ? { token } : {} });
const control = (over = {}) =>
  renderShareControl({ record: { id: RECORD }, shared: shared(TOKEN), backHref: "/creator-studio/records", ...over });

describe("a share link is something you can send", () => {
  describe("the harness is capable of failing", () => {
    it("has a token the share module itself accepts", () => {
      // A token the module would reject makes every assertion below vacuous:
      // sharePath returns null and no link is rendered at all.
      assert.ok(sharePath(TOKEN), "the minted token is not a share token; this whole file is testing the empty case");
      assert.ok(shareUrl("https://example.test", TOKEN).endsWith(sharePath(TOKEN)));
    });
  });

  describe("with an origin", () => {
    it("shows an address a person can paste into a message", () => {
      const html = control({ origin: "https://app.example.test" });
      assert.ok(
        html.includes(`https://app.example.test/shared/${TOKEN}`),
        "the share control still shows a path rather than an address; pasting it anywhere else goes nowhere"
      );
    });

    it("keeps the href relative so it survives a proxy that rewrites the host", () => {
      // Only the text needs the origin. The href resolves in the browser, and a
      // hard-coded host in it would break the day this is served from another.
      const html = control({ origin: "https://app.example.test" });
      assert.match(html, new RegExp(`href="/shared/${TOKEN}"`), "the href is no longer relative");
    });

    it("does not double the slash when the origin has a trailing one", () => {
      const html = control({ origin: "https://app.example.test/" });
      assert.ok(!html.includes("example.test//shared"), "a trailing slash on the origin produced a doubled path");
    });
  });

  describe("without an origin", () => {
    it("shows the path rather than an invented address", () => {
      const html = control({ origin: "" });
      assert.ok(html.includes(`/shared/${TOKEN}`), "nothing was shown at all");
      assert.ok(!/https?:\/\//.test(html.split("Anyone with this link")[1] || ""), "an origin was invented");
    });
  });

  describe("a token the share module would refuse", () => {
    it("renders no link at all, and offers the Share button instead", () => {
      // The hand-built `/shared/${token}` rendered a link for anything. This is
      // the case that separates using sharePath() from copying it.
      for (const bad of ["", "  ", "not a token", "../admin", "<script>", "x".repeat(500)]) {
        const html = renderShareControl({ record: { id: RECORD }, shared: shared(bad), backHref: "/x", origin: "https://app.example.test" });
        assert.ok(!html.includes("Anyone with this link"), `a link was rendered for the token ${JSON.stringify(bad)}`);
        assert.ok(html.includes("Share this result"), `no Share button offered for the token ${JSON.stringify(bad)}`);
      }
    });
  });

  describe("not knowing is not the same as not shared", () => {
    it("says the check did not happen rather than offering to share again", () => {
      // shared === null means the lookup failed. Rendering the Share button
      // would invite somebody to create a second link for a record that may
      // already have one.
      for (const unknown of [null, undefined]) {
        const html = renderShareControl({ record: { id: RECORD }, shared: unknown, backHref: "/x", origin: "https://app.example.test" });
        assert.ok(html.includes("could not check"), "a failed lookup was not reported as one");
        assert.ok(!html.includes("Share this result"), "a failed lookup offered to share, which may make a second link");
      }
    });
  });

  describe("one definition of where this site lives", () => {
    it("prefers a configured https origin", () => {
      const req = { protocol: "http", get: () => "localhost:3000" };
      assert.equal(siteOrigin(req, () => "https://sonara.example/"), "https://sonara.example");
    });

    it("ignores a configured origin that is not https", () => {
      // The value is used to build addresses that leave this application. An
      // http origin in one of those is a downgrade somebody else acts on.
      const req = { protocol: "https", get: () => "real.example" };
      assert.equal(siteOrigin(req, () => "http://sonara.example"), "https://real.example");
    });

    it("falls back to the request's own scheme and host", () => {
      const req = { protocol: "https", get: () => "tenant.example" };
      assert.equal(siteOrigin(req, () => ""), "https://tenant.example");
    });

    it("returns nothing rather than a guess when there is no host", () => {
      assert.equal(siteOrigin({ protocol: "https", get: () => "" }, () => ""), "");
      assert.equal(siteOrigin(undefined, () => ""), "");
      assert.equal(siteOrigin({}, () => ""), "");
    });

    it("is the only definition -- the payment routes no longer keep their own", () => {
      const fs = require("node:fs");
      const path = require("node:path");
      const source = fs.readFileSync(path.join(__dirname, "..", "routes", "sonara-connected-payment-routes.cjs"), "utf8");
      assert.match(source, /siteOrigin\(req, getEnv\)/, "the payment routes no longer use the shared helper");
      assert.doesNotMatch(
        source,
        /const configured = getEnv\("NEXT_PUBLIC_SITE_URL"\)/,
        "the payment routes have grown their own copy of the origin rule again"
      );
    });
  });
});

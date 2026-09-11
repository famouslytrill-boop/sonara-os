"use strict";

const assert = require("node:assert/strict");
const {
  SUPPRESSIONS_ENDPOINT,
  PAGE_SIZE,
  MAX_PAGES,
  ORIGINS,
  readSuppressions,
  markSuppressed
} = require("../lib/growth-studio-suppression.cjs");
const { partitionRecipients, SKIP_REASONS } = require("../lib/growth-studio-sender.cjs");

// `growth-studio-sender.cjs` has always documented a `suppressed` skip reason --
// "They unsubscribed or a previous send bounced." -- and **nothing set it.** The
// partition honoured a field that could never be true, which is a check that
// cannot fire: not wrong, just inert. These assertions are about it firing.
//
// The other half is what this must NOT do. A suppression is not consent.
// `growth_contact_consents` records what a person agreed to; this records
// whether the address still works, and a hard bounce is the mail server's
// decision rather than the person's. So it is read and acted on and never
// written back as a withdrawal.

const CONSENT = Object.freeze({ channel: "email", consent_status: "granted" });
const KEY = { RESEND_API_KEY: "re_test" };

function page(rows, hasMore = false) {
  return new Response(JSON.stringify({ object: "list", data: rows, has_more: hasMore }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}

function suppression(email, origin = "bounce", id = email) {
  return { id, email, origin, source_id: "email-1", created_at: "2026-09-01T00:00:00Z" };
}

// One page of `count` rows, ids that page cleanly.
function fullPage(index) {
  return Array.from({ length: PAGE_SIZE }, (unused, row) => suppression(`p${index}r${row}@example.com`, "bounce", `id-${index}-${row}`));
}

describe("a dead address is not mailed twice", () => {
  describe("reading the provider's list", () => {
    it("collects the addresses and why each one is on the list", async () => {
      const result = await readSuppressions({
        getEnv: (name) => KEY[name],
        fetchImpl: async () => page([suppression("gone@example.com", "bounce"), suppression("cross@example.com", "complaint")])
      });

      assert.equal(result.ok, true);
      assert.ok(result.addresses.has("gone@example.com"));
      assert.equal(result.origins.get("cross@example.com"), "complaint", "an owner does something different about a complaint than a bounce");
      assert.equal(result.pages, 1);
    });

    it("matches an address whatever case the provider returns it in", async () => {
      const result = await readSuppressions({
        getEnv: (name) => KEY[name],
        fetchImpl: async () => page([suppression("Mixed.Case@Example.COM")])
      });
      assert.ok(result.addresses.has("mixed.case@example.com"), "normaliseAddress lowercases, so this side has to as well");
    });

    it("pages until the provider says there is no more", async () => {
      let calls = 0;
      const result = await readSuppressions({
        getEnv: (name) => KEY[name],
        fetchImpl: async (url) => {
          calls += 1;
          if (calls === 1) {
            assert.ok(!String(url).includes("after="), "the first page must not ask for a cursor");
            return page(fullPage(0), true);
          }
          assert.ok(String(url).includes("after=id-0-99"), `page 2 must continue from the last id: ${url}`);
          return page([suppression("last@example.com")], false);
        }
      });

      assert.equal(result.ok, true);
      assert.equal(calls, 2);
      assert.equal(result.addresses.size, PAGE_SIZE + 1);
    });

    it("stops on a short page even when has_more is missing", async () => {
      // A body that omitted has_more would otherwise loop to the ceiling on a
      // list already exhausted.
      let calls = 0;
      const result = await readSuppressions({
        getEnv: (name) => KEY[name],
        fetchImpl: async () => {
          calls += 1;
          return new Response(JSON.stringify({ data: [suppression("one@example.com")] }), { status: 200, headers: { "content-type": "application/json" } });
        }
      });
      assert.equal(result.ok, true);
      assert.equal(calls, 1);
    });

    it("asks for the provider's documented maximum page size", async () => {
      let asked = "";
      await readSuppressions({ getEnv: (name) => KEY[name], fetchImpl: async (url) => { asked = String(url); return page([]); } });
      assert.ok(asked.startsWith(SUPPRESSIONS_ENDPOINT), asked);
      assert.match(asked, new RegExp(`limit=${PAGE_SIZE}`));
      assert.ok(PAGE_SIZE <= 100, "the reference documents a maximum of 100; asking for more is silently clamped");
    });

    // The defect this repository is named for, on the field that decides who
    // gets mailed.
    describe("what it says when it does not know", () => {
      it("tells 'not configured' apart from 'could not read'", async () => {
        const missing = await readSuppressions({ getEnv: () => undefined, fetchImpl: async () => page([]) });
        assert.equal(missing.ok, false);
        assert.equal(missing.code, "not_configured");

        const broken = await readSuppressions({ getEnv: (name) => KEY[name], fetchImpl: async () => new Response("nope", { status: 500 }) });
        assert.equal(broken.ok, false);
        assert.equal(broken.code, "unreadable");
        assert.notEqual(broken.code, missing.code, "a timed-out request is not a misconfigured provider");
      });

      it("never reports an unreadable body as an empty list", async () => {
        for (const body of ["not json", JSON.stringify({ data: "nope" }), JSON.stringify({})]) {
          const result = await readSuppressions({
            getEnv: (name) => KEY[name],
            fetchImpl: async () => new Response(body, { status: 200, headers: { "content-type": "application/json" } })
          });
          assert.equal(result.ok, false, `a body of ${body} must not read as nobody being suppressed`);
          assert.equal(result.addresses.size, 0);
        }
      });

      it("returns nothing rather than a partial list past the page ceiling", async () => {
        // A partial list would skip the suppressed addresses it happened to see
        // and mail the rest while reporting the screen as done.
        let calls = 0;
        const result = await readSuppressions({
          getEnv: (name) => KEY[name],
          fetchImpl: async () => {
            calls += 1;
            return page(fullPage(calls), true);
          }
        });

        assert.equal(result.ok, false);
        assert.equal(result.code, "too_many");
        assert.equal(calls, MAX_PAGES, "it must stop at the ceiling rather than page for ever");
        assert.equal(result.addresses.size, 0, "returning the first pages would be a screen that reports more than it did");
        assert.match(result.reason, new RegExp(String(MAX_PAGES * PAGE_SIZE)));
      });

      it("stops rather than looping when a page gives no cursor", async () => {
        let calls = 0;
        const result = await readSuppressions({
          getEnv: (name) => KEY[name],
          fetchImpl: async () => {
            calls += 1;
            return page(Array.from({ length: PAGE_SIZE }, () => ({ email: "x@example.com", origin: "bounce" })), true);
          }
        });
        assert.equal(result.ok, false);
        assert.equal(calls, 1, "repeating the same request would return the same page for ever");
      });

      it("keeps the page ceiling inside the send's own time budget", () => {
        // Vercel's documented default is 300s and the 400-recipient send cap
        // already claims 200 of it at a pessimistic 500ms per request.
        const pessimisticSeconds = MAX_PAGES * 0.5;
        assert.ok(pessimisticSeconds <= 60, `${MAX_PAGES} pages is ${pessimisticSeconds}s, which does not leave the send its budget`);
      });
    });

    it("keeps an unrecognised origin as itself rather than guessing", async () => {
      const result = await readSuppressions({
        getEnv: (name) => KEY[name],
        fetchImpl: async () => page([suppression("odd@example.com", "something_new")])
      });
      assert.equal(result.origins.get("odd@example.com"), "unrecognised", "if the provider adds a fourth origin the owner should see it is new");
      assert.deepEqual(ORIGINS.slice().sort(), ["bounce", "complaint", "manual"]);
    });
  });

  describe("marking the recipients", () => {
    const recipients = [
      { email: "live@example.com", consent: CONSENT },
      { email: "gone@example.com", consent: CONSENT }
    ];

    it("sets the field the sender already documented", () => {
      const screened = markSuppressed(recipients, {
        ok: true,
        addresses: new Set(["gone@example.com"]),
        origins: new Map([["gone@example.com", "bounce"]])
      });

      assert.equal(screened.checked, true);
      assert.equal(screened.marked, 1);
      assert.equal(screened.recipients[1].suppressed, true);
      assert.equal(screened.recipients[1].suppression_origin, "bounce");
      assert.ok(!("suppressed" in screened.recipients[0]), "a live address must not be touched");
    });

    it("makes the sender actually skip them, with its own named reason", () => {
      // The point of the whole module: the partition's `suppressed` branch was
      // unreachable, so this asserts the two halves meet.
      const screened = markSuppressed(recipients, {
        ok: true,
        addresses: new Set(["gone@example.com"]),
        origins: new Map([["gone@example.com", "bounce"]])
      });
      const split = partitionRecipients(screened.recipients);

      assert.equal(split.eligible.length, 1);
      assert.equal(split.eligible[0].email, "live@example.com");
      assert.equal(split.skipped.length, 1);
      assert.equal(split.skipped[0].reason, "suppressed");
      assert.equal(split.skipped[0].detail, SKIP_REASONS.suppressed);
    });

    it("marks nobody when the screen did not run, and says it did not", () => {
      for (const failed of [{ ok: false }, null, undefined, { ok: false, addresses: new Set(["gone@example.com"]) }]) {
        const screened = markSuppressed(recipients, failed);
        assert.equal(screened.checked, false);
        assert.equal(screened.marked, 0);
        assert.deepEqual(screened.recipients, recipients, "a failed screen must not mark anybody on the strength of a read that did not answer");
      }
    });

    it("does not fall over on a recipient with no address", () => {
      const screened = markSuppressed([{ consent: CONSENT }, null], { ok: true, addresses: new Set(["gone@example.com"]), origins: new Map() });
      assert.equal(screened.marked, 0);
      assert.equal(screened.recipients.length, 2);
    });
  });

  // The boundary that keeps this from becoming something it is not.
  describe("a suppression is not a withdrawal of consent", () => {
    it("writes nothing, anywhere", () => {
      // A hard bounce is the mail server's decision, not the person's.
      // Recording it as a withdrawal would put words in their mouth, and an
      // owner who later fixed the address would find a refusal nobody made.
      const source = require("node:fs").readFileSync(require.resolve("../lib/growth-studio-suppression.cjs"), "utf8");
      const code = source.replace(/\/\/[^\n]*/g, "");
      assert.ok(!code.includes("consent_status"), "this module must not touch the consent table");
      assert.ok(!code.includes("withdrawn"), "a bounce is not a withdrawal");
      assert.ok(!/method:\s*["'`](POST|PATCH|PUT|DELETE)/.test(code), "this module reads and never writes");
      // And the guard against the check above passing on an empty read.
      assert.ok(code.includes("SUPPRESSIONS_ENDPOINT"), "no code was read; this check has gone blind");
    });

    it("leaves the consent decision entirely to the consent columns", () => {
      // A suppressed address with granted consent is skipped for being
      // suppressed; an unsuppressed address with no consent is skipped for
      // consent. Neither reason is derived from the other.
      const screened = markSuppressed(
        [{ email: "gone@example.com", consent: CONSENT }, { email: "nopermission@example.com" }],
        { ok: true, addresses: new Set(["gone@example.com"]), origins: new Map([["gone@example.com", "complaint"]]) }
      );
      const split = partitionRecipients(screened.recipients);
      assert.deepEqual(split.skipped.map((entry) => entry.reason).sort(), ["no_consent", "suppressed"]);
      assert.equal(split.eligible.length, 0);
    });
  });
});

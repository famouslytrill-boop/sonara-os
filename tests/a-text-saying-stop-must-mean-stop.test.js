"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  OPT_OUT_KEYWORDS,
  OPT_IN_KEYWORDS,
  HELP_KEYWORDS,
  REFUSED_OPT_IN_KEYWORDS,
  normaliseInbound,
  classifyInbound,
  confirmationOwedBy
} = require("../lib/sonara-sms-keywords.cjs");
const { consentState } = require("../lib/growth-studio-sender.cjs");
const { authoriseOutbound } = require("../lib/sonara-telephony.cjs");

// SMS opt-out is a legal obligation on any outbound text, and it has two halves
// that fail in opposite directions.
//
// Missing an opt-out keeps texting somebody who said stop. Inventing one stops
// texting a customer who did not -- and that failure is silent, because the
// owner's next message simply never arrives and the refusal is a code in a log.
//
// So this file asserts both, and the second half is the larger one.

describe("a text saying stop must mean stop, and nothing else may", () => {
  it("has keywords to test, so nothing here passes on an empty list", () => {
    assert.ok(OPT_OUT_KEYWORDS.length >= 7, `only ${OPT_OUT_KEYWORDS.length} opt-out keywords; this check has gone blind`);
    assert.equal(OPT_IN_KEYWORDS.length, 2, "start and unstop are the only two that undo carrier blocking");
    assert.ok(HELP_KEYWORDS.length >= 1, "help is reserved on both carriers and must be recognised");
  });

  describe("the keyword lists are a union of what both carriers document", () => {
    // Read 10 September 2026 from each vendor's own page. Held as literals here
    // rather than derived from the module, so a keyword being dropped from the
    // module fails rather than shrinking the expectation with it.
    const TWILIO = ["stop", "unsubscribe", "end", "quit", "stopall", "revoke", "optout", "cancel"];
    const TELNYX = ["stop", "stopall", "stop all", "unsubscribe", "cancel", "end", "quit"];

    it("honours every keyword Twilio documents", () => {
      const missed = TWILIO.filter((word) => classifyInbound({ body: word }).action !== "opt_out");
      assert.deepEqual(missed, [], `Twilio's documented list is not fully honoured: ${missed.join(", ")}`);
    });

    it("honours every keyword Telnyx documents", () => {
      const missed = TELNYX.filter((word) => classifyInbound({ body: word }).action !== "opt_out");
      assert.deepEqual(missed, [], `Telnyx's documented list is not fully honoured: ${missed.join(", ")}`);
    });

    it("covers the keywords only one of them documents, which is the reason for a union", () => {
      // The lists genuinely differ, and the difference is the whole argument for
      // taking the union. If this stops being true the comment above is stale.
      const onlyTwilio = TWILIO.filter((word) => !TELNYX.includes(word));
      const onlyTelnyx = TELNYX.filter((word) => !TWILIO.includes(word));
      assert.ok(onlyTwilio.length > 0 && onlyTelnyx.length > 0, "the two lists no longer differ; the union argument needs rewriting");
      for (const word of [...onlyTwilio, ...onlyTelnyx]) {
        assert.equal(classifyInbound({ body: word }).action, "opt_out", `${word} is documented by one carrier and must not stop working on the other`);
      }
    });
  });

  describe("what counts as the keyword", () => {
    it("reads a keyword whatever case it arrives in", () => {
      for (const body of ["STOP", "Stop", "sToP"]) {
        assert.equal(classifyInbound({ body }).action, "opt_out", `${body} must be read as an opt-out`);
      }
    });

    it("reads a keyword through surrounding whitespace and punctuation", () => {
      for (const body of [" stop ", "STOP.", "\"stop\"", "stop!", "  Stop,  ", "-stop-"]) {
        assert.equal(classifyInbound({ body }).action, "opt_out", `${JSON.stringify(body)} must be read as an opt-out`);
      }
    });

    it("reads a keyword through invisible characters, which survive a trim", () => {
      // Zero-width characters get pasted in from other apps and would break an
      // exact compare while looking identical to a person.
      assert.equal(classifyInbound({ body: "​STOP​" }).action, "opt_out");
      assert.equal(normaliseInbound("﻿stop"), "stop");
    });

    it("collapses the inner spacing of a two-word keyword", () => {
      assert.equal(classifyInbound({ body: "STOP   ALL" }).action, "opt_out");
      assert.equal(classifyInbound({ body: "stop all" }).matched, "stop all");
    });
  });

  describe("what must NOT count, which is the half that fails silently", () => {
    // Substring matching is the obvious implementation of this feature and it
    // is wrong in the expensive direction: it stops a business texting a
    // customer who never asked it to, and the only symptom is messages not
    // arriving.
    const ORDINARY_REPLIES = [
      "please stop by at four",
      "can you stop the cleaners coming friday",
      "I want to cancel my appointment on tuesday",
      "quit smoking is my new years thing lol",
      "end of the month works better",
      "yes",
      "yes please",
      "no thanks",
      "sounds good, see you then",
      "unsubscribe me from the newsletter but keep texting",
      "who is this",
      "help me pick a time"
    ];

    it("treats an ordinary sentence as a message rather than a command", () => {
      const wrongly = ORDINARY_REPLIES.filter((body) => classifyInbound({ body }).action !== "none");
      assert.deepEqual(
        wrongly,
        [],
        "these replies were read as commands, which would silently stop a business texting a customer:\n  " + wrongly.join("\n  ")
      );
    });

    it("has replies to test, and they really do contain the keywords", () => {
      // Otherwise the assertion above passes by testing sentences with no
      // keyword in them at all, which proves nothing about substring matching.
      const every = [...OPT_OUT_KEYWORDS, ...OPT_IN_KEYWORDS, ...HELP_KEYWORDS, ...REFUSED_OPT_IN_KEYWORDS];
      const containing = ORDINARY_REPLIES.filter((body) => every.some((word) => body.toLowerCase().includes(word)));
      assert.ok(
        containing.length >= 8,
        `only ${containing.length} of the ${ORDINARY_REPLIES.length} ordinary replies contain a keyword; this check is not testing substrings`
      );
      // And the rest are there on purpose too: an inbound text that resembles
      // nothing is the common case, and reading it as a command is the same bug.
      assert.ok(containing.length < ORDINARY_REPLIES.length, "every reply contains a keyword, so the plain-message case is untested");
    });

    it("treats an empty or missing message as asking for nothing", () => {
      for (const body of ["", "   ", null, undefined]) {
        const result = classifyInbound({ body });
        assert.equal(result.action, "none", `${JSON.stringify(body)} must not be an opt-out`);
        assert.equal(result.matched, null);
      }
    });
  });

  describe("YES, which is recognised and deliberately refused", () => {
    // Twilio, verbatim: "Only the keywords START and UNSTOP can fully undo the
    // blocking. Twilio's supported keyword 'YES' will not work to opt-in a
    // previously unsubscribed user."
    it("does not read YES as permission", () => {
      const result = classifyInbound({ body: "YES" });
      assert.equal(result.action, "none", "recording YES as permission would say reachable while the carrier still blocks");
      assert.notEqual(result.action, "opt_in");
    });

    it("says why, rather than looking like an oversight", () => {
      const result = classifyInbound({ body: "yes" });
      assert.equal(result.keyword, "yes", "the keyword is recognised; only its effect is refused");
      assert.match(result.reason, /block/i, "the refusal must carry its reason, or the next person reads an omission");
      assert.ok(REFUSED_OPT_IN_KEYWORDS.includes("yes"));
    });

    it("keeps START and UNSTOP working, since those are the two that do undo it", () => {
      for (const body of ["START", "unstop", "Start."]) {
        assert.equal(classifyInbound({ body }).action, "opt_in", `${body} is documented as undoing carrier blocking`);
      }
    });
  });

  describe("the confirmation reply, which is a vendor setting and is returned as one", () => {
    it("owes nothing extra when the carrier already replies", () => {
      const result = confirmationOwedBy({ vendorAutoResponseEnabled: true });
      assert.equal(result.owedByUs, false);
    });

    it("owes the reply when the carrier's automatic response is off", () => {
      assert.equal(confirmationOwedBy({ vendorAutoResponseEnabled: false }).owedByUs, true);
    });

    it("does not read an unrecorded setting as either answer", () => {
      // Three states, not two. Defect four from the checks-that-cannot-lie
      // skill: absent is not false. Reading unknown as "carrier handles it"
      // would leave a legal obligation unmet on a default nobody chose.
      for (const input of [{}, { vendorAutoResponseEnabled: null }, { vendorAutoResponseEnabled: undefined }]) {
        const result = confirmationOwedBy(input);
        assert.equal(result.owedByUs, null, `${JSON.stringify(input)} must not resolve to a guess`);
        assert.match(result.reason, /recorded|not a default/i);
      }
    });
  });

  describe("the half that already worked, asserted here so the two are not confused", () => {
    // This file adds recognition. Enforcement predates it, and stating that
    // accurately matters: an entry in docs/SHIP_READINESS.md said "nothing
    // implements it", which was wrong about the refusal side.
    const withdrawnContact = {
      consents: [{ channel: "sms", purpose: "campaign_sms", consent_status: "withdrawn", withdrawn_at: "2026-09-01T00:00:00Z" }]
    };

    it("already refuses an outbound text to a withdrawn sms consent", () => {
      assert.equal(consentState(withdrawnContact, Date.now(), { channel: "sms" }), "consent_revoked");
      const authorised = authoriseOutbound({
        recipient: withdrawnContact,
        channel: "sms",
        history: { ok: true, rows: [] },
        allowanceMinor: 500
      });
      assert.equal(authorised.allowed, false, "a recorded opt-out must block the send before anything is spent");
      assert.equal(authorised.code, "consent_revoked");
    });

    it("still allows a granted one, so the refusal above is not refusing everything", () => {
      const granted = { consents: [{ channel: "sms", purpose: "campaign_sms", consent_status: "granted" }] };
      const authorised = authoriseOutbound({
        recipient: granted,
        channel: "sms",
        history: { ok: true, rows: [] },
        allowanceMinor: 500
      });
      assert.equal(authorised.allowed, true, "if this refuses too, the test above proves nothing");
    });
  });

  describe("the module says where its keywords came from", () => {
    const source = fs.readFileSync(path.join(__dirname, "..", "lib", "sonara-sms-keywords.cjs"), "utf8");

    it("read the module, so the assertions below are not measuring an empty string", () => {
      assert.ok(source.length > 3000, `only ${source.length} bytes read; this check has gone blind`);
    });

    it("names both vendors' pages and the date they were read", () => {
      // A keyword list with no source is a keyword list somebody typed from
      // memory, and this one carries a legal obligation.
      assert.match(source, /twilio\.com/, "the Twilio page the list came from");
      assert.match(source, /telnyx\.com/, "and the Telnyx one, since the list is a union of the two");
      assert.match(source, /\b\d{1,2} September 2026\b/, "and when they were read");
    });

    it("writes nothing anywhere, because a decision core that writes cannot be tested without a database", () => {
      // Same separation as growth-studio-sender/dispatch: this decides, the
      // route that does not exist yet writes.
      for (const verb of ["fetch(", "PATCH", "POST", "insert("]) {
        assert.ok(!source.includes(verb), `${verb} appears in a module documented as deciding only`);
      }
    });
  });
});

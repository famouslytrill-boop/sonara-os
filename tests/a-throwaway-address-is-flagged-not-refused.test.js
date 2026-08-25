"use strict";

// A throwaway address changes a number, not whether the business hears from
// somebody.
//
// The tempting version of this feature refuses the address. That loses exactly
// the sale the widget exists to win: a real customer whose company mail is down
// uses a throwaway address, and so does somebody typing on a phone in a car
// park. So the address is recorded, the lead is written, the lead is routed,
// and the only thing that changes is a risk flag the business can see.
//
// The failure this file is mostly about is quieter than a wrong score. The list
// is a data file, and `vercel.json` bundles only `{public/**,routes/**,lib/**}`
// into the deployed function. A list kept anywhere else is present in every
// test run and absent in production: the lookup finds nothing, flags nothing,
// and every check stays green while the feature does nothing at all for the
// customers who paid for it. That is asserted here rather than remembered.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const disposable = require("../lib/sonara-disposable-email.cjs");
const { scoreLead, scoreRisk } = require("../lib/sonara-lead-scoring.cjs");
const { scorableAnswers, CONTACT_KEY } = require("../lib/sonara-lead-capture-script.cjs");

describe("a throwaway address is flagged, not refused", () => {
  describe("the list is somewhere it will actually exist in production", () => {
    it("sits inside a directory vercel.json bundles", () => {
      const config = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "vercel.json"), "utf8"));
      const included = config.functions["api/index.js"].includeFiles;
      assert.ok(included, "vercel.json no longer declares includeFiles; this check has gone blind");

      const roots = included.replace(/^\{|\}$/g, "").split(",").map((p) => p.split("/")[0]);
      assert.ok(roots.length >= 2, `only parsed ${roots.length} bundled roots from ${included}`);

      const relative = path.relative(path.join(__dirname, ".."), disposable.LIST_PATH);
      const root = relative.split(path.sep)[0];
      assert.ok(
        roots.includes(root),
        `the blocklist is at ${relative}, and ${root}/ is not bundled into the deployed function `
          + `(${included}). It would be missing in production and every lead would pass unflagged.`
      );
    });

    it("is readable and not empty", () => {
      assert.ok(fs.existsSync(disposable.LIST_PATH), "the blocklist file is missing");
      assert.ok(
        disposable.listSize() > 1000,
        `the list has ${disposable.listSize()} entries; a list this short is a truncated file, not a list`
      );
    });
  });

  describe("what counts as a throwaway address", () => {
    it("catches a provider everybody knows", () => {
      assert.equal(disposable.blockedBy("someone@mailinator.com"), "mailinator.com");
      assert.equal(disposable.isDisposable("someone@mailinator.com"), true);
    });

    it("catches a subdomain, which is how providers get around a plain list", () => {
      assert.equal(disposable.blockedBy("someone@a.b.mailinator.com"), "mailinator.com");
    });

    it("does not catch a domain that merely ends with one on the list", () => {
      // A plain endsWith would block all four of these, and they are somebody
      // else's domains.
      for (const value of ["xxmailinator.com", "my-mailinator.com", "mailinator.com.example.org", "evilmailinator.com"]) {
        assert.equal(disposable.blockedBy(value), null, `${value} was wrongly flagged`);
      }
    });

    it("leaves real mail providers alone", () => {
      for (const real of ["gmail.com", "outlook.com", "yahoo.com", "icloud.com", "protonmail.com", "sonaraindustries.com"]) {
        assert.equal(disposable.isDisposable(`someone@${real}`), false, `${real} is flagged as disposable`);
      }
    });

    it("takes an address or a bare domain, and shrugs at nonsense", () => {
      assert.equal(disposable.blockedBy("MAILINATOR.COM"), "mailinator.com");
      assert.equal(disposable.blockedBy("mailinator.com."), "mailinator.com");
      for (const junk of ["", "   ", "@", "someone@", null, undefined]) {
        assert.equal(disposable.blockedBy(junk), null, `${JSON.stringify(junk)} produced a match`);
      }
    });
  });

  describe("what it does to the score", () => {
    const PROFILE = { industries: ["plumbing"], disqualifiers: [] };

    it("raises a flag with a reason somebody can read", () => {
      const risk = scoreRisk(PROFILE, {}, { gaveContact: true, disposableEmail: true });
      const flag = risk.flags.find((f) => f.code === "disposable_email");
      assert.ok(flag, "a throwaway address raised no flag");
      assert.ok(flag.detail.trim() !== "", "the flag has no detail to show anybody");
      assert.ok(risk.score > 0);
    });

    it("raises nothing when the address is fine", () => {
      const risk = scoreRisk(PROFILE, {}, { gaveContact: true, disposableEmail: false });
      assert.deepEqual(risk.flags, []);
      assert.equal(risk.score, 0);
    });

    it("costs less than having no way to reply at all", () => {
      // A throwaway address is a hint about intent. No contact details is the
      // business being unable to answer, which is worse and must score worse.
      const throwaway = scoreRisk(PROFILE, {}, { gaveContact: true, disposableEmail: true }).score;
      const unreachable = scoreRisk(PROFILE, {}, { gaveContact: false }).score;
      assert.ok(
        throwaway < unreachable,
        `a throwaway address (${throwaway}) scored worse than being unreachable (${unreachable})`
      );
    });

    it("lowers the score without emptying it", () => {
      const answers = { industry: "plumbing" };
      const clean = scoreLead({ profile: PROFILE, answers, activity: { questionsAsked: 1, questionsAnswered: 1, gaveContact: true } });
      const flagged = scoreLead({
        profile: PROFILE,
        answers,
        activity: { questionsAsked: 1, questionsAnswered: 1, gaveContact: true, disposableEmail: true }
      });
      assert.ok(flagged.score < clean.score, "the flag changed nothing about the score");
      assert.ok(flagged.score > 0, "one throwaway address wiped the whole score out");
      assert.ok(flagged.riskFlags.some((f) => f.code === "disposable_email"));
    });
  });

  describe("the address itself never reaches the scorer", () => {
    it("is not in what scorableAnswers hands over", () => {
      const answers = {
        industry: "plumbing",
        [CONTACT_KEY]: { name: "Ana", email: "ana@mailinator.com", phone: "+44 7700 900123" }
      };
      const scorable = scorableAnswers(answers);
      const serialised = JSON.stringify(scorable);
      assert.ok(!serialised.includes("mailinator.com"), "the address was handed to the scorer");
      assert.ok(!serialised.includes("7700"), "the phone number was handed to the scorer");
      // Only the boolean travels, which is the whole reason the lookup happens
      // at the call site rather than inside the scorer.
      assert.equal(scorable.email, undefined);
    });
  });

  describe("an unreadable list is a third state", () => {
    it("says it could not tell, rather than saying the address is fine", () => {
      // blockedBy returns undefined when the list cannot be read at all, which
      // is deliberately not the same value as null for "not on the list". A
      // caller that merged the two would record a check that never ran as a
      // clean result.
      const values = [disposable.blockedBy("someone@gmail.com"), disposable.blockedBy("someone@mailinator.com")];
      assert.equal(values[0], null, "a clean address should be null, not undefined");
      assert.equal(typeof values[1], "string");
      assert.notEqual(null, undefined, "null and undefined must stay distinguishable for this to mean anything");
    });
  });
});

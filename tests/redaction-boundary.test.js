"use strict";

// The redaction boundary, and whether everything actually goes through it.
//
// lib/sonara-redaction.cjs is named like a boundary. A boundary is only a
// boundary if nothing gets around it, and nothing in this codebase forced that
// -- redactSensitiveText lived in server.js, was applied at four call sites, and
// every other place text could reach an operator or a customer simply did not
// call it.
//
// Two halves here, and the second is the one with teeth.
//
// The patterns: every one gets a string it must redact and a benign string it
// must leave alone. A redactor that replaces everything passes the first kind of
// test and destroys every error message in the product, and only the second
// failure is obvious from the outside.
//
// The sinks: a scan of the runtime tree for the places text leaves this process
// -- console calls, and error text put into a response. Each has to go through
// the boundary or be listed below with a reason. That list is the honest part;
// without it this check would be a comment.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { PATTERNS, redactSensitiveText, redactError } = require("../lib/sonara-redaction.cjs");

const root = path.join(__dirname, "..");

// Real shapes, with the secret part invented. A Supabase service-role key is a
// JWT; a Stripe restricted key is rk_; a Resend key is re_.
const CASES = {
  supabase_or_jwt_key: {
    redacts: "apikey eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.7Hk2QpLm3nRt",
    leaves: "The customer said their invoice eyJ was wrong"
  },
  authorization_header: {
    redacts: 'Authorization: Bearer abcdef1234567890abcdef',
    leaves: "Authorization is handled server-side"
  },
  url_query_credential: {
    redacts: "https://project.supabase.co/rest/v1/bookings?apikey=abcdef123456&select=id",
    leaves: "https://sonaraindustries.com/pricing?plan=starter"
  },
  stripe_key: {
    redacts: "sk_live_51ABCdefGHIjklMNOpqr",
    leaves: "The sk_ prefix is what Stripe uses"
  },
  resend_key: {
    redacts: "re_AbCdEfGhIjKlMnOpQrSt",
    leaves: "re_ is the prefix, and re: is a reply"
  },
  postgres_connection_string: {
    redacts: "postgresql://postgres:hunter2@db.project.supabase.co:5432/postgres",
    leaves: "We use PostgreSQL through PostgREST"
  },
  assigned_secret: {
    redacts: "password: hunter2correct",
    leaves: "Please reset your password from the account page"
  },
  card_like_number: {
    redacts: "4242424242424242",
    leaves: "Reference ID 12345 and order 987654"
  }
};

describe("the redaction boundary", () => {
  describe("patterns", () => {
    it("has a case for every pattern", () => {
      // Adding a pattern without a case leaves it unproven, and an unproven
      // pattern in a security path is the one somebody assumes works.
      const untested = PATTERNS.map((entry) => entry.name).filter((name) => !CASES[name]);
      assert.deepEqual(untested, [], "these redaction patterns have no test case");
    });

    for (const entry of PATTERNS) {
      const testCase = CASES[entry.name];
      it(`${entry.name} redacts the secret`, () => {
        const output = redactSensitiveText(testCase.redacts);
        assert.notEqual(output, testCase.redacts, `${entry.name} left its own example untouched`);
        assert.match(output, /\[redacted/, "a redaction has to be visible, so the reader knows something was removed");
      });

      it(`${entry.name} leaves ordinary text alone`, () => {
        assert.equal(
          redactSensitiveText(testCase.leaves),
          testCase.leaves,
          `${entry.name} rewrote ordinary text; a redactor that eats everything makes every error message useless`
        );
      });
    }

    it("survives values that are not strings", () => {
      for (const value of [null, undefined, 0, false, {}, []]) {
        assert.doesNotThrow(() => redactSensitiveText(value));
      }
    });

    it("keeps the useful part of an error", () => {
      const error = new Error("Insert failed for bookings");
      const output = redactError(error);
      assert.match(output, /Insert failed for bookings/, "redaction must not throw away what the error said");
    });

    it("scrubs a stack, which is where the failing URL lives", () => {
      const error = new Error("request failed");
      error.stack = "Error: request failed\n  at fetch (https://p.supabase.co/rest/v1/x?apikey=abcdef123456)";
      const output = redactError(error);
      assert.doesNotMatch(output, /apikey=abcdef123456/);
      assert.match(output, /request failed/);
    });
  });

  describe("output sinks", () => {
    // Every runtime file, so a sink added in a new module is seen.
    function runtimeFiles() {
      const found = [];
      const walk = (directory) => {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
          const full = path.join(directory, entry.name);
          if (entry.isDirectory()) {
            if (entry.name === "node_modules" || entry.name === ".git") continue;
            walk(full);
          } else if (/\.(cjs|js)$/.test(entry.name)) {
            found.push(full);
          }
        }
      };
      for (const directory of ["lib", "routes", "api"]) {
        const full = path.join(root, directory);
        if (fs.existsSync(full)) walk(full);
      }
      found.push(path.join(root, "server.js"));
      return found;
    }

    function withoutComments(source) {
      return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
    }

    // Sinks that legitimately print no caller-supplied or provider-supplied
    // text. Each needs a reason, because "it is fine" is what every one of these
    // looks like right up until it is not.
    const ALLOWED = new Map([
      [
        "lib/sonara-redaction.cjs",
        "the boundary itself; it cannot route through itself"
      ]
    ]);

    it("routes every console call that prints an error through the boundary", () => {
      const offenders = [];
      for (const file of runtimeFiles()) {
        const relative = path.relative(root, file).split(path.sep).join("/");
        if (ALLOWED.has(relative)) continue;
        const source = withoutComments(fs.readFileSync(file, "utf8"));
        for (const match of source.matchAll(/console\.(?:log|warn|error|info|debug)\(([^;]*)/g)) {
          const call = match[1];
          // A console call that mentions an error, a stack, or a caught value is
          // the one that can carry a credential.
          if (!/\b(error|err|stack|exception|reason|detail|response|body)\b/i.test(call)) continue;
          if (/redactError|redactSensitiveText/.test(call)) continue;
          offenders.push(`${relative}: console call prints error-shaped text without redaction`);
        }
      }
      assert.deepEqual(
        offenders,
        [],
        "these print caught values straight to the log; a provider error carries the URL it failed on, and that URL carries the key"
      );
    });

    it("finds the console calls it is meant to be watching", () => {
      // This suite passes trivially if the scan stops matching. There is at
      // least one deliberate console.error in the tree; if it disappears,
      // somebody should confirm that rather than inherit a green check over
      // nothing.
      let consoleCalls = 0;
      for (const file of runtimeFiles()) {
        const source = withoutComments(fs.readFileSync(file, "utf8"));
        consoleCalls += (source.match(/console\.(?:log|warn|error|info|debug)\(/g) || []).length;
      }
      assert.ok(consoleCalls > 0, "no console calls were found at all, so the scan above proved nothing");
    });

    it("keeps the boundary in one file", () => {
      // The original was a private function in server.js. If a second copy
      // appears, the two drift and the newer secret shape is only in one.
      const copies = [];
      for (const file of runtimeFiles()) {
        const relative = path.relative(root, file).split(path.sep).join("/");
        if (relative === "lib/sonara-redaction.cjs") continue;
        const source = fs.readFileSync(file, "utf8");
        if (/function\s+redactSensitiveText\s*\(/.test(source)) copies.push(relative);
      }
      assert.deepEqual(copies, [], "redactSensitiveText is defined outside lib/sonara-redaction.cjs; two redactors drift");
    });
  });
});

"use strict";

// `scripts/verify-member-read-access.mjs` is the evidence for switching
// user-facing reads from the service-role key to the caller's own JWT, so that
// row level security becomes a real second line of defence rather than
// something bypassed on every request.
//
// The danger it exists to catch is stated in its own header: if a table's
// policy does not match, a user-scoped read returns **zero rows and HTTP 200**.
// Nothing errors. The workspace renders empty, and it looks like the customer
// has no data rather than like a bug.
//
// It compares, per table, what service_role sees against what that
// organization's own member sees, and grades each table. **That grade decides
// whether somebody switches a read that will blank a page.**
//
// It could not be tested. The script has top-level `await` and `process.exit`,
// and cannot run at all without a real database -- so the one function in it
// that decides anything was never exercised. It is now
// `scripts/member-read-verdict.cjs`, and this is what exercises it.
//
// The bug it had, found by writing this file:
//
//   PostgREST reports the count in `Content-Range`, parsed as
//   `Number(range.split("/")[1])`, and a missing or malformed header becomes
//   `null`. Comparing counts with `===` had no case for that:
//
//     asService.count === 0            ->  null === 0     ->  false
//     asUser.count === 0               ->  null === 0     ->  false
//     asUser.count !== asService.count ->  null !== null  ->  false
//     -> { state: "ready", why: "member sees all null rows" }
//
//   and the script prints that table under "Safe to add to the user-scoped read
//   list, on this evidence". Two counts it could not read, reported as proof,
//   by the tool whose whole job is to stop a page silently blanking.

const assert = require("node:assert/strict");
const { verdict, counted, STATES } = require("../scripts/member-read-verdict.cjs");

const read = (count) => ({ ok: true, status: 200, count });
const failed = (status) => ({ ok: false, status, count: null });

describe("two counts nobody read are not a match", () => {
  it("has the states the script prints", () => {
    assert.deepEqual([...STATES].sort(), ["blocked", "no-evidence", "partial", "ready", "unknown"].sort());
  });

  describe("a count that was never read", () => {
    it("is not proof that the member sees everything", () => {
      // The motivating bug, reproduced as its own case.
      const answer = verdict({ asService: read(null), asUser: read(null) });
      assert.notEqual(answer.state, "ready", "two unread counts were reported as proof the member sees everything");
      assert.equal(answer.state, "unknown");
      assert.match(answer.why, /no usable row count/);
      assert.match(answer.why, /Content-Range/, "the reason must say where the count comes from, so somebody can check the header");
    });

    it("is unknown whichever side of the comparison it is on", () => {
      for (const [label, row] of [
        ["service-role", { asService: read(null), asUser: read(5) }],
        ["member", { asService: read(5), asUser: read(null) }],
        ["both", { asService: read(null), asUser: read(null) }]
      ]) {
        const answer = verdict(row);
        assert.equal(answer.state, "unknown", `an unread ${label} count was graded ${answer.state}`);
      }
    });

    it("names which side could not be read", () => {
      assert.match(verdict({ asService: read(null), asUser: read(5) }).why, /service-role read returned no usable/);
      assert.match(verdict({ asService: read(5), asUser: read(null) }).why, /member read returned no usable/);
      assert.match(verdict({ asService: read(null), asUser: read(null) }).why, /service-role and member read returned no usable/);
    });

    it("treats anything that is not a whole count as unread", () => {
      // Number(undefined) is NaN, Number("") is 0, Number(null) is 0. The
      // parser turns non-finite into null, but the guard should not depend on
      // the caller having done that correctly.
      // Labelled with String(), not JSON.stringify(): `JSON.stringify(NaN)` is
      // the string "null", so a NaN failure here would name the wrong value and
      // send the next person looking at the wrong case.
      for (const value of [null, undefined, NaN, -1, 1.5, "5", true, {}]) {
        assert.equal(counted(value), false, `${String(value)} was treated as a real count`);
      }
      for (const value of [0, 1, 5, 1000]) {
        assert.equal(counted(value), true, `${value} was not treated as a real count`);
      }
    });
  });

  describe("the grades that decide whether a read may be switched", () => {
    it("calls it ready only when both sides read the same non-zero number", () => {
      const answer = verdict({ asService: read(7), asUser: read(7) });
      assert.equal(answer.state, "ready");
      assert.match(answer.why, /all 7 rows/);
    });

    it("calls it blocked when the member sees nothing and the service role sees rows", () => {
      // The exact failure the script exists for: switching this read blanks the
      // page and nothing errors.
      const answer = verdict({ asService: read(7), asUser: read(0) });
      assert.equal(answer.state, "blocked");
      assert.match(answer.why, /would blank the page/);
    });

    it("calls it partial when the member sees some of them", () => {
      const answer = verdict({ asService: read(7), asUser: read(3) });
      assert.equal(answer.state, "partial");
      assert.match(answer.why, /3 of 7/);
    });

    it("calls an empty table no-evidence rather than ready", () => {
      // Zero equals zero, and proves nothing. Grading this "ready" would put a
      // table on the safe list on the strength of it being empty today.
      const answer = verdict({ asService: read(0), asUser: read(0) });
      assert.equal(answer.state, "no-evidence");
      assert.match(answer.why, /proves nothing/);
    });

    it("separates a failed member read from a policy that returns nothing", () => {
      // A 403 says the role lacks a grant; 200-with-zero says the policy does
      // not match. Different fixes, and the message names which.
      const refused = verdict({ asService: read(7), asUser: failed(403) });
      assert.equal(refused.state, "blocked");
      assert.match(refused.why, /lacks a grant, not just a policy/);

      const empty = verdict({ asService: read(7), asUser: read(0) });
      assert.equal(empty.state, "blocked");
      assert.doesNotMatch(empty.why, /lacks a grant/);
    });

    it("does not blame the member when the service-role read is the one that failed", () => {
      const answer = verdict({ asService: failed(404), asUser: read(0) });
      assert.equal(answer.state, "unknown");
      assert.match(answer.why, /the table may not exist/);
    });

    it("always returns a state the script counts", () => {
      // The summary line counts five states and the script exits 2 on anything
      // else. A grade outside that set would make the numbers add up to less
      // than the list printed beneath them.
      const counts = [null, undefined, 0, 1, 7];
      const oks = [true, false];
      let checked = 0;
      for (const serviceOk of oks) {
        for (const userOk of oks) {
          for (const serviceCount of counts) {
            for (const userCount of counts) {
              const answer = verdict({
                asService: { ok: serviceOk, status: serviceOk ? 200 : 500, count: serviceCount },
                asUser: { ok: userOk, status: userOk ? 200 : 403, count: userCount }
              });
              assert.ok(STATES.includes(answer.state), `state ${answer.state} is not one the script counts`);
              assert.ok(answer.why && answer.why.length > 10, `state ${answer.state} came back with no reason`);
              checked += 1;
            }
          }
        }
      }
      assert.equal(checked, 100, `only ${checked} combinations were graded; this check has gone blind`);
    });
  });

  describe("the script and the module do not drift apart", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const script = fs.readFileSync(path.join(__dirname, "..", "scripts", "verify-member-read-access.mjs"), "utf8");

    it("has the script importing the decision rather than keeping a copy", () => {
      assert.match(script, /require\("\.\/member-read-verdict\.cjs"\)/, "the script no longer imports the module");
      assert.doesNotMatch(script, /function verdict\s*\(/, "the script has grown its own copy of verdict again");
    });

    it("keeps the script's own guard against a state it cannot print", () => {
      assert.match(script, /STATES\.includes\(row\.state\)/, "the script no longer checks that every table landed in a counted state");
    });
  });
});

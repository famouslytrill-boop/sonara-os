"use strict";

// `pnpm audit` exits non-zero for two entirely different things: it found an
// advisory, or it could not reach npm's advisory endpoint to ask. The CI step
// could not tell them apart, so on 3 September 2026 a network timeout was
// reported as a security finding — four job runs across two commits, one of
// which touched only markdown, each carrying
//
//     { "error": { "code": 23, "message": "The operation was aborted due to timeout" } }
//
// while https://registry.npmjs.org/ itself answered 200 in under two seconds.
// The advisory bulk endpoint alone was unresponsive, reproducibly, from
// GitHub's runners and from an unrelated network.
//
// This is the recurring defect running backwards: a signal reporting **failure**
// without being true. That direction is the more corrosive one. A check that
// cries wolf teaches people to re-run it until it goes green and then stop
// reading it, which is how a real advisory eventually gets waved through by
// somebody who has learned the red means nothing.
//
// `scripts/audit-result-is-unusable.mjs` separates the two. Its rule is that
// **anything which is not a valid audit result means we could not ask** — and
// that rule exists because the first version of it, written inline in the
// workflow, got two of these five cases wrong. An empty file and an
// unparseable one were both classified as real results, so a crashed audit
// would have been reported as a security finding by the very code written to
// stop a timeout being reported as one. The same shape, one case over.
//
// The caller still fails on both. An audit that did not happen must never be a
// green tick. What changes is that it says which of the two it was.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const SCRIPT = path.join(__dirname, "..", "scripts", "audit-result-is-unusable.mjs");
const WORKFLOW = path.join(__dirname, "..", ".github", "workflows", "dependency-scan.yml");

/** Exit 0 means "could not ask". Exit 1 means "a real audit result". */
function classify(contents) {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "audit-")), "pnpm-audit.json");
  if (contents !== null) fs.writeFileSync(file, contents);
  const run = spawnSync(process.execPath, [SCRIPT, file], { encoding: "utf8" });
  assert.ok(run.status === 0 || run.status === 1, `unexpected exit ${run.status}: ${run.stderr}`);
  return run.status === 0 ? "could-not-ask" : "real-result";
}

describe("an audit that did not happen is not a finding", () => {
  describe("the harness is capable of failing", () => {
    it("is running the script it means to", () => {
      assert.ok(fs.existsSync(SCRIPT), "scripts/audit-result-is-unusable.mjs is gone");
      // If both answers were the same the table below would prove nothing.
      assert.notEqual(
        classify('{"error":{"code":23}}'),
        classify('{"advisories":{},"metadata":{}}'),
        "the classifier gives the same answer to a transport error and a clean audit; it is deciding nothing"
      );
    });
  });

  describe("what counts as having asked", () => {
    const cases = [
      ['{ "error": { "code": 23, "message": "The operation was aborted due to timeout" } }', "could-not-ask", "the real timeout that caused this"],
      ['{ "error": { "code": 1, "message": "something else entirely" } }', "could-not-ask", "any error key, not just code 23"],
      ["", "could-not-ask", "an empty file — pnpm wrote nothing"],
      ["   \n  ", "could-not-ask", "whitespace only"],
      ["not json at all", "could-not-ask", "output that cannot be parsed"],
      [null, "could-not-ask", "no file at all"],
      ['{"advisories":{"1234":{"severity":"high","module_name":"lodash"}},"metadata":{"vulnerabilities":{"high":1}}}', "real-result", "a genuine advisory"],
      ['{"advisories":{},"metadata":{"vulnerabilities":{"moderate":0}}}', "real-result", "a clean audit"]
    ];

    for (const [contents, expected, why] of cases) {
      it(`treats ${why} as ${expected}`, () => {
        assert.equal(
          classify(contents),
          expected,
          expected === "could-not-ask"
            ? "this would be reported as a security finding, which it is not"
            : "this would be reported as 'we could not ask', hiding a real audit result"
        );
      });
    }
  });

  describe("the workflow still fails either way", () => {
    const yaml = fs.readFileSync(WORKFLOW, "utf8");

    it("does not turn an unreachable audit into a pass", () => {
      const step = yaml.slice(yaml.indexOf("name: Audit root dependencies"));
      const body = step.slice(0, step.indexOf("- name: Upload dependency audit diagnostics"));
      assert.match(body, /exit \$status/, "the audit step no longer propagates pnpm's exit code");
      assert.doesNotMatch(
        body,
        /exit 0\b/,
        "the audit step exits 0 somewhere. An audit that could not run must not be a green tick -- the point of " +
          "telling the two apart is the message, never the outcome"
      );
    });

    it("says which of the two it was", () => {
      assert.match(
        yaml,
        /NOTHING WAS AUDITED/,
        "the distinct message for an unreachable audit is gone, so a timeout reads as a vulnerability report again"
      );
    });

    it("retries before giving up, since a transient failure is worth asking twice", () => {
      assert.match(yaml, /for attempt in 1 2 3/, "the audit no longer retries a transport failure");
    });

    it("still audits at the same level", () => {
      // The one thing this change must not have done.
      assert.match(
        yaml,
        /pnpm audit --audit-level moderate --json/,
        "the audit level changed. Telling a timeout from a finding must not quietly relax what counts as a finding"
      );
    });
  });
});

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

  describe("every audit in the repository goes through it", () => {
    // The reason this section is derived rather than a list of three files:
    // the first version of this fix patched ONE of three call sites, which is
    // the same shape as the migration repair that fixed the tables that were
    // absent and ignored the ones that were present. A fourth workflow that
    // calls `pnpm audit` bare must fail here rather than quietly reintroducing
    // the defect.
    const dir = path.join(__dirname, "..", ".github", "workflows");
    const workflows = fs.readdirSync(dir).filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"));

    /** Lines that invoke pnpm audit, ignoring prose about it. */
    function invocations() {
      const found = [];
      for (const name of workflows) {
        const text = fs.readFileSync(path.join(dir, name), "utf8");
        text.split("\n").forEach((line, index) => {
          const code = line.replace(/#.*$/, "");
          if (/\bpnpm\s+audit\b/.test(code)) found.push({ name, line: index + 1, code: code.trim() });
          if (/audit-dependencies\.mjs/.test(code)) found.push({ name, line: index + 1, code: code.trim(), viaScript: true });
        });
      }
      return found;
    }

    const calls = invocations();

    it("found the audit steps it is checking", () => {
      assert.ok(workflows.length >= 5, `only ${workflows.length} workflows; this check has gone blind`);
      assert.ok(
        calls.length >= 3,
        `only ${calls.length} audit invocations found across ${workflows.length} workflows; this check has gone blind`
      );
    });

    it("has no workflow calling pnpm audit directly", () => {
      const bare = calls.filter((call) => !call.viaScript);
      assert.deepEqual(
        bare.map((call) => `${call.name}:${call.line}  ${call.code}`),
        [],
        "a workflow invokes pnpm audit directly, so a timeout there is reported as a security finding again. " +
          "Call scripts/audit-dependencies.mjs instead"
      );
    });

    it("covers the production deployment, where a false finding blocks a release", () => {
      assert.ok(
        calls.some((call) => call.name === "controlled-production-deploy.yml" && call.viaScript),
        "the production deployment no longer audits through the script. A network timeout there would block a " +
          "release with a security finding that is not one"
      );
    });

    it("still audits at the same level", () => {
      // The one thing this change must not have done.
      const script = fs.readFileSync(path.join(__dirname, "..", "scripts", "audit-dependencies.mjs"), "utf8");
      assert.match(
        script,
        /const LEVEL = "moderate"/,
        "the audit level changed. Telling a timeout from a finding must not quietly relax what counts as a finding"
      );
    });

    it("bounds the attempt, because pnpm audit hangs rather than failing fast", () => {
      const script = fs.readFileSync(path.join(__dirname, "..", "scripts", "audit-dependencies.mjs"), "utf8");
      assert.match(script, /timeout -k/, "the audit is unbounded again; the observed hang was four minutes");
      assert.match(script, /TIMEOUT_SECONDS = 90/, "the attempt bound is gone or changed without updating this test");
    });

    it("never turns an unreachable audit into a pass", () => {
      const script = fs.readFileSync(path.join(__dirname, "..", "scripts", "audit-dependencies.mjs"), "utf8");
      const branch = script.slice(script.indexOf("if (couldNotAsk(OUTPUT))"));
      assert.match(
        branch.slice(0, 500),
        /process\.exit\(1\)/,
        "an audit that could not run no longer fails. The point of telling the two apart is the message, never " +
          "the outcome"
      );
    });
  });
});

describe("an outage in npm's advisory service does not blind the rest of CI", () => {
  // Until 4 September 2026 `node scripts/audit-dependencies.mjs` was step five
  // of the `sonara-industries` job. npm's advisory service broke at ~22:06 UTC
  // on 3 September, and every run after that aborted there -- so typecheck,
  // lint, the whole test suite, the build, the client-secret scan, the route
  // and database contract checks, the Python coverage floor and all twenty
  // release gates went unrun on every pull request for six hours, while twenty
  // of twenty-three checks read green.
  //
  // Moving it last weakens nothing: it still runs, still fails the job, and the
  // audit level is unchanged. And fail-fast on a genuine advisory is not lost,
  // which was checked rather than assumed -- `dependency-scan.yml` runs the same
  // script in its own parallel jobs, so a real finding still surfaces in about a
  // minute.
  //
  // This is what stops the ordering drifting back without anybody deciding to.
  // Comments stripped before anything is matched. The audit step carries a long
  // comment explaining why it sits where it does, and that comment names
  // `audit-dependencies.mjs`. Matching raw text found the *comment* first --
  // which sits at the tail of the previous step block -- so this reported that
  // `test:docs` ran after the audit and that the audit was called twice. Both
  // were false, and both were this check reading prose as if it were code:
  // shape 7 in `.claude/skills/checks-that-cannot-lie`, hit for the third time
  // in one day. It is worth stating how ordinary the mistake is.
  const workflow = fs
    .readFileSync(path.join(__dirname, "..", ".github", "workflows", "sonara-industries-ci.yml"), "utf8")
    .split("\n")
    .filter((line) => !/^\s*#/.test(line))
    .join("\n");

  // Whole step blocks, not just the lines that open one. A step written as
  // `- name:` carries its command on an indented `run:` underneath, so a filter
  // that kept only step headers would not see `verify:gates` at all -- and a
  // check that cannot see the thing it is ordering is worse than none. That was
  // the first version of this, and it failed saying the job no longer ran
  // verify:gates, which it plainly did.
  const steps = (() => {
    const lines = workflow.split("\n");
    const starts = [];
    lines.forEach((line, index) => {
      if (/^      - /.test(line)) starts.push(index);
    });
    return starts.map((start, position) =>
      lines.slice(start, position + 1 < starts.length ? starts[position + 1] : lines.length).join("\n")
    );
  })();

  it("found the job's steps, so this is not passing on an empty file", () => {
    assert.ok(steps.length >= 12, `only ${steps.length} steps parsed; this check has gone blind`);
  });

  it("runs the audit after the checks it used to abort before", () => {
    const auditAt = steps.findIndex((line) => line.includes("audit-dependencies.mjs"));
    assert.notEqual(auditAt, -1, "the sonara-industries job no longer runs scripts/audit-dependencies.mjs");

    // Named individually rather than "is it last", so the message says which
    // check an earlier audit would take down with it.
    for (const gated of ["pnpm run typecheck", "pnpm run lint", "pnpm run build", "verify:gates", "test:docs"]) {
      const at = steps.findIndex((line) => line.includes(gated));
      assert.notEqual(at, -1, `the sonara-industries job no longer runs ${gated}`);
      assert.ok(
        at < auditAt,
        `${gated} runs after the dependency audit. An outage in npm's advisory service would take it down ` +
          "too, which is what moving the audit to the end of the job was for."
      );
    }
  });

  it("still runs the audit, rather than having quietly dropped it", () => {
    // The move must not become a removal. Nothing here weakens the audit: it is
    // the same script at the same level, and the job still fails on it.
    assert.equal(
      (workflow.match(/audit-dependencies\.mjs/g) || []).length,
      1,
      "the sonara-industries job must call the audit exactly once"
    );
    assert.doesNotMatch(
      workflow,
      /continue-on-error:\s*true[\s\S]{0,200}audit-dependencies/,
      "the audit must still be able to fail the job"
    );
  });
});

describe("the dependency scan enforces its audit after the checks beside it", () => {
  // The same shape as the sonara-industries job, one workflow over.
  // `frontend-dependencies` runs the audit with `continue-on-error`, uploads
  // its diagnostics, and then a separate step turns a failed audit into a
  // failed job. That enforcement step sat before `verify:open-source`,
  // `typecheck` and `build`, so the npm outage stopped those three running here
  // too.
  //
  // Only the abort moved. The audit runs where it always did and its
  // diagnostics still upload, so nothing about auditing changed.
  //
  // `backend-dependencies` is deliberately not covered: it audits pinned Python
  // packages, never reaches npm's advisory service, and stayed green through
  // the whole outage -- checked against its check runs on three heads, not
  // assumed.
  const workflow = fs
    .readFileSync(path.join(__dirname, "..", ".github", "workflows", "dependency-scan.yml"), "utf8")
    .split("\n")
    .filter((line) => !/^\s*#/.test(line))
    .join("\n");

  const steps = (() => {
    const lines = workflow.split("\n");
    const starts = [];
    lines.forEach((line, index) => {
      if (/^      - /.test(line)) starts.push(index);
    });
    return starts.map((start, position) =>
      lines.slice(start, position + 1 < starts.length ? starts[position + 1] : lines.length).join("\n")
    );
  })();

  it("found the workflow's steps, so this is not passing on an empty file", () => {
    assert.ok(steps.length >= 15, `only ${steps.length} steps parsed; this check has gone blind`);
  });

  it("enforces the audit after open-source policy, typecheck and build", () => {
    const enforceAt = steps.findIndex((step) => step.includes("Enforce dependency audit"));
    assert.notEqual(enforceAt, -1, "dependency-scan.yml no longer enforces the root audit");

    for (const gated of ["pnpm run verify:open-source", "pnpm run typecheck", "pnpm run build"]) {
      const at = steps.findIndex((step) => step.includes(gated));
      assert.notEqual(at, -1, `dependency-scan.yml no longer runs ${gated}`);
      assert.ok(
        at < enforceAt,
        `${gated} runs after the audit is enforced, so an npm advisory outage takes it down too.`
      );
    }
  });

  it("still turns a failed audit into a failed job", () => {
    // The move must not become a removal. Same condition, same effect.
    const enforce = steps.find((step) => step.includes("Enforce dependency audit"));
    assert.match(enforce, /if: steps\.root-audit\.outcome == 'failure'/);
    assert.match(enforce, /run: exit 1/);
  });
});



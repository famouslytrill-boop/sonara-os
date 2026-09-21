"use strict";

// The one credential only the owner can supply, and when the deploy says so.
//
// `production-commit-drift.yml` records what this cost, in its own words:
//
//   "every deploy run since 5 August had failed, the newest of them at a single
//    step, an empty STRIPE_RUNTIME_SECRET_KEY"
//
// Six weeks of deployments. The step that noticed was roughly the seventeenth in
// the job, so each attempt paid for dependency install, the audit, the build, the
// whole release test suite, the client-secret scan, lint, route smoke, the
// database and storage contracts, the configuration and route registry, the
// OpenAPI contract, the open-source controls, the project identity check, the
// migration preview and the production environment pull -- to learn one fact that
// was available in the first twenty seconds.
//
// The precondition now resolves and classifies that credential as the first step
// in the job. The synchronization step is unchanged and remains the authority,
// because only validating against the live configured prices can prove a key
// works.
//
// ## These assertions run the real script
//
// The `run:` block is extracted from the workflow and executed. A copy of the
// logic in this file would pass forever after the workflow changed underneath it,
// which is the defect .claude/skills/checks-that-cannot-lie calls measuring a
// different population from the one claimed.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const WORKFLOW_PATH = path.join(root, ".github", "workflows", "controlled-production-deploy.yml");
const WORKFLOW = fs.readFileSync(WORKFLOW_PATH, "utf8");

const PRECONDITION_STEP = "- name: Require protected production credentials";
const SYNC_STEP = "- name: Synchronize verified Stripe runtime secret to Vercel production";

// The step's shell script, lifted out of the YAML by indentation.
//
// No YAML parser: this repository has one production dependency and a test is
// not a reason to add a second. `run: |` opens a literal block, so the script is
// every following line indented past the key, dedented by that amount.
function runScriptOf(stepHeading) {
  const stepAt = WORKFLOW.indexOf(stepHeading);
  assert.ok(stepAt > 0, `${stepHeading} is missing from the workflow`);
  const lines = WORKFLOW.slice(stepAt).split("\n");
  const runIndex = lines.findIndex((line) => /^\s*run: \|\s*$/.test(line));
  assert.ok(runIndex > 0, `${stepHeading} has no literal run block`);
  const runIndent = lines[runIndex].match(/^(\s*)/)[1].length;
  const body = [];
  for (const line of lines.slice(runIndex + 1)) {
    if (line.trim() === "") { body.push(""); continue; }
    const indent = line.match(/^(\s*)/)[1].length;
    if (indent <= runIndent) break;
    body.push(line.slice(runIndent + 2));
  }
  const script = body.join("\n").trimEnd();
  assert.ok(script.length > 200, `${stepHeading}'s run block extracted as only ${script.length} bytes; the extractor has gone blind`);
  return script;
}

const PRECONDITION = runScriptOf(PRECONDITION_STEP);

function bashExecutable() {
  if (process.platform !== "win32") return "bash";
  const candidates = [
    path.join(process.env.ProgramFiles || "C:\\Program Files", "Git", "bin", "bash.exe"),
    path.join(process.env.ProgramW6432 || "C:\\Program Files", "Git", "bin", "bash.exe")
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || "bash";
}

const PRESENT = {
  VERCEL_TOKEN: "token",
  SUPABASE_ACCESS_TOKEN: "token",
  SUPABASE_PROJECT_ID: "project",
  SUPABASE_DB_PASSWORD: "password",
  SUPABASE_SERVICE_ROLE_KEY: "service-role"
};

// A value distinctive enough that finding it anywhere the step writes is
// unambiguous, and long enough not to occur by chance.
//
// Assembled rather than written out, and that is not style. As a literal these
// are shaped exactly like live Stripe keys, and GitHub Push Protection blocked
// the first push of this file with "Stripe API Key ... tests/...:79". It was
// right to: a scanner that reasons about the value cannot know this one is
// invented.
//
// The offered resolution was a URL that marks the secret allowed. Taking it
// would have trained the one protection standing between this repository and a
// real leaked key to be clicked through, in the commit whose subject is a
// credential boundary. So the literal is gone instead. Do not "simplify" these
// back into one string -- the push will be blocked again, and correctly.
const CANARY = ["sk", "live", "LEAKCANARY9z8y7x6w5v4u3t2s1r"].join("_");
const VERIFIER_CANARY = ["rk", "live", "VERIFIERCANARY4q3p2o1n"].join("_");

let workdir;
let scriptPath;

before(() => {
  workdir = fs.mkdtempSync(path.join(os.tmpdir(), "sonara-precondition-"));
  scriptPath = path.join(workdir, "precondition.sh");
  fs.writeFileSync(scriptPath, PRECONDITION);
});

after(() => {
  fs.rmSync(workdir, { recursive: true, force: true });
});

// Run the real step with a given environment. Returns its exit code, its
// combined output, and whatever it wrote to the step summary.
function runPrecondition(env = {}) {
  const summaryName = `summary-${Math.random().toString(36).slice(2)}.md`;
  const summaryPath = path.join(workdir, summaryName);
  fs.writeFileSync(summaryPath, "");
  let status = 0;
  let output = "";
  try {
    // Feed the extracted workflow block over stdin and give Bash a native
    // working directory. Passing a Windows path as a Git Bash script argument
    // is shell-dependent; the workflow itself runs on Ubuntu, while this test
    // must also exercise the real block on Windows.
    output = execFileSync(bashExecutable(), ["-s"], {
      cwd: workdir,
      input: PRECONDITION,
      env: { PATH: process.env.PATH, GITHUB_STEP_SUMMARY: summaryName, ...env },
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"]
    });
  } catch (error) {
    status = typeof error.status === "number" ? error.status : 1;
    output = `${error.stdout || ""}${error.stderr || ""}`;
  }
  const summary = fs.readFileSync(summaryPath, "utf8");
  fs.rmSync(summaryPath, { force: true });
  return { status, output, summary };
}

describe("the credential gate speaks before the chain runs", () => {
  it("is the first step that can fail, ahead of everything it would otherwise waste", () => {
    // The whole point. If this ever moves after the install or the test suite,
    // an unset secret costs a full release chain again.
    const preconditionAt = WORKFLOW.indexOf(PRECONDITION_STEP);
    for (const later of [
      "- name: Install locked dependencies",
      "- name: Audit dependencies",
      "- name: Build release candidate",
      "- name: Run release test suite",
      "- name: Link and preview production database migrations",
      SYNC_STEP,
      "- name: Apply production database migrations",
      "- name: Deploy validated source to Vercel production"
    ]) {
      const laterAt = WORKFLOW.indexOf(later);
      assert.ok(laterAt > 0, `${later} is missing, so ordering cannot be checked`);
      assert.ok(
        preconditionAt < laterAt,
        `the credential precondition must run before "${later}", or an unset secret is paid for with that work`
      );
    }
  });

  it("accepts a live secret key and says where it came from", () => {
    const { status, summary } = runPrecondition({ ...PRESENT, STRIPE_RUNTIME_SECRET_KEY: "sk_live_abc123456" });
    assert.equal(status, 0, "a correctly configured runtime key was rejected");
    assert.match(summary, /Production credentials present/);
    assert.match(summary, /STRIPE_RUNTIME_SECRET_KEY/);
    assert.match(summary, /live_secret/);
  });

  it("still accepts a full live key left under the old variable", () => {
    // The compatibility fallback the synchronization step documents. If this
    // precondition were stricter than that step, this change would have broken
    // a working installation rather than diagnosing a broken one.
    const { status, summary } = runPrecondition({
      ...PRESENT,
      STRIPE_RUNTIME_SECRET_KEY: "",
      STRIPE_VERIFIER_SECRET_KEY: "sk_live_legacyfullkey"
    });
    assert.equal(status, 0, "the documented compatibility fallback was rejected");
    assert.match(summary, /compatibility fallback/);
  });

  it("refuses the empty secret that blocked every deploy for six weeks", () => {
    const { status, output, summary } = runPrecondition({
      ...PRESENT,
      STRIPE_RUNTIME_SECRET_KEY: "",
      STRIPE_VERIFIER_SECRET_KEY: ""
    });
    assert.equal(status, 1, "an unset runtime secret was allowed through");
    assert.match(summary, /Stripe runtime credential not usable/);
    assert.match(summary, /unset/);
    // It has to name the file that tells them what to do, or the diagnosis is
    // just a different way of saying no.
    assert.match(summary, /STRIPE-RUNTIME-KEY-CUTOVER\.md/);
    assert.match(output, /STRIPE-RUNTIME-KEY-CUTOVER\.md/);
    // And it has to say nothing was spent, because the previous behaviour spent
    // a great deal before saying anything.
    assert.match(summary, /Nothing was built, migrated or deployed/);
  });

  it("refuses the read-only verifier and explains why relicensing it is not the fix", () => {
    const { status, summary } = runPrecondition({
      ...PRESENT,
      STRIPE_RUNTIME_SECRET_KEY: "",
      STRIPE_VERIFIER_SECRET_KEY: "rk_live_readonlyverifier"
    });
    assert.equal(status, 1, "a restricted live key was accepted for the runtime");
    assert.match(summary, /restricted_live_verifier/);
    // The specific harm, which is what makes this worth refusing rather than
    // warning about: the price audit passes and every write fails.
    assert.match(summary, /price audit pass while every customer and Checkout Session write fails/);
  });

  it("tells a test-mode key apart from a missing one", () => {
    const { status, summary } = runPrecondition({ ...PRESENT, STRIPE_RUNTIME_SECRET_KEY: "sk_test_abc123" });
    assert.equal(status, 1);
    assert.match(summary, /test_mode_secret/);
    assert.doesNotMatch(summary, /No runtime secret is configured/, "a configured test key was reported as nothing being configured");
  });

  it("names an unrecognised prefix rather than guessing at it", () => {
    const { status, summary } = runPrecondition({ ...PRESENT, STRIPE_RUNTIME_SECRET_KEY: "whsec_thisisnotanapikey" });
    assert.equal(status, 1);
    assert.match(summary, /unrecognised_prefix/);
  });

  it("flags surrounding whitespace without failing on it", () => {
    // A pasted secret often carries a trailing newline. The prefix match
    // tolerates it and only the live validation downstream can say whether
    // Stripe does, so this reports it and defers. Failing here would be
    // stricter than the step it precedes.
    const { status, summary } = runPrecondition({ ...PRESENT, STRIPE_RUNTIME_SECRET_KEY: "sk_live_trailing\n" });
    assert.equal(status, 0, "a key with a trailing newline was rejected earlier than the step that validates it");
    assert.match(summary, /Caution/);
    assert.match(summary, /whitespace/);
    assert.match(summary, /re-paste the secret/);
  });

  it("does not claim whitespace when there is none", () => {
    // Or the assertion above is satisfied by a caution printed unconditionally,
    // which would train the reader to ignore it.
    const { summary } = runPrecondition({ ...PRESENT, STRIPE_RUNTIME_SECRET_KEY: "sk_live_clean" });
    assert.doesNotMatch(summary, /Caution/);
  });

  it("names every missing credential, not just the first", () => {
    // `test -n "$X"` under `set -e` exits with no message at all: five
    // credentials shared one silent failure and the log showed `+ test -n ''`.
    const { status, output, summary } = runPrecondition({
      ...PRESENT,
      SUPABASE_ACCESS_TOKEN: "",
      SUPABASE_DB_PASSWORD: "",
      STRIPE_RUNTIME_SECRET_KEY: "sk_live_fine"
    });
    assert.equal(status, 1);
    for (const name of ["SUPABASE_ACCESS_TOKEN", "SUPABASE_DB_PASSWORD"]) {
      assert.match(summary, new RegExp(name), `${name} was missing and not named`);
      assert.match(output, new RegExp(name), `${name} was missing and not named on stderr`);
    }
    assert.doesNotMatch(summary, /VERCEL_TOKEN/, "a credential that was present was reported missing");
  });

  it("refuses to continue without the service-role key, whatever the check looks like", () => {
    // scripts/verify-agent-development-sync.mjs used to assert this by its
    // spelling -- a literal `test -n "${SUPABASE_SERVICE_ROLE_KEY:-}"`. When the
    // step was rewritten to name each missing credential, that gate failed over
    // a requirement that was still there, so it was made form-independent. This
    // is the assertion that makes that safe: it does not care how the check is
    // written, only that an empty service-role key stops the job.
    const { status, output, summary } = runPrecondition({
      ...PRESENT,
      SUPABASE_SERVICE_ROLE_KEY: "",
      STRIPE_RUNTIME_SECRET_KEY: "sk_live_fine"
    });
    assert.equal(status, 1, "the RLS-bypassing service-role key was not required");
    assert.match(summary, /SUPABASE_SERVICE_ROLE_KEY/);
    assert.match(output, /SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("never writes a key value anywhere, on the passing path or the failing one", () => {
    // The property that matters most. Both a full key and a verifier key are
    // supplied, and neither may appear in the output or the step summary.
    const pass = runPrecondition({
      ...PRESENT,
      STRIPE_RUNTIME_SECRET_KEY: CANARY,
      STRIPE_VERIFIER_SECRET_KEY: VERIFIER_CANARY
    });
    assert.equal(pass.status, 0);
    assert.ok(!pass.output.includes("LEAKCANARY"), "the runtime key value reached the step's output");
    assert.ok(!pass.summary.includes("LEAKCANARY"), "the runtime key value reached the step summary");
    assert.ok(!pass.summary.includes("VERIFIERCANARY"), "the verifier key value reached the step summary");

    const fail = runPrecondition({
      ...PRESENT,
      STRIPE_RUNTIME_SECRET_KEY: VERIFIER_CANARY,
      STRIPE_VERIFIER_SECRET_KEY: ""
    });
    assert.equal(fail.status, 1);
    assert.ok(!fail.output.includes("VERIFIERCANARY"), "a rejected key's value reached the step's output");
    assert.ok(!fail.summary.includes("VERIFIERCANARY"), "a rejected key's value reached the step summary");
  });

  it("holds the same accept rule as the step it precedes, or one of them is wrong", () => {
    // Two gates on one credential must agree. If this precondition accepted
    // something the synchronization step rejects, a deploy would still die
    // late; if it rejected something that step accepts, a working installation
    // would break. Both are asserted to key on the same prefix and the same
    // fallback order.
    const syncBlock = WORKFLOW.slice(
      WORKFLOW.indexOf(SYNC_STEP),
      WORKFLOW.indexOf("- name: Record pre-migration rollback checkpoint")
    );
    assert.ok(syncBlock.length > 200, "the synchronization block extracted as almost nothing");

    const fallback = /STRIPE_RUNTIME_SECRET_KEY:-\$\{STRIPE_VERIFIER_SECRET_KEY:-\}/;
    assert.match(syncBlock, fallback, "the synchronization step's fallback order changed");
    assert.match(PRECONDITION, fallback, "the precondition's fallback order no longer matches the synchronization step's");

    assert.match(syncBlock, /sk_live_\*/, "the synchronization step no longer keys on sk_live_");
    assert.match(PRECONDITION, /sk_live_\*/, "the precondition no longer keys on sk_live_");

    // Whatever shape name the accept branch uses, only the sk_live_ arm may
    // produce it.
    //
    // The first version of this assertion was `doesNotMatch(/rk_live_\*\)\s*;;/)`
    // -- it looked for an empty fallthrough arm. Relabelling the restricted arm
    // to the accepted shape left it green while the boundary was gone, which is
    // shape 6 in .claude/skills/checks-that-cannot-lie: a check too weak to
    // catch the bug it was written for. Two other assertions caught that
    // weakening; the one named for it did not, so it was rewritten to read the
    // case arms instead of guessing their form.
    const guard = PRECONDITION.match(/if \[ "\$runtime_shape" != "([a-z_]+)" \]/);
    assert.ok(guard, "the precondition no longer guards on a single accepted shape name");
    const accepted = guard[1];

    const arms = [...PRECONDITION.matchAll(/^\s*([a-z_*"]+)\)\s*runtime_shape="([a-z_]+)"/gm)]
      .map(([, pattern, shape]) => ({ pattern, shape }));
    assert.ok(arms.length >= 5, `only ${arms.length} shape arms found; the extractor has gone blind`);

    const armsProducingAccepted = arms.filter((arm) => arm.shape === accepted).map((arm) => arm.pattern);
    assert.deepEqual(
      armsProducingAccepted,
      ["sk_live_*"],
      `only a full live secret key may classify as "${accepted}"; these arms also do: ${armsProducingAccepted.join(", ")}`
    );
  });

  it("does not leak a key through GITHUB_ENV or a trace", () => {
    assert.doesNotMatch(PRECONDITION, /GITHUB_ENV/, "the precondition writes to GITHUB_ENV, which persists across steps");
    assert.doesNotMatch(PRECONDITION, /set -x/, "the precondition enables shell tracing, which prints expanded values");
    // The variable holding the key is cleared once its shape is known.
    assert.match(PRECONDITION, /unset runtime_key/, "the precondition leaves the key in a shell variable after classifying it");
  });
});

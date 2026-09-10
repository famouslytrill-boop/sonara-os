"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const WORKFLOW_PATH = path.join(root, ".github", "workflows", "controlled-production-deploy.yml");
const WORKFLOW = fs.readFileSync(WORKFLOW_PATH, "utf8");

// The deploy's failure summary told a reader that production's schema had been
// rewritten, on seven runs where it had not.
//
// It decided by asking whether `rollback-checkpoint.txt` existed. That file is
// written BEFORE the push, unconditionally, so its presence says a checkpoint
// was taken and nothing whatever about whether a migration applied. Every run
// that reached the checkpoint step printed "Schema changes were already applied
// to production", true or not.
//
// On 9 September 2026 that message was read from a run log and believed. It went
// into a commit message, a sprint-log entry, a pull request body, a comment in
// the workflow itself, and two statements to the owner -- all asserting that
// seven failed deployments had moved production's schema forward. They had not.
// The migration set at the deployed commit and at the tip of main were
// byte-identical, so each push was a no-op against a database already at 115 of
// 115.
//
// That is the defect CLAUDE.md names, in the place it does the most damage: a
// message people READ to decide whether to perform a rollback. These assertions
// hold the shape that replaced it.
describe("the rollback summary says what actually happened", () => {
  it("reads a workflow with the relevant steps in it, so none of this passes on an empty file", () => {
    assert.ok(WORKFLOW.length > 2000, `the deploy workflow is only ${WORKFLOW.length} bytes; this check has gone blind`);
    assert.match(
      WORKFLOW,
      /- name: Apply production database migrations/,
      "the migration apply step is missing, so there is nothing to assert about its effect"
    );
    assert.match(
      WORKFLOW,
      /Deployment failed -- rollback may be required/,
      "the failure summary is missing, so this check is asserting about nothing"
    );
  });

  it("decides from the database, by comparing schema dumps either side of the push", () => {
    assert.match(
      WORKFLOW,
      /cmp -s pre-migration-schema\.sql post-migration-schema\.sql/,
      "whether a migration applied must be derived by comparing the schema before and after, not inferred from a file's existence"
    );
  });

  it("does not decide it by parsing what the Supabase CLI printed", () => {
    // A parser keyed to vendor prose fails green when the vendor rewords it,
    // which is the same class of defect one layer along.
    assert.doesNotMatch(
      WORKFLOW,
      /Remote database is up to date/,
      "the effect of the push must not be read out of the CLI's wording; a reworded message would silently stop matching"
    );
  });

  it("refuses to read an empty or missing dump as 'no change'", () => {
    assert.match(
      WORKFLOW,
      /test -s pre-migration-schema\.sql/,
      "an absent pre-migration dump would make cmp report identity, which is a comparison passing by measuring nothing"
    );
    assert.match(WORKFLOW, /test -s post-migration-schema\.sql/);
  });

  it("no longer claims a schema change merely because a checkpoint file exists", () => {
    // The exact defect. The checkpoint is written before the push, so keying
    // the claim to it asserts something never checked.
    const summary = WORKFLOW.slice(WORKFLOW.indexOf("Deployment failed -- rollback may be required"));
    assert.ok(summary.length > 200, "the failure summary body could not be isolated");
    assert.doesNotMatch(
      summary,
      /if \[ -f rollback-checkpoint\.txt \]; then\s*\n\s*echo "Schema changes were already applied/,
      "the summary must not assert a schema change from the checkpoint file alone -- that file is written before the push"
    );
  });

  it("reports the case that was missing: a checkpoint taken and nothing applied", () => {
    const summary = WORKFLOW.slice(WORKFLOW.indexOf("Deployment failed -- rollback may be required"));
    assert.match(
      summary,
      /schema_changed=no/,
      "the summary must distinguish a push that applied nothing from one that rewrote the schema"
    );
    assert.match(
      summary,
      /No database rollback is needed/,
      "when nothing was applied the summary must say so plainly, or a reader performs a rollback that has nothing to undo"
    );
  });

  it("says it could not tell, rather than guessing, when the marker is absent", () => {
    // Three states, not two. A run that failed at the apply step itself has a
    // checkpoint and no marker, and neither "applied" nor "not applied" is
    // known -- saying either would be the original bug with a new default.
    const summary = WORKFLOW.slice(WORKFLOW.indexOf("Deployment failed -- rollback may be required"));
    assert.match(
      summary,
      /was NOT determined/,
      "with no marker the summary must announce that it does not know, rather than defaulting to one answer"
    );
  });

  it("keeps the evidence, so the claim can be checked after the run", () => {
    assert.match(
      WORKFLOW,
      /^\s+migration-effect\.txt$/m,
      "the marker must be uploaded with the failure diagnostics, or the summary's claim cannot be verified later"
    );
  });
});

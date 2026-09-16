"use strict";

// Batch 12 of the screenshot intake, checked against the things a screenshot
// cannot tell you.
//
// Seven batches arrived across one hold: 68 images, eight files and a pasted
// research block. Ten repositories survived verification, and the reason this
// test exists rather than a paragraph in a document is that three of the ten
// were *described* as something they are not, and one would have been recorded
// wrongly from the first line of its own licence file.
//
// The assertions below are not general good practice. Each one is a mistake
// this repository has either made or came within one commit of making.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const batch12 = require("../lib/sonara-screenshot-tool-radar-batch12.cjs");

const readiness = batch12.getScreenshotToolReadinessBatch12();
const records = batch12.getPublicScreenshotToolCatalogBatch12();
const refusals = batch12.getConductRefusalsBatch12();
const confirmations = batch12.getConfirmedExistingRecordsBatch12();

describe("a screenshot is not a licence", () => {
  it("has records to check", () => {
    // Guards everything below. All of it passes over an empty catalog.
    assert.ok(records.length >= 10, `only ${records.length} records; this check has gone blind`);
    assert.ok(refusals.length >= 5, `only ${refusals.length} conduct refusals recorded`);
    assert.ok(confirmations.length >= 4, `only ${confirmations.length} deduplicated confirmations recorded`);
    assert.ok(readiness.nonRepositoryReferenceCount >= 10, `only ${readiness.nonRepositoryReferenceCount} service references recorded`);
  });

  it("executes nothing, and says so in every record", () => {
    assert.equal(readiness.productionExecutionCount, 0);
    const executable = records.filter((record) => record.enabledInProduction || record.canExecute);
    assert.deepEqual(executable.map((record) => record.repository), [], "a research record claims it can execute");
    const unreviewed = records.filter((record) => record.humanReviewRequired !== true);
    assert.deepEqual(unreviewed.map((record) => record.repository), [], "a record in intake does not require human review");
  });

  it("claims verification only where a measurement was recorded", () => {
    // The motivating defect, and it is in the batch 7 module rather than in a
    // hypothetical: it derives verification from prose with
    //
    //   repositoryVerified: !/reported in submitted screenshot|requires authoritative/.test(input.license)
    //
    // so a licence string that happens to avoid two phrases claims a check
    // nobody ran. Here the claim has to rest on evidence.
    for (const record of records) {
      assert.ok(
        record.evidence && record.evidence.length > 40,
        `${record.repository} claims a licence with no evidence of how it was read`
      );
      assert.match(
        record.evidence,
        /Cloned 16 September 2026/,
        `${record.repository} does not say the licence was read from a clone on a stated date`
      );
      assert.equal(
        record.repositoryVerified,
        true,
        `${record.repository} carries evidence but is not marked verified`
      );
    }
    assert.equal(readiness.verifiedCount, records.length);
  });

  it("does not turn an absent licence into a permissive one", () => {
    // brandonhimpfen/awesome-serverless has no LICENSE, LICENCE or COPYING file
    // at its root, and arrived described as "a curated directory". No licence is
    // all rights reserved; the absence is not permission, and nobody here can
    // grant what its author has not.
    const unlicensed = records.find((record) => record.repository === "brandonhimpfen/awesome-serverless");
    assert.ok(unlicensed, "the unlicensed record is gone; this assertion now proves nothing");
    assert.match(unlicensed.license, /NONE DECLARED/);
    assert.equal(unlicensed.licenseRisk, "high");
    assert.equal(unlicensed.integrationStatus, "reference_only_no_license");
  });

  it("keeps a reciprocal licence labelled reciprocal", () => {
    // Two of the ten are copyleft, and flattening either into a generic
    // "open source" label is how a hosted product acquires an obligation
    // nobody noticed. Set from reading the licence file, never from a
    // substring search over prose.
    const reciprocal = records.filter((record) => record.reciprocalLicense);
    assert.ok(reciprocal.length >= 2, `only ${reciprocal.length} reciprocal licences flagged; two were read from the licence files`);
    for (const record of reciprocal) {
      assert.match(record.license, /GPL/, `${record.repository} is flagged reciprocal but its licence string does not name a reciprocal licence`);
      assert.equal(record.licenseRisk, "high", `${record.repository} is reciprocal and not marked high risk`);
      assert.notEqual(record.integrationStatus, "optional_adapter_after_review", `${record.repository} is reciprocal and queued for adapter work`);
    }
  });

  it("does not flatten a split licence into one label", () => {
    // Claude-BugHunter is MIT for code and CC BY 4.0 for content, split by file
    // type and documented upstream. Recording only "MIT" would drop an
    // attribution obligation that applies to exactly the part most likely to be
    // adapted here -- the methodology and the rubrics.
    const split = records.find((record) => record.repository === "elementalsouls/Claude-BugHunter");
    assert.ok(split, "the split-licence record is gone; this assertion now proves nothing");
    assert.match(split.license, /MIT/);
    assert.match(split.license, /CC BY 4\.0/);
    assert.match(split.evidence, /LICENSE-CONTENT/);
  });

  it("separates a tool's licence from the rights in what it processes", () => {
    // iptv-org/iptv is released into the public domain. That disclaims its
    // maintainers' rights in their own list. It says nothing whatever about the
    // broadcast streams the list points at.
    const iptv = records.find((record) => record.repository === "iptv-org/iptv");
    assert.ok(iptv, "the public-domain record is gone; this assertion now proves nothing");
    assert.match(iptv.license, /NOT for the streams/);
    assert.equal(iptv.integrationStatus, "blocked");
    assert.ok(
      records.every((record) => record.blockedUses.includes("treating a permissive licence on a tool as rights in the material fed to it")),
      "the tool-versus-material rule is missing from a record's blocked uses"
    );
  });

  it("refuses on conduct without pretending it is a licence problem", () => {
    // Three of the five refusals are permissively licensed. If they were filed
    // as licence problems, the natural reading would be that a relicence could
    // unblock them, and it could not.
    const permanent = refusals.filter((refusal) => refusal.relicensingWouldNotHelp);
    assert.ok(permanent.length >= 4, `only ${permanent.length} refusals state that relicensing would not help`);
    for (const refusal of refusals) {
      assert.ok(refusal.observed && refusal.observed.length > 30, `${refusal.key} does not say what was observed`);
      assert.ok(refusal.refusedBecause && refusal.refusedBecause.length > 60, `${refusal.key} does not give a reason that can be argued with`);
    }
    // Named individually, because a count would still pass if the sharpest one
    // quietly disappeared.
    const keys = refusals.map((refusal) => refusal.key);
    for (const required of ["people_search_osint", "provenance_stripping", "provider_boundary_bypass", "detection_evasion"]) {
      assert.ok(keys.includes(required), `the ${required} refusal has been dropped`);
    }
  });

  it("records a re-reading that agreed, rather than dropping it", () => {
    // Four leads were already in data/open-source-tools.ts and were
    // re-measured independently. All four agreed. A confirmation is evidence,
    // and a reader who cannot see that the second reading happened will do a
    // third one.
    for (const confirmation of confirmations) {
      assert.equal(confirmation.agrees, true, `${confirmation.repository} was re-read and disagreed with the register, which is a defect rather than a note`);
      assert.ok(confirmation.registerSays && confirmation.reReadSays, `${confirmation.repository} does not record both readings`);
    }
  });

  it("does not record a repository the register already holds", () => {
    // A repository with two verdicts has none. The register is the authority for
    // anything already in it; this module carries the added measurement in
    // CONFIRMED_EXISTING_RECORDS instead of a competing record.
    const register = fs.readFileSync(path.join(__dirname, "..", "data", "open-source-tools.ts"), "utf8");
    const duplicated = records
      .filter((record) => register.includes(`github.com/${record.repository}`))
      .map((record) => record.repository);
    assert.deepEqual(duplicated, [], `these repositories are recorded twice, once here and once in the register:\n  ${duplicated.join("\n  ")}`);

    // And the confirmations must genuinely be in the register, or this module
    // is claiming a deduplication it did not perform.
    const missing = confirmations
      .filter((confirmation) => !register.toLowerCase().includes(`github.com/${confirmation.repository.toLowerCase()}`))
      .map((confirmation) => confirmation.repository);
    assert.deepEqual(missing, [], `these are recorded as already-in-the-register and are not in it:\n  ${missing.join("\n  ")}`);
  });

  it("does not reuse a batch number that already means something else", () => {
    // Written after getting this wrong three times. The screenshot radar
    // filenames run batch2..batch7, so 8 looks like the next free number and is
    // not: getCombinedReadiness publishes capabilityBatch8 and designBatch9.
    // Renaming to 10 collided with lib/sonara-batch10-operational-review.cjs,
    // the module the convergence skill's authority order calls "Batch 10
    // operational requirements". Renaming to 11 collided with
    // lib/sonara-batch11-operational-review.cjs, which landed on main *while
    // this intake was being written* -- free in the branch, taken by the time
    // CI built the merge commit. This intake is 12.
    //
    // The claims are DERIVED here rather than listed, for two reasons the three
    // collisions demonstrate between them. A hardcoded list is what let the
    // second through: the first version of this assertion named 8 and 9 and said
    // nothing about 10. And nothing local could have caught the third, because
    // the number really was free here -- only a scan run against the merged tree
    // sees what main has claimed since.
    // A module *claims* a number when it defines that batch: its filename
    // carries the number, or it exports a symbol carrying it. Merely naming one
    // is not a claim -- the first version of this scan matched any
    // `...BatchN` identifier anywhere in the source, so the moment
    // sonara-batch-convergence-engine.cjs imported this module's getter the
    // engine read as a rival claimant. The check reporting that was the check
    // working; the definition was wrong, so the definition changed.
    const libDir = path.join(__dirname, "..", "lib");
    const claims = new Map();
    for (const file of fs.readdirSync(libDir)) {
      if (!file.endsWith(".cjs")) continue;
      const numbers = new Set();
      const fromName = file.match(/batch(\d{1,2})/i);
      if (fromName) numbers.add(Number(fromName[1]));
      const source = fs.readFileSync(path.join(libDir, file), "utf8");
      const exportsAt = source.lastIndexOf("module.exports");
      if (exportsAt !== -1) {
        for (const match of source.slice(exportsAt).matchAll(/Batch(\d{1,2})\b/g)) numbers.add(Number(match[1]));
      }
      for (const number of numbers) {
        if (!claims.has(number)) claims.set(number, new Set());
        claims.get(number).add(file);
      }
    }

    // Measured 16 September 2026 after merging main: eleven numbers, 2 through
    // 12, each claimed by exactly one module -- 8 and 9 both by
    // sonara-capability-design-batches.cjs.
    assert.ok(claims.size >= 11, `only ${claims.size} batch numbers found across lib/, below the 11 claimed on 16 September 2026; this check has gone blind`);

    const mine = Number(readiness.mode.match(/batch(\d{1,2})$/)[1]);
    assert.equal(mine, 12, "this module's batch number changed; re-derive which numbers are free before renaming it");

    const claimants = [...(claims.get(mine) || [])].filter((file) => !file.includes("screenshot-tool-radar-batch12"));
    assert.deepEqual(
      claimants,
      [],
      `batch ${mine} is also claimed by:\n  ${claimants.join("\n  ")}\n`
        + "Two modules behind one batch label is the exact ambiguity this catalog exists to avoid. Pick a free number."
    );

    // And it has to actually be published, or none of the above matters.
    const route = fs.readFileSync(path.join(__dirname, "..", "routes", "sonara-requested-repositories-routes.cjs"), "utf8");
    assert.ok(
      route.includes("getScreenshotToolReadinessBatch12"),
      "batch 12 is not wired into the catalog route, so none of it reaches the Research Lab"
    );
  });

  it("gives every record a next step somebody could actually take", () => {
    for (const record of records) {
      assert.ok(record.nextStep && record.nextStep.length > 40, `${record.repository} has no concrete next step`);
      assert.ok(record.note && record.note.length > 80, `${record.repository} has no note saying what the measurement changed`);
      assert.equal(record.licenseReadOn, "2026-09-16", `${record.repository} does not carry the date its licence was read`);
    }
  });
});

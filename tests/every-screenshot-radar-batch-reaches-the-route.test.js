// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// A radar batch nobody wired is research nobody can read.
//
// `lib/sonara-screenshot-tool-radar-batch13.cjs` was recorded on 16 September
// 2026 with four verified repositories and two non-repository references, and
// `routes/sonara-requested-repositories-routes.cjs` required batch 12 and then
// batch 14. Nothing named batch 13. Its records reached no catalog, no
// readiness figure and no page, and `productionExecutionCount` -- the number
// that says how many reviewed repositories this product actually executes --
// was published as covering all screenshot intake while four records sat
// outside the population it counted.
//
// `scripts/report-unreferenced-modules.mjs` printed "every module is
// reachable" throughout, because `tests/batch13-event-security-media.test.js`
// names the module and that report counts a test as a referencer.
// `tests/requested-repository-suite.test.js` asserted the exact key list and
// passed, because the list was written from the route rather than from the
// batch modules -- so it agreed with the omission instead of catching it.
//
// This asserts the property instead of the enumeration: every batch module
// that exists on disk contributes every one of its repository keys to the
// public catalog. A module the route forgets to require fails here, and so
// does one the route requires and never aggregates -- which is the failure a
// require-only check would miss.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const request = require("supertest");
const app = require("../server");

const root = path.join(__dirname, "..");

// Discovered rather than listed. A list here would be the same hand-maintained
// enumeration that dropped batch 13 in the first place.
const batchModules = fs
  .readdirSync(path.join(root, "lib"))
  .filter((name) => /^sonara-screenshot-tool-radar(-batch\d+)?\.cjs$/.test(name))
  .sort();

describe("every screenshot radar batch reaches the route", () => {
  it("finds the batch modules at all, so this cannot pass by reading nothing", () => {
    // Twelve on 21 September 2026: the base module plus batches 2-7 and 12-16.
    // A floor rather than equality, because adding a batch is the normal case
    // and should not fail this; losing the glob should.
    assert.ok(
      batchModules.length >= 12,
      `only ${batchModules.length} radar batch module(s) found under lib/; this check has gone blind`
    );
  });

  it("gives every module a readiness accessor returning repositories", () => {
    for (const name of batchModules) {
      const module = require(path.join(root, "lib", name));
      const accessor = Object.keys(module).find((key) => /^getScreenshotToolReadiness/.test(key));
      assert.ok(accessor, `${name} exports no getScreenshotToolReadiness* accessor, so this check cannot read it`);
      const readiness = module[accessor]();
      assert.ok(
        Array.isArray(readiness.repositories) && readiness.repositories.length > 0,
        `${name} reports no repositories, so asserting its keys reach the catalog would assert nothing`
      );
    }
  });

  it("publishes every batch's repository keys in the public catalog", async () => {
    const response = await request(app)
      .get("/api/ecosystem/requested-repositories")
      .set("Accept", "application/json");
    assert.equal(response.status, 200);

    const published = new Set(response.body.repositories.map((item) => item.key));
    const missing = [];
    let expected = 0;

    for (const name of batchModules) {
      const module = require(path.join(root, "lib", name));
      const accessor = Object.keys(module).find((key) => /^getScreenshotToolReadiness/.test(key));
      for (const record of module[accessor]().repositories) {
        expected += 1;
        if (!published.has(record.key)) missing.push(`${name}: ${record.key}`);
      }
    }

    assert.ok(expected >= 100, `only ${expected} batch record(s) collected; this check has gone blind`);
    assert.deepEqual(
      missing,
      [],
      `${missing.length} recorded repository/repositories reach no catalog. Require the batch in `
        + "routes/sonara-requested-repositories-routes.cjs AND add it to getCombinedPublicCatalog, "
        + `getScreenshotResearchCount, getLatestScreenshotIntake and getCombinedReadiness:\n  ${missing.join("\n  ")}`
    );
  });

  it("publishes every batch's non-repository references too", async () => {
    // The other half of the same omission: batch 13 held two non-repository
    // references -- Confluent's event-driven-agent material and the AWS/Datadog
    // GenAI observability write-up -- and they were missing from
    // getAllNonRepositoryReferences and getLatestScreenshotIntake alongside its
    // four repositories. Read from the exported arrays rather than the
    // accessors, because not every batch exports an accessor for them and a
    // batch this check silently skipped would be the defect again.
    const response = await request(app)
      .get("/api/ecosystem/requested-repositories")
      .set("Accept", "application/json");
    assert.equal(response.status, 200);

    const published = new Set(response.body.nonRepositoryReferences.map((item) => item.key));
    const missing = [];
    let expected = 0;

    for (const name of batchModules) {
      const module = require(path.join(root, "lib", name));
      for (const key of Object.keys(module).filter((exported) => /^NON_REPOSITORY_REFERENCES/.test(exported))) {
        for (const record of module[key]) {
          // Batch 16 supersedes batch 15's unresolved SearchPhone lead with a
          // verified restricted record, so the route drops it from this list on
          // purpose. tests/requested-repository-suite.test.js asserts that.
          if (record.key === "searchphone") continue;
          expected += 1;
          if (!published.has(record.key)) missing.push(`${name}: ${record.key}`);
        }
      }
    }

    assert.ok(expected >= 50, `only ${expected} non-repository reference(s) collected; this check has gone blind`);
    assert.deepEqual(missing, [], `${missing.length} recorded non-repository reference(s) reach no surface:\n  ${missing.join("\n  ")}`);
    assert.equal(
      response.body.nonRepositoryReferenceCount,
      expected,
      `nonRepositoryReferenceCount is ${response.body.nonRepositoryReferenceCount} but the batch modules hold ${expected}`
    );
  });

  it("counts every batch record in the published screenshot research figure", async () => {
    const response = await request(app)
      .get("/api/ecosystem/requested-repositories")
      .set("Accept", "application/json");

    const counted = batchModules.reduce((total, name) => {
      const module = require(path.join(root, "lib", name));
      const accessor = Object.keys(module).find((key) => /^getScreenshotToolReadiness/.test(key));
      return total + module[accessor]().repositories.length;
    }, 0);

    // Appearing in the catalog and being counted are different properties, and
    // the count is the one the founder control plane reports.
    assert.equal(
      response.body.screenshotResearchCount,
      counted,
      `screenshotResearchCount is ${response.body.screenshotResearchCount} but the batch modules hold ${counted} records`
    );
  });
});

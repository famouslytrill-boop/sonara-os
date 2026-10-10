"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const qualification = require("../lib/sonara-device-qualification-evidence.cjs");
const infrastructure = require("../lib/sonara-infrastructure-manifest.cjs");

const SHA = "a".repeat(40);
const CASE = (key, status = "pass") => ({ key, status });

function record({ platform = "android", profile = "motion_web", cases, ...rest } = {}) {
  return {
    platform,
    profile,
    physicalDevice: true,
    releaseSha: SHA,
    capturedAt: "2026-10-09T12:00:00.000Z",
    deviceModel: "Physical test device",
    osVersion: platform === "android" ? "Android 16" : "iOS 26",
    browserName: platform === "android" ? "Chrome" : "Safari",
    browserVersion: "test-version",
    installMode: profile === "android_twa" ? "play_internal_test" : profile === "ios_internal_shell" ? "internal_signed_shell" : "browser",
    buildIdentity: "qa-build-1",
    cases: cases || qualification.PROFILE_CASES[profile].map((key) => CASE(key)),
    ...rest
  };
}

describe("physical-device qualification evidence", () => {
  it("requires the denial, revocation, visibility and accessibility cases", () => {
    for (const key of [
      "account_permission_off_blocks_prompt",
      "browser_permission_denied",
      "hidden_page_stops_capture",
      "revocation_after_load_blocks_write",
      "rotation_reflow",
      "text_scaling",
      "reduced_motion"
    ]) {
      assert.ok(qualification.COMMON_CASES.includes(key), `${key} is not a required physical-device case`);
    }
  });

  it("requires a physical device and exact release SHA", () => {
    assert.equal(qualification.validateRecord({ ...record(), physicalDevice: false }).code, "physical_device_required");
    assert.equal(qualification.validateRecord({ ...record(), releaseSha: "short" }).code, "release_sha_invalid");
  });

  it("requires complete device/build identity without serial numbers or raw sensor data", () => {
    for (const field of ["deviceModel", "osVersion", "browserName", "browserVersion", "installMode", "buildIdentity"]) {
      const bad = record();
      bad[field] = "";
      assert.equal(qualification.validateRecord(bad).code, "device_identity_incomplete", field);
    }
  });

  it("refuses duplicate or missing cases", () => {
    const missing = record({ cases: qualification.COMMON_CASES.slice(1).map((key) => CASE(key)) });
    assert.equal(qualification.validateRecord(missing).code, "required_cases_missing");

    const duplicate = record();
    duplicate.cases.push(CASE(duplicate.cases[0].key));
    assert.equal(qualification.validateRecord(duplicate).code, "case_duplicate");
  });

  it("qualifies only an exact-SHA record whose required cases all pass", () => {
    const good = record();
    assert.equal(qualification.qualificationFor([good], { platform: "android", profile: "motion_web", releaseSha: SHA }).qualified, true);

    const wrongSha = qualification.qualificationFor([good], { platform: "android", profile: "motion_web", releaseSha: "b".repeat(40) });
    assert.equal(wrongSha.qualified, false);
    assert.equal(wrongSha.code, "physical_device_evidence_missing");

    const failed = record();
    failed.cases = failed.cases.map((entry) => entry.key === "browser_permission_denied" ? { ...entry, status: "fail" } : entry);
    assert.equal(qualification.qualificationFor([failed], { platform: "android", profile: "motion_web", releaseSha: SHA }).qualified, false);
  });

  it("keeps Android and iOS production-disabled until physical proof exists", () => {
    const android = infrastructure.CAPABILITY_EXPANSION_TRACKS.find((entry) => entry.key === "android_native_client");
    const ios = infrastructure.CAPABILITY_EXPANSION_TRACKS.find((entry) => entry.key === "ios_native_client");
    assert.ok(android);
    assert.ok(ios);
    assert.equal(android.productionEnabled, false);
    assert.equal(ios.productionEnabled, false);
  });

  it("ships an empty evidence ledger rather than fabricated passing records", () => {
    const ledger = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "device-qualification-evidence.json"), "utf8"));
    assert.equal(ledger.schemaVersion, 1);
    assert.equal(ledger.status, "unqualified");
    assert.deepEqual(ledger.records, []);
  });
});

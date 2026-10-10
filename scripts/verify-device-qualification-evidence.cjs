// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const evidence = require("../lib/sonara-device-qualification-evidence.cjs");
const infrastructure = require("../lib/sonara-infrastructure-manifest.cjs");

const ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT, "data", "device-qualification-evidence.json");

function headSha() {
  // On pull_request workflows GITHUB_SHA may be the synthetic refs/pull/*/merge
  // commit. Qualification belongs to the source revision under review, so use
  // the event's pull_request.head.sha when it is available.
  const eventPath = String(process.env.GITHUB_EVENT_PATH || "").trim();
  if (eventPath) {
    try {
      const event = JSON.parse(fs.readFileSync(eventPath, "utf8"));
      const pullRequestHead = String(event?.pull_request?.head?.sha || "").trim();
      if (evidence.validSha(pullRequestHead)) return pullRequestHead.toLowerCase();
    } catch {
      // A missing/unreadable event file is not proof; continue to other exact
      // sources rather than guessing.
    }
  }

  const fromEnv = String(process.env.GITHUB_SHA || "").trim();
  if (evidence.validSha(fromEnv)) return fromEnv.toLowerCase();
  try {
    const value = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
    if (evidence.validSha(value)) return value.toLowerCase();
  } catch {
    // Fall through to explicit failure below.
  }
  throw new Error("Could not determine an exact 40-character repository source SHA.");
}

function track(key) {
  return infrastructure.CAPABILITY_EXPANSION_TRACKS.find((candidate) => candidate.key === key) || null;
}

function readLedger() {
  const parsed = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  if (parsed?.schemaVersion !== 1) throw new Error("device qualification evidence schemaVersion must be 1");
  if (!Array.isArray(parsed.records)) throw new Error("device qualification evidence records must be an array");
  return parsed;
}

function main() {
  const sha = headSha();
  const ledger = readLedger();

  const android = evidence.qualificationFor(ledger.records, {
    platform: "android",
    profile: "android_twa",
    releaseSha: sha
  });
  const ios = evidence.qualificationFor(ledger.records, {
    platform: "ios",
    profile: "ios_internal_shell",
    releaseSha: sha
  });

  for (const result of [android, ios]) {
    if (!result.ok) {
      throw new Error(`Invalid device qualification evidence: ${JSON.stringify(result)}`);
    }
  }

  const androidTrack = track("android_native_client");
  const iosTrack = track("ios_native_client");
  if (!androidTrack) throw new Error("android_native_client capability track is missing");
  if (!iosTrack) throw new Error("ios_native_client capability track is missing");

  if (androidTrack.productionEnabled === true && android.qualified !== true) {
    throw new Error(`Android is productionEnabled but exact-head physical qualification is missing: ${android.code}`);
  }
  if (iosTrack.productionEnabled === true && ios.qualified !== true) {
    throw new Error(`iOS is productionEnabled but exact-head physical qualification is missing: ${ios.code}`);
  }

  const summary = {
    releaseSha: sha,
    android: { qualified: android.qualified, code: android.code, productionEnabled: androidTrack.productionEnabled === true },
    ios: { qualified: ios.qualified, code: ios.code, productionEnabled: iosTrack.productionEnabled === true }
  };
  process.stdout.write(`Device qualification evidence: ${JSON.stringify(summary)}\n`);
}

main();

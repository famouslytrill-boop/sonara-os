#!/usr/bin/env node
"use strict";

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const cacheKey = crypto.createHash("sha256").update(REPO).digest("hex").slice(0, 16);
export const COVERAGE_DIR = path.join(os.tmpdir(), `sonara-v8-coverage-${cacheKey}`);
export const MARKER_PATH = path.join(COVERAGE_DIR, "successful-run.json");

const ROOT_FILES = [".mocharc.json", "package.json", "server.js"];
const SOURCE_DIRECTORIES = ["api", "lib", "routes", "scripts", "tests"];

function collectFiles(directory, result) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) collectFiles(absolute, result);
    else if (entry.isFile()) result.push(absolute);
  }
}

export function treeFingerprint() {
  const files = ROOT_FILES.map((name) => path.join(REPO, name)).filter(fs.existsSync);
  for (const directory of SOURCE_DIRECTORIES) collectFiles(path.join(REPO, directory), files);
  files.sort((left, right) => left.localeCompare(right));

  const hash = crypto.createHash("sha256");
  for (const absolute of files) {
    const relative = path.relative(REPO, absolute).split(path.sep).join("/");
    hash.update(relative);
    hash.update("\0");
    hash.update(fs.readFileSync(absolute));
    hash.update("\0");
  }
  return hash.digest("hex");
}

export function hasCurrentSuccessfulCoverage() {
  if (!fs.existsSync(MARKER_PATH)) return false;
  try {
    const marker = JSON.parse(fs.readFileSync(MARKER_PATH, "utf8"));
    const coverageFiles = fs.readdirSync(COVERAGE_DIR).filter(
      (name) => name.startsWith("coverage-") && name.endsWith(".json")
    );
    return marker.fingerprint === treeFingerprint() && coverageFiles.length > 0;
  } catch {
    return false;
  }
}

export function prepareCoverageDirectory() {
  fs.rmSync(COVERAGE_DIR, { recursive: true, force: true });
  fs.mkdirSync(COVERAGE_DIR, { recursive: true });
}

export function recordSuccessfulCoverage() {
  fs.writeFileSync(
    MARKER_PATH,
    `${JSON.stringify({ fingerprint: treeFingerprint(), completedAt: new Date().toISOString() }, null, 2)}\n`,
    { mode: 0o600 }
  );
}

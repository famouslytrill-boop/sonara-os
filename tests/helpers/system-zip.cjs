"use strict";

// Keep ZIP verification independent from the application's writer while
// supporting both Unix CI images and Windows developer machines.

const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function commandExists(command) {
  const probe = process.platform === "win32"
    ? spawnSync("where.exe", [command], { stdio: "ignore" })
    : spawnSync("sh", ["-c", `command -v ${command}`], { stdio: "ignore" });
  return probe.status === 0;
}

function zipTool() {
  if (commandExists("unzip")) return "unzip";
  if (commandExists("tar")) return "tar";
  throw new Error("ZIP verification requires the system unzip or tar command");
}

function listZip(zipPath) {
  const tool = zipTool();
  return tool === "unzip"
    ? execFileSync(tool, ["-l", zipPath], { encoding: "utf8" })
    : execFileSync(tool, ["-tf", zipPath], { encoding: "utf8" });
}

function extractZip(zipPath, outputDirectory) {
  fs.mkdirSync(outputDirectory, { recursive: true });
  const tool = zipTool();
  if (tool === "unzip") execFileSync(tool, ["-q", "-o", zipPath, "-d", outputDirectory]);
  else execFileSync(tool, ["-xf", zipPath, "-C", outputDirectory]);
}

function verifyZip(zipPath) {
  const tool = zipTool();
  if (tool === "unzip") return execFileSync(tool, ["-t", zipPath], { encoding: "utf8" });

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sonara-zip-verify-"));
  try {
    extractZip(zipPath, directory);
    return "Archive extracted without errors";
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

module.exports = { extractZip, listZip, verifyZip };

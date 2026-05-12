import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];
const warnings = [];

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

if (!exists("package.json")) {
  failures.push("Missing package.json");
}

const hasRootSrc = exists("src");
const hasAppDir = exists("app");
const hasMonorepoWeb = exists("packages/web/src");

if (!hasRootSrc && !hasAppDir && !hasMonorepoWeb) {
  failures.push("No recognized app source folder found. Expected one of: src, app, or packages/web/src.");
}

if (!exists("scripts")) {
  warnings.push("Missing scripts folder.");
}

if (!exists("docs")) {
  warnings.push("Missing docs folder.");
}

if (exists("package.json")) {
  const packageJson = readJson("package.json");
  const scripts = packageJson.scripts ?? {};

  for (const script of ["lint", "build"]) {
    if (!scripts[script]) {
      failures.push(`Missing package.json script: ${script}`);
    }
  }
}

if (warnings.length > 0) {
  console.warn("\nInfrastructure validation warnings:");
  for (const warning of warnings) {
    console.warn(`- ${warning}`);
  }
}

if (failures.length > 0) {
  console.error("\nInfrastructure validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Infrastructure validation passed.");

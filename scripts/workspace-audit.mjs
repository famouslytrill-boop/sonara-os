import fs from "node:fs";
import path from "node:path";
import { listPackages, packageName, readJson, repoRoot, walkFiles } from "./workspace.mjs";

const requiredScripts = ["typecheck", "build", "smoke"];
const requiredPackageEntry = "dist/index.mjs";
const sourceExtensions = /\.(ts|tsx|mjs|css|html|md|json)$/;

const packageReports = listPackages().map((packageDir) => auditPackage(packageDir));
const inventory = createInventory();

for (const report of packageReports) {
  if (report.errors.length > 0) {
    throw new Error(`${report.name} workspace audit failed: ${report.errors.join("; ")}`);
  }
}

console.log("Workspace audit passed.");
console.log(`Packages: ${packageReports.length}`);
console.log(`Source files: ${inventory.sourceFiles}`);
console.log(`Docs: ${inventory.docs}`);
console.log(`Scripts: ${inventory.scripts}`);

function auditPackage(packageDir) {
  const manifest = readJson(path.join(packageDir, "package.json"));
  const errors = [];
  for (const scriptName of requiredScripts) {
    if (!manifest.scripts?.[scriptName]) {
      errors.push(`missing script ${scriptName}`);
    }
  }
  if (manifest.main !== requiredPackageEntry) {
    errors.push(`main must be ${requiredPackageEntry}`);
  }
  if (manifest.exports?.["."] !== `./${requiredPackageEntry}`) {
    errors.push(`exports must point to ./${requiredPackageEntry}`);
  }
  const distEntry = path.join(packageDir, requiredPackageEntry);
  if (fs.existsSync(path.join(packageDir, "dist")) && !fs.existsSync(distEntry)) {
    errors.push("dist exists without dist/index.mjs");
  }
  return Object.freeze({
    name: packageName(packageDir),
    errors: Object.freeze(errors)
  });
}

function createInventory() {
  const sourceFiles = walkFiles(path.join(repoRoot, "packages"), (filePath) =>
    sourceExtensions.test(filePath)
  );
  const docs = fs.existsSync(path.join(repoRoot, "docs"))
    ? walkFiles(path.join(repoRoot, "docs"), (filePath) => filePath.endsWith(".md"))
    : [];
  const scripts = walkFiles(path.join(repoRoot, "scripts"), (filePath) =>
    filePath.endsWith(".mjs")
  );
  return Object.freeze({
    sourceFiles: sourceFiles.length,
    docs: docs.length,
    scripts: scripts.length
  });
}

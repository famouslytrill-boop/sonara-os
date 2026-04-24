import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { listPackages, readJson, repoRoot, walkFiles } from "./workspace.mjs";

const finalExportTiers = [
  "prompt_bundle",
  "production_bundle",
  "daw_bundle",
  "release_bundle",
  "elite_mutation_bundle"
];
const legacyDawName = ["D", "A", "w", "Name"].join("");
const retiredTierNames = [
  ["fr", "ee"].join(""),
  ["cre", "ator"].join(""),
  ["p", "ro"].join(""),
  ["stu", "dio"].join(""),
  ["enter", "prise"].join("")
];
const requiredStoreFiles = [
  "sessionStore.ts",
  "analysisStore.ts",
  "composeStore.ts",
  "decisionResultStore.ts"
];

assertNoLegacyDawName();
assertNoRetiredTierNames();
assertCoreTypes();
assertRequiredStores();
assertRuntimeEventBus();
assertWorkflowStateMachine();
assertProviderGatewaySafety();
assertExportProvenance();
assertRouteHelpers();
assertPackageScripts();
runPackageTypechecks();

console.log("Typecheck gate passed.");

function assertNoLegacyDawName() {
  const offenders = walkFiles(repoRoot, (filePath) => /\.(ts|mjs|json|md)$/.test(filePath))
    .filter((filePath) => fs.readFileSync(filePath, "utf8").includes(legacyDawName));
  if (offenders.length > 0) {
    throw new Error(`Legacy DAW name casing remains in: ${offenders.join(", ")}`);
  }
}

function assertNoRetiredTierNames() {
  const offenders = walkFiles(repoRoot, (filePath) => /\.(ts|mjs|json|md)$/.test(filePath))
    .filter((filePath) => {
      const source = fs.readFileSync(filePath, "utf8");
      return retiredTierNames.some((tierName) => source.includes(`"${tierName}"`) || source.includes(`\`${tierName}\``));
    });
  if (offenders.length > 0) {
    throw new Error(`Retired tier names remain in: ${offenders.join(", ")}`);
  }
}

function assertCoreTypes() {
  const typesPath = path.join(repoRoot, "packages/core/src/lib/types.ts");
  const source = fs.readFileSync(typesPath, "utf8");
  const tierMatch = source.match(/export const ExportTiers = Object\.freeze\(\[([\s\S]*?)\]\);/);
  if (!tierMatch) {
    throw new Error("ExportTiers must be declared in packages/core/src/lib/types.ts.");
  }
  const tiers = Array.from(tierMatch[1].matchAll(/"([^"]+)"/g), (match) => match[1]);
  if (JSON.stringify(tiers) !== JSON.stringify(finalExportTiers)) {
    throw new Error(`ExportTiers mismatch. Expected ${finalExportTiers.join(", ")}, got ${tiers.join(", ")}`);
  }
  if (!source.includes("DawNames")) {
    throw new Error("DawNames must be declared with canonical casing.");
  }
}

function assertRequiredStores() {
  const storeDir = path.join(repoRoot, "packages/core/src/stores");
  for (const fileName of requiredStoreFiles) {
    const filePath = path.join(storeDir, fileName);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing required store: ${fileName}`);
    }
    const source = fs.readFileSync(filePath, "utf8");
    const factoryName = `create${toPascal(fileName.replace(/\.ts$/, ""))}`;
    if (!source.includes(`function ${factoryName}`)) {
      throw new Error(`Missing ${factoryName} in ${fileName}`);
    }
  }
}

function assertRuntimeEventBus() {
  const eventBusPath = path.join(repoRoot, "packages/runtime/src/eventBus.ts");
  const adaptersPath = path.join(repoRoot, "packages/runtime/src/adapters.ts");
  const eventBus = fs.readFileSync(eventBusPath, "utf8");
  const adapters = fs.readFileSync(adaptersPath, "utf8");
  if (!eventBus.includes("createEventBus") || !eventBus.includes("emit")) {
    throw new Error("Runtime eventBus must expose createEventBus and emit.");
  }
  if (!adapters.includes("eventBus.emit")) {
    throw new Error("Runtime adapters must emit events through eventBus.");
  }
}

function assertWorkflowStateMachine() {
  const workflowPath = path.join(repoRoot, "packages/core/src/workflow/stateMachine.ts");
  const source = fs.readFileSync(workflowPath, "utf8");
  for (const state of ["idle", "session-started", "analysis-ready", "compose-ready", "decision-ready", "export-ready", "archived"]) {
    if (!source.includes(state)) {
      throw new Error(`Workflow state machine missing state: ${state}`);
    }
  }
  if (!source.includes("Invalid workflow transition")) {
    throw new Error("Workflow state machine must reject invalid transitions.");
  }
}

function assertProviderGatewaySafety() {
  const gatewayPath = path.join(repoRoot, "packages/provider-gateway/src/providerGateway.ts");
  const safetyPath = path.join(repoRoot, "packages/provider-gateway/src/musicStyleSafety.ts");
  const gateway = fs.readFileSync(gatewayPath, "utf8");
  const safety = fs.readFileSync(safetyPath, "utf8");
  if (!gateway.includes("enforceMusicStyleSafety")) {
    throw new Error("Provider Gateway must enforce music-style safety before provider calls.");
  }
  if (!safety.includes("AllowedMusicStyles") || !safety.includes("disallowedStylePatterns")) {
    throw new Error("Music-style safety must define allowed styles and blocked imitation patterns.");
  }
}

function assertExportProvenance() {
  const provenancePath = path.join(repoRoot, "packages/export/src/provenance.ts");
  const source = fs.readFileSync(provenancePath, "utf8");
  for (const fileName of ["provenance/session.json", "provenance/analysis.json", "provenance/compose.json", "provenance/decision-result.json", "provenance/manifest.json"]) {
    if (!source.includes(fileName)) {
      throw new Error(`Export provenance missing ${fileName}`);
    }
  }
}

function assertRouteHelpers() {
  for (const fileName of ["billingRoutes.ts", "adminRoutes.ts"]) {
    const filePath = path.join(repoRoot, "packages/routes/src", fileName);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing route helper: ${fileName}`);
    }
  }
}

function assertPackageScripts() {
  for (const packageDir of listPackages()) {
    const manifest = readJson(path.join(packageDir, "package.json"));
    for (const scriptName of ["typecheck", "build", "smoke"]) {
      if (!manifest.scripts?.[scriptName]) {
        throw new Error(`${manifest.name} missing package script: ${scriptName}`);
      }
    }
  }
}

function runPackageTypechecks() {
  for (const packageDir of listPackages()) {
    const result = spawnSync(process.execPath, ["scripts/typecheck-package.mjs", packageDir], {
      stdio: "inherit"
    });
    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  }
}

function toPascal(value) {
  return value
    .split(/[-_]/)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join("");
}

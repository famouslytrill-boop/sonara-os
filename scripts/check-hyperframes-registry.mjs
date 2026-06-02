import fs from "node:fs";
import { failIfIssues, read } from "./check-utils.mjs";

const issues = [];
const registry = fs.existsSync("packages/open-source-intake/src/project-registry.ts")
  ? read("packages/open-source-intake/src/project-registry.ts")
  : "";

if (!registry.includes('repoName: "hyperframes"')) {
  issues.push("Open-source registry missing HyperFrames.");
}
if (!registry.includes('integrationStatusLabel: "reference_only"')) {
  issues.push("HyperFrames must be reference-only in registry metadata.");
}
if (!registry.includes("No production rendering without queues")) {
  issues.push("HyperFrames registry entry must require queues/storage/auth/quota review.");
}

failIfIssues("HyperFrames registry check", issues);

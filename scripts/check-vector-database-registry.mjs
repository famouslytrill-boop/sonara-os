import fs from "node:fs";
import { failIfIssues, read } from "./check-utils.mjs";

const issues = [];
const registry = fs.existsSync("packages/web/src/lib/vector/vector-provider-registry.ts")
  ? read("packages/web/src/lib/vector/vector-provider-registry.ts")
  : "";
for (const provider of ["qdrant", "milvus"]) {
  if (!registry.includes(provider)) {
    issues.push(`Vector provider registry missing ${provider}.`);
  }
}
if (!registry.includes("productionIntegrated: false")) {
  issues.push("Vector provider registry must not mark providers integrated.");
}

failIfIssues("Vector database registry check", issues);

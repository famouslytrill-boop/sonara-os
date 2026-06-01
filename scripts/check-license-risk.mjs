import fs from "node:fs";
import { failIfIssues, listFiles, relative } from "./check-utils.mjs";

const issues = [];

for (const filePath of listFiles(["packages/open-source-intake/src", "docs"])) {
  const rel = relative(filePath);
  const source = fs.readFileSync(filePath, "utf8");
  if (/\b(AGPL|GPL)\b/i.test(source) && /\ballowed\b/i.test(source) && !/review/i.test(source)) {
    issues.push(`${rel} discusses GPL/AGPL as allowed without review language.`);
  }
  if (
    /non-commercial/i.test(source) &&
    /\bpaid\b/i.test(source) &&
    !/blocked|review/i.test(source)
  ) {
    issues.push(
      `${rel} discusses non-commercial assets for paid use without blocked/review language.`
    );
  }
}

const registry = fs.existsSync("packages/open-source-intake/src/project-registry.ts")
  ? fs.readFileSync("packages/open-source-intake/src/project-registry.ts", "utf8")
  : "";

if (!/license/i.test(registry) || !/review/i.test(registry)) {
  issues.push("Open-source registry must include license review fields or logic.");
}

failIfIssues("License risk gate", issues);

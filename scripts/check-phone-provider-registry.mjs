import fs from "node:fs";
import { failIfIssues, read } from "./check-utils.mjs";

const issues = [];
const registryPath = "packages/web/src/lib/phone/phone-provider-registry.ts";
const source = fs.existsSync(registryPath) ? read(registryPath) : "";

if (!source.includes("linphone_iphone_reference")) {
  issues.push("Phone provider registry missing Linphone reference.");
}
if (!source.includes("productionIntegrated: false")) {
  issues.push("Phone provider registry must keep productionIntegrated false.");
}
if (!source.includes("legalReviewRequired: true")) {
  issues.push("Phone provider registry must require legal review.");
}

failIfIssues("Phone provider registry check", issues);

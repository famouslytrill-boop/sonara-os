import type { OpenSourceLicenseRisk, OpenSourceProjectRecord } from "./types.ts";

export function classifyLicenseRisk(input: {
  licenseNotes?: string;
  useMode?: string;
}): OpenSourceLicenseRisk {
  const notes = input.licenseNotes?.toLowerCase() ?? "";
  if (notes.includes("agpl")) {
    return "critical";
  }
  if (notes.includes("gpl")) {
    return "high";
  }
  if (notes.includes("unknown") || notes.includes("review license")) {
    return "unknown";
  }
  if (notes.includes("mit") || notes.includes("apache") || notes.includes("bsd")) {
    return "low";
  }
  if (input.useMode === "needs_legal_review") {
    return "unknown";
  }
  return "unknown";
}

export function requiresLicenseReview(project: OpenSourceProjectRecord): boolean {
  return (
    project.licenseRisk === "unknown" ||
    project.licenseRisk === "high" ||
    project.licenseRisk === "critical" ||
    project.useMode === "needs_legal_review"
  );
}

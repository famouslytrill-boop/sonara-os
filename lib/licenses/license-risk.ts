import type { LicenseGateStatus } from "../../data/license-policies";

const blockedPatterns = [/non-commercial/i, /unknown/i, /piracy/i, /copyright-circumvention/i];
const restrictedPatterns = [/agpl/i, /gpl/i, /lgpl/i, /mpl/i, /dual/i];
const allowedPatterns = [/mit/i, /bsd/i, /apache-?2\.0/i];

export function classifyLicenseGate(license: string): LicenseGateStatus {
  if (blockedPatterns.some((pattern) => pattern.test(license))) return "Blocked";
  if (restrictedPatterns.some((pattern) => pattern.test(license))) return "Restricted";
  if (allowedPatterns.some((pattern) => pattern.test(license))) return "Allowed";
  return "Review Required";
}

export function canMarkIntegrationAllowed(license: string, status: LicenseGateStatus) {
  const gate = classifyLicenseGate(license);
  if (gate === "Blocked" || gate === "Restricted") {
    return status !== "Allowed";
  }
  return true;
}

import type { VaultStackPlan } from "./vaultStackTypes";

export function buildVaultStack(): VaultStackPlan {
  return {
    purpose: "Organize, classify, verify, package, and export rights-cleared personal Vault assets.",
    items: [
      { name: "User-owned sounds", status: "ready", note: "Allowed when ownership is attested." },
      { name: "Attribution-required sounds", status: "needs_license_review", note: "Attribution sheet required." },
      { name: "Unknown third-party sounds", status: "blocked", note: "Blocked until rights are verified." },
    ],
    exportWarnings: ["No public kit marketplace at launch.", "Do not resell third-party downloaded sounds without verified rights."],
  };
}

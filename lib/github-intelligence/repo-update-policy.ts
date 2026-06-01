export const repoUpdatePolicy = {
  allowedAutomaticUpdates: ["stars", "forks", "open issues", "latest release", "last pushed date", "archived status", "admin recommendation"],
  blockedAutomaticUpdates: ["dependency install", "source copy", "production adapter", "feature flag enablement", "customer-facing integration", "external tool execution", "merge", "deploy"],
};

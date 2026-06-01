export const githubSyncPolicy = {
  allowed: ["metadata refresh", "star count", "fork count", "open issue count", "release info", "admin recommendation", "Codex sprint draft"],
  blocked: ["install dependency", "copy source", "enable feature flag", "create production adapter", "deploy", "merge PR"],
};

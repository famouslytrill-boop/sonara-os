export function isGitHubSyncConfigured(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(env.GITHUB_TOKEN);
}

export function assertServerSideGitHubToken(env: NodeJS.ProcessEnv = process.env) {
  if (!env.GITHUB_TOKEN) return { configured: false, mode: "manual" as const };
  return { configured: true, mode: "sync" as const };
}

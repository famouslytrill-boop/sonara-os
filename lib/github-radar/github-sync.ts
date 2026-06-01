import { isGitHubSyncConfigured } from "./github-client";

export function getGitHubSyncMode(env: NodeJS.ProcessEnv = process.env) {
  return isGitHubSyncConfigured(env) ? "metadata_sync_available" : "manual_registry_mode";
}

import { getGitHubSyncMode } from "@/lib/github-radar/github-sync";

export function GitHubSyncStatus() {
  return (
    <p className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-[#CBD5E1]">
      GitHub mode: {getGitHubSyncMode()}. Token-based sync is optional and server-only.
    </p>
  );
}

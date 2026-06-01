import type { GitHubRadarRepo } from "@/data/github-radar-repos";

export function canAddToWatchlist(repo: GitHubRadarRepo) {
  return !repo.blocked && repo.autoInstall === false;
}

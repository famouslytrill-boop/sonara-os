import { githubRadarRepos } from "@/data/github-radar-repos";

export function getWatchlistRepos() {
  return githubRadarRepos.filter((repo) => !repo.blocked && repo.score >= 60);
}

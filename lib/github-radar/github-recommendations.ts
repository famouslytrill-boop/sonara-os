import { githubRadarRepos } from "@/data/github-radar-repos";

export function getGitHubRadarRecommendations() {
  return githubRadarRepos.filter((repo) => !repo.blocked && repo.score >= 75);
}

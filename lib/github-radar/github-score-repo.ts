import type { GitHubRadarRepo } from "@/data/github-radar-repos";
import { scoreRepo } from "@/lib/github-intelligence/repo-score";

export function githubScoreRepo(repo: GitHubRadarRepo) {
  return scoreRepo(repo);
}

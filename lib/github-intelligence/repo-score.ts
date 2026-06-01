import type { GitHubRadarRepo } from "@/data/github-radar-repos";

export function scoreRepo(repo: Pick<GitHubRadarRepo, "score" | "blocked">) {
  return repo.blocked ? 0 : Math.max(0, Math.min(100, repo.score));
}

export function scoreBand(score: number) {
  if (score >= 90) return "High-value candidate";
  if (score >= 75) return "Strong candidate";
  if (score >= 60) return "Useful reference";
  if (score >= 40) return "Low priority";
  return "Avoid or block";
}

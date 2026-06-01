import type { GitHubRadarRepo } from "@/data/github-radar-repos";

export function getRepoRisk(repo: GitHubRadarRepo) {
  if (repo.blocked) return "blocked";
  if (repo.licenseRisk === "restricted" || repo.securityStatus === "restricted" || repo.privacyStatus === "restricted") return "restricted";
  if (repo.licenseRisk === "review_required" || repo.securityStatus === "review_required" || repo.privacyStatus === "review_required") return "review_required";
  return repo.licenseRisk;
}

export function isProductionBlocked(repo: GitHubRadarRepo) {
  return repo.blocked || repo.integrationStatus === "blocked" || repo.autoInstall !== false;
}

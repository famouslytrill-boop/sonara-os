import type { GitHubRadarRepo } from "@/data/github-radar-repos";

export function generateCodexSprintPrompt(repo: GitHubRadarRepo) {
  return [
    `Repo: ${repo.name}`,
    `Category: ${repo.category}`,
    `SONARA product fit: ${repo.productFit.join(", ")}`,
    `License status: ${repo.licenseRisk}`,
    `Security status: ${repo.securityStatus}`,
    `Privacy status: ${repo.privacyStatus}`,
    "Integration goal: build adapter/reference first, not copied third-party code.",
    "Safety rules: do not commit secrets, do not auto-install dependencies, do not enable without license/security review, human approval required.",
    "Tests: typecheck, build, route smoke, provider registry checks, GitHub Radar safety checks.",
  ].join("\\n");
}

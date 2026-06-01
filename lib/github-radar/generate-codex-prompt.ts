import type { GitHubRadarRepo } from "@/data/github-radar-repos";
import { codexSprintTemplate } from "./codex-sprint-template";

export function generateGitHubRadarCodexPrompt(repo: GitHubRadarRepo) {
  return `${codexSprintTemplate}

Repo: ${repo.name}
Category: ${repo.category}
Product fit: ${repo.productFit.join(", ")}
License: ${repo.licenseRisk}
Security: ${repo.securityStatus}
Privacy: ${repo.privacyStatus}
Integration goal: ${repo.recommendedAction}
Feature flag: ${repo.featureFlag ?? "review_required"}`;
}

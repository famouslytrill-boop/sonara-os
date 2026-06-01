export function normalizeGitHubRepoUrl(input: string) {
  const trimmed = input.trim();
  if (!/^https:\/\/github\.com\/[^/]+\/[^/]+/.test(trimmed)) {
    return { valid: false, repoUrl: trimmed };
  }
  return { valid: true, repoUrl: trimmed.replace(/\/$/, "") };
}

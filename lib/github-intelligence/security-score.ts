export function securityScore({ hasSecurityPolicy, knownIssues }: { hasSecurityPolicy?: boolean; knownIssues?: number }) {
  const base = hasSecurityPolicy ? 75 : 50;
  return Math.max(0, base - (knownIssues ?? 0) * 5);
}

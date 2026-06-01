export type RepoAuditLog = {
  repoUrl: string;
  actorUserId: string;
  action: string;
  riskLevel: "low" | "medium" | "high" | "blocked";
  createdAt: string;
};

export function buildRepoAuditLog(input: Omit<RepoAuditLog, "createdAt">): RepoAuditLog {
  return { ...input, createdAt: new Date().toISOString() };
}

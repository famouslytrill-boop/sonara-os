export function createSecurityTestAudit(organization_id: string, target: string, reviewer: string) {
  return { organization_id, target, reviewer, timestamp: new Date(0).toISOString() };
}

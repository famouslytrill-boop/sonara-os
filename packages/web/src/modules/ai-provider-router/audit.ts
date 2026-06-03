export function createProviderAudit(providerId: string, action: string, organization_id: string) {
  return { providerId, action, organization_id, auditRequired: true };
}

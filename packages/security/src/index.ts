export const launchSecurityPolicy = Object.freeze({
  serviceRoleClientSideAllowed: false,
  stripeSecretClientSideAllowed: false,
  aiProviderSecretClientSideAllowed: false,
  sourceLeakScanRequired: true,
  ownerApprovalRequiredForSecurityChanges: true,
  auditLogDeletionBlocked: true
});

export function assertLaunchSecurityDefaults(): boolean {
  return (
    launchSecurityPolicy.serviceRoleClientSideAllowed === false &&
    launchSecurityPolicy.stripeSecretClientSideAllowed === false &&
    launchSecurityPolicy.aiProviderSecretClientSideAllowed === false &&
    launchSecurityPolicy.auditLogDeletionBlocked === true
  );
}

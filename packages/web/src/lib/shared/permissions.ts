export const permissionBoundaries = Object.freeze({
  canRunDestructiveCommands: false,
  canInstallUnknownDependencies: false,
  canModifyProductionData: false,
  canDeployWithoutApproval: false,
  canExposeInternalSystemsPublicly: false
});

export function requiresHumanReview(permission: keyof typeof permissionBoundaries): boolean {
  return permissionBoundaries[permission] === false;
}

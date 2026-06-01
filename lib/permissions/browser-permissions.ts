export function canAskBrowserPermission() {
  return typeof window !== "undefined" && typeof navigator !== "undefined";
}

export function permissionRequestRequiresUserAction() {
  return true;
}

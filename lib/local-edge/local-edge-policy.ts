export const localEdgePolicy = {
  cloudIsSourceOfTruth: true,
  localDataAllowed: ["drafts", "offline edits", "temporary extraction results", "local preferences"],
  blockedLocalData: ["secrets", "raw payment data", "private keys", "service-role keys"],
  hiddenSyncAllowed: false,
  userCanClearLocalData: true,
};

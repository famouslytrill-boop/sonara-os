export const storagePolicy = {
  publicByDefault: false,
  blockedContent: ["raw card data", "CVV", "private keys", "password lists", "copyrighted assets without rights"],
  requiredControls: ["file type validation", "file size limits", "tenant-scoped access", "rights review for published media"],
};

import type { AccessScope, VectorDocument, VectorSearchInput } from "./vector-types.ts";

export function canAccessVectorDocument(document: VectorDocument, access: AccessScope): boolean {
  if (access.admin && document.namespace === "admin_docs") {
    return true;
  }
  if (document.company_account_id && document.company_account_id !== access.company_account_id) {
    return false;
  }
  if (document.owner_user_id && document.owner_user_id !== access.owner_user_id) {
    return false;
  }
  return Boolean(access.admin || access.owner_user_id || access.company_account_id);
}

export function validateVectorSearchInput(input: VectorSearchInput): readonly string[] {
  const issues: string[] = [];
  if (!input.query.trim()) {
    issues.push("Search query is required.");
  }
  if (input.limit < 1 || input.limit > 25) {
    issues.push("Vector search limit must be between 1 and 25.");
  }
  if (!input.accessScope.admin && !input.accessScope.owner_user_id && !input.accessScope.company_account_id) {
    issues.push("Vector search requires a user, company account, or admin scope.");
  }
  return Object.freeze(issues);
}

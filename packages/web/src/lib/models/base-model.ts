export type AccessScope = "public" | "owner" | "company_account" | "admin";

export type BaseModel = Readonly<{
  id: string;
  owner_user_id?: string;
  company_account_id?: string;
  created_at: string;
  updated_at: string;
  access_scope: AccessScope;
}>;

export type ModelContract<TTable extends string> = Readonly<{
  table: TTable;
  requiresOrganizationScope: boolean;
  validation: readonly string[];
}>;

export function modelContract<TTable extends string>(
  table: TTable,
  validation: readonly string[],
  requiresOrganizationScope = true
): ModelContract<TTable> {
  return Object.freeze({
    table,
    requiresOrganizationScope,
    validation: Object.freeze([...validation])
  });
}

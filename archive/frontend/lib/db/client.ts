import "server-only";
import { getSupabaseAdminClient } from "../supabaseAdmin";
import type { DbOpsResult } from "../../types/databaseOps";

type SupabaseErrorLike = {
  message?: string;
};

type SupabaseSingleResult<T> = Promise<{
  data: T | null;
  error: SupabaseErrorLike | null;
}>;

type SelectSingleBuilder<T> = {
  single(): SupabaseSingleResult<T>;
};

type SelectBuilder<T> = {
  select(columns?: string): SelectSingleBuilder<T>;
};

type UpdateFilterBuilder<T> = {
  eq(column: string, value: string): SelectBuilder<T>;
};

type OpsTable = {
  insert<T>(payload: unknown): SelectBuilder<T>;
  update<T>(payload: unknown): UpdateFilterBuilder<T>;
};

type OpsClient = {
  from(table: string): OpsTable;
};

export function getOpsClient() {
  return getSupabaseAdminClient() as unknown as OpsClient | null;
}

export function normalizeSupabaseError(error: SupabaseErrorLike | null | undefined) {
  return error?.message ?? "Unknown Supabase operation error";
}

export function notConfiguredResult<T>(): DbOpsResult<T> {
  return { ok: false, skipped: "supabase_admin_not_configured" };
}

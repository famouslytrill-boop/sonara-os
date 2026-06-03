export const migrationSafetyChecklist = [
  "append_only",
  "no_duplicate_timestamps",
  "rls_enabled",
  "no_destructive_drop_without_review",
  "policy_tables_exist_before_reference",
  "backup_or_rollback_notes"
] as const;
export function evaluateMigrationPlan(items: string[]) {
  const missing = migrationSafetyChecklist.filter((item) => !items.includes(item));
  return { allowed: missing.length === 0, missing };
}

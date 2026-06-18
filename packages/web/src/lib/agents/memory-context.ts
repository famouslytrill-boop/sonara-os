export type AgentMemoryEntry = Readonly<{
  id: string;
  owner_user_id: string;
  company_account_id: string;
  namespace: "agent_memory" | "support_knowledge" | "admin_docs";
  summary: string;
  sensitivity: "low" | "standard" | "restricted";
  source: "user_input" | "document" | "admin_note" | "system";
  created_at: string;
}>;

export function canReadAgentMemory(
  entry: AgentMemoryEntry,
  access: { owner_user_id?: string; company_account_id?: string; admin?: boolean }
): boolean {
  if (access.admin && entry.namespace === "admin_docs") {
    return true;
  }
  return (
    entry.owner_user_id === access.owner_user_id &&
    entry.company_account_id === access.company_account_id
  );
}

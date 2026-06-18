import { modelContract, type BaseModel } from "./base-model.ts";

export type KnowledgeEntryModel = BaseModel & Readonly<{
  namespace: "business_builder_knowledge" | "creator_studio_assets" | "growth_studio_campaigns" | "agent_memory" | "support_knowledge" | "admin_docs";
  title: string;
  review_status: "draft" | "reviewed" | "blocked";
}>;

export const knowledgeEntryModel = modelContract("knowledge_entries", [
  "namespace determines product and access boundary",
  "private entries require owner_user_id or company_account_id",
  "embeddings and private chunks are never public"
]);

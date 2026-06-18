export type VectorNamespace =
  | "business_builder_knowledge"
  | "creator_studio_assets"
  | "growth_studio_campaigns"
  | "agent_memory"
  | "support_knowledge"
  | "admin_docs";

export type AccessScope = Readonly<{
  owner_user_id?: string;
  company_account_id?: string;
  admin: boolean;
}>;

export type EmbeddingMetadata = Readonly<{
  source_id: string;
  source_type: "document" | "asset" | "campaign" | "agent_memory" | "support_article";
  review_status: "draft" | "reviewed" | "blocked";
  secrets_stored: false;
}>;

export type VectorDocument = Readonly<{
  id: string;
  namespace: VectorNamespace;
  content: string;
  owner_user_id?: string;
  company_account_id?: string;
  metadata: EmbeddingMetadata;
  created_at: string;
}>;

export type VectorSearchResult = Readonly<{
  document: VectorDocument;
  score: number;
  access_granted: boolean;
}>;

export type VectorSearchInput = Readonly<{
  namespace: VectorNamespace;
  query: string;
  accessScope: AccessScope;
  limit: number;
}>;

export type VectorProvider = Readonly<{
  id: string;
  label: string;
  productionPreferred: boolean;
  enabledByDefault: boolean;
  indexDocument(document: VectorDocument): Promise<"queued" | "disabled">;
  search(input: VectorSearchInput): Promise<readonly VectorSearchResult[]>;
}>;

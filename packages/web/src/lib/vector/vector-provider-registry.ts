export type VectorProviderRecord = Readonly<{
  id: string;
  label: string;
  license: string;
  status: "high_value_candidate" | "future_enterprise_candidate" | "review_required";
  productionIntegrated: false;
}>;

export const vectorProviderRegistry: readonly VectorProviderRecord[] = Object.freeze([
  provider("qdrant", "Qdrant", "Apache-2.0", "high_value_candidate"),
  provider("milvus", "Milvus", "Apache-2.0", "future_enterprise_candidate")
]);

function provider(
  id: string,
  label: string,
  license: string,
  status: VectorProviderRecord["status"]
): VectorProviderRecord {
  return Object.freeze({ id, label, license, status, productionIntegrated: false });
}

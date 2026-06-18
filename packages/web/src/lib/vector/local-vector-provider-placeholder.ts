import type { VectorProvider } from "./vector-types.ts";

export const localVectorProviderPlaceholder: VectorProvider = Object.freeze({
  id: "local_vector_disabled",
  label: "Local vector engine placeholder",
  productionPreferred: false,
  enabledByDefault: false,
  async indexDocument(): Promise<"disabled"> {
    return "disabled";
  },
  async search() {
    return Object.freeze([]);
  }
});

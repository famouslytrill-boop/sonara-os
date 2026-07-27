import { wordSourcePolicy } from "../wordSourcePolicy";

export function getUrbanDictionaryPolicyAdapter() {
  return {
    status: "manual_review_required" as const,
    warning: wordSourcePolicy.urbanDictionaryWarning,
  };
}

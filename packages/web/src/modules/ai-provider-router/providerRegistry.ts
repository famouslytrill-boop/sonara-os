import type { AIProvider } from "./contracts.ts";
export const officialProviderRegistry: AIProvider[] = [
  {
    id: "official-api-placeholder",
    officialApi: true,
    commercialUseAllowed: true,
    allowedTasks: ["support_draft", "summarize"],
    privacyLevel: "private"
  }
];

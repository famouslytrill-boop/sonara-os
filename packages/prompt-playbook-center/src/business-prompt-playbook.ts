import { getPromptTemplatesByProductArea } from "./prompt-template-registry.ts";

export function createBusinessPromptPlaybook() {
  return getPromptTemplatesByProductArea("business-builder");
}

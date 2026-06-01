import { getPromptTemplatesByProductArea } from "./prompt-template-registry.ts";

export function createGrowthPromptPlaybook() {
  return getPromptTemplatesByProductArea("growth-studio");
}

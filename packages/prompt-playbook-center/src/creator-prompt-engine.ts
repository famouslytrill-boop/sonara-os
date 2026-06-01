import { getPromptTemplatesByProductArea } from "./prompt-template-registry.ts";

export function createCreatorPromptPlaybook() {
  return getPromptTemplatesByProductArea("creator-studio");
}

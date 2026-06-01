import { promptTemplateRegistry } from "./prompt-template-registry.ts";

const adminProductAreas: readonly string[] = Object.freeze([
  "admin-command-center",
  "security-center",
  "reliability-center",
  "support",
  "billing"
]);

export function createAdminPromptPlaybook() {
  return promptTemplateRegistry.filter((template) =>
    adminProductAreas.includes(template.product_area)
  );
}

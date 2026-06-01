export const finalExportTiers = Object.freeze([
  "prompt_bundle",
  "production_bundle",
  "daw_bundle",
  "release_bundle",
  "elite_mutation_bundle"
] as const);

export type ProductExportTier = (typeof finalExportTiers)[number];

export const exportTierLabels: Readonly<Record<ProductExportTier, string>> = Object.freeze({
  prompt_bundle: "Prompt Bundle",
  production_bundle: "Production Bundle",
  daw_bundle: "DAW Bundle",
  release_bundle: "Release Bundle",
  elite_mutation_bundle: "Elite Mutation Bundle"
});

export function isFinalExportTier(value: string): value is ProductExportTier {
  return finalExportTiers.includes(value as ProductExportTier);
}

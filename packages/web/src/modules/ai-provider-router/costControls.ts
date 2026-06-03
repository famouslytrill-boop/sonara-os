export function estimateProviderCost(tokens: number, centsPerThousand: number) {
  return Math.ceil((tokens / 1000) * centsPerThousand);
}

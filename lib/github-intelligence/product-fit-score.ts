export function productFitScore(productFit: string[]) {
  return Math.min(100, productFit.length * 20 + (productFit.includes("Shared SONARA Infrastructure") ? 20 : 0));
}

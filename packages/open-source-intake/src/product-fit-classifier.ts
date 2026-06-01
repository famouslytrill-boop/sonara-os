import type { OpenSourceProductFit, OpenSourceProjectRecord } from "./types.ts";

export function hasProductFit(
  project: Pick<OpenSourceProjectRecord, "productFit">,
  fit: OpenSourceProductFit
): boolean {
  return project.productFit.some((item) => item.toLowerCase() === fit.toLowerCase());
}

export function summarizeProductFit(project: Pick<OpenSourceProjectRecord, "productFit">): string {
  return project.productFit.length > 0 ? project.productFit.join(", ") : "No production fit";
}

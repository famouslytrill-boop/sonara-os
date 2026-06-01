export function normalizeLicense(input: string | null | undefined) {
  const value = (input ?? "unknown").toLowerCase();
  if (value.includes("apache")) return "Apache-2.0";
  if (value.includes("mit")) return "MIT";
  if (value.includes("bsd")) return "BSD";
  if (value.includes("agpl")) return "AGPL-review-required";
  if (value.includes("gpl")) return "GPL-review-required";
  if (value.includes("non-commercial")) return "blocked-non-commercial";
  return "unknown-review-required";
}

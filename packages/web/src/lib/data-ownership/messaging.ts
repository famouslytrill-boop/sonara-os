export type DataOwnershipSection = Readonly<{
  title: string;
  body: string;
}>;

export const dataOwnershipSections: readonly DataOwnershipSection[] = Object.freeze([
  section(
    "Own your customer records",
    "Keep customer and guest history organized under your business account instead of scattering it across disconnected notes."
  ),
  section(
    "Export your business data",
    "Use structured records so future exports, audits, and migrations have a clean source to work from."
  ),
  section(
    "Track campaign results transparently",
    "Record campaign decisions and outcomes as reviewable notes without fake metrics or hidden tracking."
  ),
  section(
    "Keep business memory under your account",
    "Business context, customer notes, and launch decisions should stay scoped to the owner and company account."
  )
]);

export function getDataOwnershipSections(product: "business_builder" | "growth_studio") {
  return product === "business_builder"
    ? dataOwnershipSections.slice(0, 3)
    : dataOwnershipSections.slice(1);
}

function section(title: string, body: string): DataOwnershipSection {
  return Object.freeze({ title, body });
}

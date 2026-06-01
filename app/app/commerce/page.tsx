import { ReadinessAppPage } from "@/components/ReadinessAppPage";

export default function CommercePage() {
  return (
    <ReadinessAppPage
      title="Commerce Planning"
      description="Commerce provider planning for product catalogs, payment links, and provider-backed checkout. No custody of funds or direct card handling."
      cards={[
        { title: "Provider backed", body: "Use approved hosted providers before custom commerce execution.", status: "Setup gated" },
        { title: "No direct card handling", body: "Card numbers, CVV, and raw bank credentials are blocked.", status: "Blocked" },
      ]}
    />
  );
}

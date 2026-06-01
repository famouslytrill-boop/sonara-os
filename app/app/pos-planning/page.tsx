import { ReadinessAppPage } from "@/components/ReadinessAppPage";

export default function PosPlanningPage() {
  return (
    <ReadinessAppPage
      title="POS Planning"
      description="POS and tap-to-pay planning for future approved providers. This page does not process live payments."
      cards={[
        { title: "Reference only", body: "Square, Stripe, PayPal, and ERP/POS references require approval before integration.", status: "Review" },
        { title: "Receipts and disputes", body: "Refund, receipt, and dispute workflows must be provider-backed and audited.", status: "Planned" },
      ]}
    />
  );
}

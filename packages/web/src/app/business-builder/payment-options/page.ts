import { renderMoneyAdjacentPage } from "../../money-adjacent-page.ts";

export function renderBusinessPaymentOptionsPage() {
  return renderMoneyAdjacentPage({
    kicker: "Business Builder",
    title: "Payment Options",
    description:
      "Create safe external payment option records for provider-hosted checkout, invoices, deposits, and manual payment URLs.",
    productArea: "business_builder",
    sections: ["payments"]
  });
}

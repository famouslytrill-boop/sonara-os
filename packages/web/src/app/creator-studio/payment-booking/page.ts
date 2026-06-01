import { renderMoneyAdjacentPage } from "../../money-adjacent-page.ts";

export function renderCreatorPaymentBookingPage() {
  return renderMoneyAdjacentPage({
    kicker: "Creator Studio",
    title: "Payment & Booking Links",
    description:
      "Create local setup records for provider-hosted payment links and owner-reviewed booking options.",
    productArea: "creator_studio",
    sections: ["payments", "bookings"]
  });
}

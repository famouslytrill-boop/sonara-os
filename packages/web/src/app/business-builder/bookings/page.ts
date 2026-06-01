import { renderMoneyAdjacentPage } from "../../money-adjacent-page.ts";

export function renderBusinessBookingsPage() {
  return renderMoneyAdjacentPage({
    kicker: "Business Builder",
    title: "Booking Links",
    description:
      "Create booking records for external booking URLs, call-to-book flows, and owner-reviewed appointment requests.",
    productArea: "business_builder",
    sections: ["bookings"]
  });
}

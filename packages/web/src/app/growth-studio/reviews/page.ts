import { renderMoneyAdjacentPage } from "../../money-adjacent-page.ts";

export function renderGrowthReviewsPage() {
  return renderMoneyAdjacentPage({
    kicker: "Growth Studio",
    title: "Reviews",
    description:
      "Create review request and testimonial records for owner-reviewed trust building. Nothing publishes automatically.",
    productArea: "growth_studio",
    sections: ["reviews"]
  });
}

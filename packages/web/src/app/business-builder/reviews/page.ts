import { renderMoneyAdjacentPage } from "../../money-adjacent-page.ts";

export function renderBusinessReviewsPage() {
  return renderMoneyAdjacentPage({
    kicker: "Business Builder",
    title: "Reviews",
    description:
      "Create review request links, review source records, and testimonial drafts with owner moderation.",
    productArea: "business_builder",
    sections: ["reviews"]
  });
}

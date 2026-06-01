export type BusinessUseCase = {
  slug: string;
  name: string;
  summary: string;
  tools: string[];
};

export const businessUseCases: BusinessUseCase[] = [
  { slug: "restaurants", name: "Restaurants", summary: "Menus, bookings, QR pages, offers, reviews, and customer follow-up.", tools: ["service menu", "booking", "reviews", "QR pages"] },
  { slug: "food-trucks", name: "Food trucks", summary: "Location notes, menus, announcements, payment links, and event planning.", tools: ["announcements", "payment links", "events", "support inbox"] },
  { slug: "salons-barbers", name: "Salons and barbers", summary: "Bookings, service menus, client records, reviews, and referrals.", tools: ["booking", "customer records", "service menu", "referrals"] },
  { slug: "cleaning-services", name: "Cleaning services", summary: "Quotes, intake forms, service areas, scheduling, and proof profiles.", tools: ["quote request", "intake forms", "scheduling", "proof profile"] },
  { slug: "contractors", name: "Contractors", summary: "Quote requests, files, customer records, scheduling, and launch checklists.", tools: ["quotes", "files", "customer records", "task board"] },
  { slug: "consultants", name: "Consultants", summary: "Offer pages, bookings, proof, files, and lightweight CRM workflows.", tools: ["offer builder", "booking", "files", "CRM"] },
  { slug: "creators", name: "Creators", summary: "Creator proof, asset records, offers, launches, and monetization paths.", tools: ["proof profile", "asset vault", "offers", "launch checklist"] },
  { slug: "agencies", name: "Agencies", summary: "Client workspaces, permissions, campaigns, support, and reporting.", tools: ["client workspaces", "permissions", "campaigns", "reports"] },
];

export function getBusinessUseCase(slug: string) {
  return businessUseCases.find((useCase) => useCase.slug === slug);
}

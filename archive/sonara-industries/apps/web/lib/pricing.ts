export const pricing = {
  trackfoundry: [
    { name: "Free", price: "$0", features: ["Limited projects", "Basic readiness checklist", "Limited uploads"] },
    { name: "Creator", price: "Affordable monthly", features: ["Music projects", "Audio/video intake", "Transcription placeholders", "Release readiness"] },
    { name: "Studio", price: "Studio monthly", features: ["Team collaboration", "Catalog management", "Anti-repetition checks", "Media preparation"] },
  ],
  lineready: [
    { name: "Starter", price: "$39/month", features: ["Single restaurant/location", "Recipe costing", "QR links", "Basic vendor links"] },
    { name: "Pro", price: "$99/month", features: ["Labor", "Scheduling", "Recipes", "Vendors", "Repairs", "Staff profiles"] },
    { name: "Multi-Location", price: "$299/month", features: ["Multiple locations", "Manager roles", "Advanced analytics", "External links"] },
  ],
  noticegrid: [
    { name: "Starter", price: "$19/month", features: ["Small organization alert page", "Source links", "Approval-gated posts"] },
    { name: "Org", price: "$99/month", features: ["Nonprofits, libraries, local teams", "Imports", "Broadcast drafts"] },
    { name: "City/Enterprise", price: "Custom", features: ["Public-sector style workflow", "Approval queue", "Connectors"] },
  ]
} as const;

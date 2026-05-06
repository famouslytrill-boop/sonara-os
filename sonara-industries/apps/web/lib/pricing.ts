export const pricing = {
  sonara_one: [
    { name: "Free", price: "$0", features: ["3 projects", "Basic prompt builder", "Basic catalog vault", "Limited exports"] },
    { name: "Creator", price: "$19/month", features: ["More projects", "Audio/video transcription", "Export bundles", "Release-readiness checklist"] },
    { name: "Pro", price: "$49/month", features: ["Larger catalog", "Advanced Artist Genome", "Anti-Repetition Engine", "DAW export prep"] },
    { name: "Label", price: "$199/month", features: ["Team workspaces", "Release planning", "Brand/campaign systems", "Audit history"] },
    { name: "Enterprise", price: "Custom", features: ["Security review", "Custom workflow", "Priority support"] }
  ],
  tableops: [
    { name: "Free", price: "$0", features: ["1 location", "Basic recipe vault", "Limited QR menu"] },
    { name: "Starter", price: "$39/month", features: ["Recipe costing", "Prep lists", "Staff training"] },
    { name: "Kitchen Pro", price: "$99/month", features: ["Food cost engine", "Supplier notes", "Training vault", "Shift command"] },
    { name: "Multi-location", price: "$299/month", features: ["Multi-location dashboards", "Team permissions", "Inventory signals"] },
    { name: "Enterprise", price: "Custom", features: ["Franchise controls", "Custom integrations", "Procurement support"] }
  ],
  civic_signal: [
    { name: "Public", price: "$0", features: ["Local public feed", "Public search", "Source links"] },
    { name: "Community", price: "$19/month", features: ["Organization profile", "Announcements", "Public links"] },
    { name: "Nonprofit/Library", price: "$99/month", features: ["Document imports", "Event feeds", "Broadcast posts"] },
    { name: "Public Access", price: "$399/month", features: ["Feed management", "Local broadcast tools", "Transcript archive", "Team roles"] },
    { name: "Enterprise/Municipal", price: "Custom", features: ["Partner verification", "Governance workflows", "Advanced reporting"] }
  ]
} as const;


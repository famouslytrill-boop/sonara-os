export type SubAppRegistryRecord = {
  key: string;
  label: string;
  ownerProduct: "Business Builder" | "Creator Studio" | "Growth Studio";
  productionReady: boolean;
  requiredReview: string[];
};

export const subAppRegistry: SubAppRegistryRecord[] = [
  {
    key: "business-contact-intake",
    label: "Business contact and intake sub-app",
    ownerProduct: "Business Builder",
    productionReady: false,
    requiredReview: ["RLS", "support email provider", "tenant-scoped storage"],
  },
  {
    key: "creator-asset-vault",
    label: "Creator asset vault",
    ownerProduct: "Creator Studio",
    productionReady: false,
    requiredReview: ["storage policy", "rights review", "publish approval"],
  },
  {
    key: "growth-campaign-planner",
    label: "Growth campaign planner",
    ownerProduct: "Growth Studio",
    productionReady: false,
    requiredReview: ["anti-spam policy", "provider setup", "human approval"],
  },
];

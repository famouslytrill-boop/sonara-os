import type { SonaraProductId } from "./types.ts";

export interface ProductRegistryItem {
  id: SonaraProductId;
  publicName: string;
  purpose: string;
}

export const productRegistry: ProductRegistryItem[] = [
  {
    id: "business_builder",
    publicName: "Business Builder",
    purpose: "Execution foundation for owners, operators, and teams."
  },
  {
    id: "creator_studio",
    publicName: "Creator Studio",
    purpose: "Portfolio, offer, asset, and client workflow foundation."
  },
  {
    id: "growth_studio",
    publicName: "Growth Studio",
    purpose: "Campaign, retention, referral, and conversion planning foundation."
  }
];

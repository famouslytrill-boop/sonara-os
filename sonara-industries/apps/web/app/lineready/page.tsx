import type { Metadata } from "next";
import { ChildBrandLandingPage } from "@/components/sonara/ChildBrandMarketingPage";

export const metadata: Metadata = {
  title: "LineReady | Every shift ready.",
  description: "Restaurant operations and labor-control software for restaurant owners, chefs, managers, food trucks, caterers, hospitality groups, and small franchises.",
};

export default function Page() {
  return <ChildBrandLandingPage brandKey="lineready" />;
}

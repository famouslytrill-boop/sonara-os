import type { Metadata } from "next";
import { ChildBrandLandingPage } from "@/components/sonara/ChildBrandMarketingPage";

export const metadata: Metadata = {
  title: "NoticeGrid | Local updates without the noise.",
  description: "Verified local information and public-notice software for residents, libraries, schools, nonprofits, local businesses, city offices, and community organizations.",
};

export default function Page() {
  return <ChildBrandLandingPage brandKey="noticegrid" />;
}

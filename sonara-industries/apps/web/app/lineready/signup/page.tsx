import type { Metadata } from "next";
import { ChildBrandSignupPage } from "@/components/sonara/ChildBrandSignupPage";

export const metadata: Metadata = {
  title: "Start LineReady",
  description: "Request early access to LineReady.",
};

export default function Page() {
  return <ChildBrandSignupPage brandKey="lineready" />;
}

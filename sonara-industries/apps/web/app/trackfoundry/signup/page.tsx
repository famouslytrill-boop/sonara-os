import type { Metadata } from "next";
import { ChildBrandSignupPage } from "@/components/sonara/ChildBrandSignupPage";

export const metadata: Metadata = {
  title: "Start TrackFoundry",
  description: "Request early access to TrackFoundry.",
};

export default function Page() {
  return <ChildBrandSignupPage brandKey="trackfoundry" />;
}

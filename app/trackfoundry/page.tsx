import type { Metadata } from "next";
import { ChildBrandLandingPage } from "../../components/ChildBrandMarketingPage";

export const metadata: Metadata = {
  title: "TrackFoundry | Build the artist. Shape the release.",
  description: "Music creation and release-readiness software for independent artists, producers, labels, studios, managers, and creators.",
};

export default function Page() {
  return <ChildBrandLandingPage brandKey="trackfoundry" />;
}

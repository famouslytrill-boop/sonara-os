import type { Metadata } from "next";
import { ProductLandingPage } from "../../components/ProductLandingPage";
import { PublicShell } from "../../components/PublicShell";
import { sonaraProducts } from "../../lib/houseBrands";

export const metadata: Metadata = {
  title: "Creator Studio",
  description:
    "Organize, protect, publish, monetize, and grow creative work, digital products, media, and creator operations.",
};

const sections = [
  {
    title: "Creator workspace",
    body: "Creator Studio organizes assets, releases, offers, proof, media records, and monetization tasks without pretending rights or licensing are automatically cleared.",
  },
  {
    title: "IP and asset records",
    body: "Asset Vault and rights notes help creators keep ownership, license, source, and usage context visible before publishing or selling creative work.",
  },
  {
    title: "Launch planning",
    body: "Release planning, content calendars, offer builder, and proof cards create a repeatable launch workflow with human approval on public-facing outputs.",
  },
  {
    title: "Monetization",
    body: "Creator offers, payment/booking links, and growth links can be prepared safely. Checkout remains setup-gated until Stripe configuration is verified.",
  },
  {
    title: "Collaboration",
    body: "Project rooms and review-ready records are designed for teams while keeping private files and customer data protected.",
  },
  {
    title: "Rights and licensing warnings",
    body: "No public page claims ownership, rights clearance, celebrity likeness permission, or commercial safety without user-provided evidence and review.",
  },
];

export default function CreatorStudioPage() {
  return (
    <PublicShell>
      <ProductLandingPage product={sonaraProducts.creatorStudio} sections={sections} />
    </PublicShell>
  );
}

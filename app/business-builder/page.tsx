import type { Metadata } from "next";
import { ProductLandingPage } from "../../components/ProductLandingPage";
import { PublicShell } from "../../components/PublicShell";
import { sonaraProducts } from "../../lib/houseBrands";

export const metadata: Metadata = {
  title: "Business Builder",
  description:
    "Create, launch, run, and manage a business with guided systems, payments, bookings, records, and operational intelligence.",
};

const sections = [
  {
    title: "Problem it solves",
    body: "Business owners often piece together proof, payments, bookings, files, reviews, and records across disconnected tools. Business Builder gives the launch path a clear operating surface.",
  },
  {
    title: "Setup flow",
    body: "Start with a business profile, add payment and booking paths, create offers, collect customer records, and keep the next recommended setup step visible.",
  },
  {
    title: "Daily dashboard",
    body: "Use setup progress, alerts, customer follow-up drafts, money-path events, trust status, and product shortcuts without fake metrics.",
  },
  {
    title: "Records and documents",
    body: "Keep customer records, files, quotes, bookings, payment options, reviews, training notes, and SOPs organization-scoped and private by default.",
  },
  {
    title: "Bookings and customers",
    body: "Organize booking links, customer records, source notes, tags, contact preferences, and follow-up drafts without sending customer-facing messages automatically.",
  },
  {
    title: "Staff and access",
    body: "Access Control keeps owner, admin, member, and viewer permissions explicit. Role changes and security-sensitive controls require review before they affect the workspace.",
  },
  {
    title: "Payments and quotes",
    body: "Use Stripe-hosted checkout, payment links, and external payment URLs. The app does not store raw card data or take custody of funds.",
  },
  {
    title: "Trust and audit trail",
    body: "Sensitive actions are designed for approval and audit logging before they affect customers, public pages, payment settings, or security controls.",
  },
];

export default function BusinessBuilderPage() {
  return (
    <PublicShell>
      <ProductLandingPage product={sonaraProducts.businessBuilder} sections={sections} />
    </PublicShell>
  );
}

import type { Metadata } from "next";
import { ProductLandingPage } from "../../components/ProductLandingPage";
import { PublicShell } from "../../components/PublicShell";
import { sonaraProducts } from "../../lib/houseBrands";

export const metadata: Metadata = {
  title: "Growth Studio",
  description:
    "Attract customers, leads, fans, referrals, reviews, and revenue through campaigns, follow-up, offers, and growth systems.",
};

const sections = [
  {
    title: "Campaign engine",
    body: "Plan campaigns, offers, review requests, referral prompts, and win-back drafts without auto-sending messages or using deceptive urgency.",
  },
  {
    title: "Lead and customer flow",
    body: "Growth work connects to safe customer records and permission-aware follow-up drafts. Opt-out and unknown permission states block sends.",
  },
  {
    title: "Reviews and referrals",
    body: "Review requests and referral campaigns are drafted for owner approval. No fake testimonials, fake customers, or fake logos are used.",
  },
  {
    title: "Market research",
    body: "Research Lab and Trend Radar are planning surfaces. They do not guarantee growth, customers, ranking, revenue, or market demand.",
  },
  {
    title: "Analytics",
    body: "Dashboards show setup and operational readiness first. Revenue totals only appear after real payment data is configured and available.",
  },
  {
    title: "Creator-to-business preview",
    body: "Marketplace-style workflows remain preview-only until payment, legal, support, and trust review are complete.",
  },
];

export default function GrowthStudioPage() {
  return (
    <PublicShell>
      <ProductLandingPage product={sonaraProducts.growthStudio} sections={sections} />
    </PublicShell>
  );
}

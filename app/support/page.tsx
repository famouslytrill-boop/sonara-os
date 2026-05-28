import type { Metadata } from "next";
import { PublicShell } from "../../components/PublicShell";
import { SupportCategoryCard } from "../../components/support/SupportCategoryCard";
import { SupportFAQ } from "../../components/support/SupportFAQ";

export const metadata: Metadata = {
  title: "Support Center",
  description: "SONARA Industries support center for product, billing, account, security, and beta feedback paths.",
};

const supportCards = [
  { title: "Getting Started", description: "Set up the public profile, choose a product path, and understand beta limits.", href: "/help" },
  { title: "Account & Login", description: "Account access, login readiness, roles, and workspace basics.", href: "/contact" },
  { title: "Billing & Refunds", description: "Pricing, checkout status, setup services, refund questions, and billing terms.", href: "/legal/refund-policy" },
  { title: "Business Builder", description: "Business profile, payment links, bookings, records, reviews, and launch tasks.", href: "/business-builder" },
  { title: "Creator Studio", description: "Creator proof, assets, rights notes, release planning, and creator tooling.", href: "/creator-studio" },
  { title: "Growth Studio", description: "Campaign drafts, reviews, referrals, research notes, and growth suggestions.", href: "/growth-studio" },
  { title: "Research Lab", description: "Open-source watchlist, model comparison, crawling policy, and safety review.", href: "/research-lab" },
  { title: "Security & Privacy", description: "Report security concerns, privacy requests, and sensitive data routing issues.", href: "/trust" },
  { title: "Report a Bug", description: "Send a specific bug report with page, device, browser, and reproduction notes.", href: "/feedback" },
  { title: "Request a Feature", description: "Share what workflow is missing and why it matters for your launch path.", href: "/feedback" },
];

export default function SupportPage() {
  return (
    <PublicShell>
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#2DD4BF]">Support Center</p>
        <h1 className="mt-3 max-w-4xl text-4xl font-black text-white">Find the right SONARA support path.</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[#CBD5E1]">
          Support is structured for beta clarity. The platform can validate and queue support requests, but it will not
          perform refunds, legal changes, security changes, or customer-facing actions automatically.
        </p>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {supportCards.map((card) => (
          <SupportCategoryCard key={card.title} {...card} />
        ))}
      </section>

      <section className="mt-6">
        <SupportFAQ />
      </section>
    </PublicShell>
  );
}

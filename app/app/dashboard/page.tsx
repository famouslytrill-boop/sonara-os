import Link from "next/link";
import { AppDashboardShell } from "../../../components/AppDashboardShell";

const dashboardCards = [
  {
    title: "Setup progress",
    body: "Start with product path selection, profile basics, payment readiness, booking links, and review-safe follow-up.",
    href: "/onboarding",
  },
  {
    title: "Next best steps",
    body: "Recommendations stay draft-only until the owner approves customer-facing or risky actions.",
    href: "/app/research",
  },
  {
    title: "Product shortcuts",
    body: "Open Business Builder, Creator Studio, or Growth Studio without mixing product-specific workflows.",
    href: "/app/business-builder",
  },
  {
    title: "Trust status",
    body: "Security, approval, payment, and legal-readiness checks remain setup-gated until real providers are configured.",
    href: "/trust",
  },
  {
    title: "Payment readiness",
    body: "Stripe checkout and customer portal stay blocked until server-side env vars and webhook verification are complete.",
    href: "/app/settings/billing",
  },
  {
    title: "Research watchlist",
    body: "Review open-source and external-tool candidates before adoption. No blind installs or copied code.",
    href: "/research-lab/open-source",
  },
] as const;

export default function AppDashboardPage() {
  return (
    <AppDashboardShell title="Dashboard">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {dashboardCards.map((card) => (
          <Link key={card.title} href={card.href} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 hover:border-[#2DD4BF]">
            <p className="text-sm font-black text-white">{card.title}</p>
            <p className="mt-2 text-sm leading-6 text-[#CBD5E1]">{card.body}</p>
          </Link>
        ))}
      </section>
    </AppDashboardShell>
  );
}

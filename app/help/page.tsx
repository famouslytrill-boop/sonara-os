import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "../../components/PublicShell";

export const metadata: Metadata = {
  title: "Help",
  description: "SONARA Industries help index for support, contact, pricing, legal, trust, and open-source pages.",
};

const helpLinks = [
  { label: "Support Center", href: "/support", description: "Find the right product or account support path." },
  { label: "Contact", href: "/contact", description: "Send a general, billing, technical, security, legal, privacy, or partnership request." },
  { label: "Pricing", href: "/pricing", description: "Review free and paid plan structure, setup services, and provider-cost notes." },
  { label: "Terms", href: "/legal/terms", description: "Review-ready terms template for attorney review." },
  { label: "Privacy", href: "/legal/privacy", description: "Data handling, provider, support, and deletion-request draft language." },
  { label: "Refund Policy", href: "/legal/refund-policy", description: "Subscription, setup-service, refund, and dispute handling draft." },
  { label: "Trust", href: "/trust", description: "Security, approval, billing, and reliability posture." },
  { label: "Research Lab", href: "/research-lab", description: "Open-source intelligence, creator tooling, model comparison, and safety review." },
  { label: "Open Source", href: "/open-source", description: "Open-source promise, license review posture, and third-party notices." },
];

export default function HelpPage() {
  return (
    <PublicShell>
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#2DD4BF]">Help</p>
        <h1 className="mt-3 max-w-4xl text-4xl font-black text-white">Help index</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[#CBD5E1]">
          Start here for support, contact, pricing, legal, trust, and open-source information. These pages are designed
          for beta clarity and human review where needed.
        </p>
      </section>
      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        {helpLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-2xl border border-white/10 bg-[#081827] p-5 transition hover:border-[#2DD4BF]/60 focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]"
          >
            <h2 className="text-lg font-black text-white">{link.label}</h2>
            <p className="mt-3 text-sm leading-6 text-[#CBD5E1]">{link.description}</p>
          </Link>
        ))}
      </section>
    </PublicShell>
  );
}

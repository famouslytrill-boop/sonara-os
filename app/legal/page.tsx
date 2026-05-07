import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "../../components/PublicShell";

export const metadata: Metadata = {
  title: "Legal Center",
  description:
    "Legal, privacy, terms, and safety boundaries for SONARA Industries and its independent child companies.",
};

const legalLinks = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Trust", href: "/trust" },
  { label: "Support", href: "/support" },
  { label: "Contact", href: "/contact" },
];

export default function LegalPage() {
  return (
    <PublicShell>
      <section className="rounded-3xl border border-[#1F2937] bg-[#111827] p-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#00E5FF]">
          Legal center
        </p>
        <h1 className="mt-3 max-w-3xl text-4xl font-black text-white">
          Launch boundaries for SONARA Industries.
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[#C4BFD0]">
          These public templates explain privacy, terms, trust, support, and
          approval boundaries. They must be reviewed by qualified counsel before
          paid users, uploads, public notices, or production billing go live.
        </p>
      </section>
      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {legalLinks.map((item) => (
          <Link
            className="rounded-2xl border border-[#1F2937] bg-[#111827] p-4 text-sm font-black text-white transition hover:-translate-y-0.5 hover:border-[#00E5FF]"
            href={item.href}
            key={item.href}
          >
            {item.label}
          </Link>
        ))}
      </section>
    </PublicShell>
  );
}

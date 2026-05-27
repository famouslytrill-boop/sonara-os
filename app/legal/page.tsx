import Link from "next/link";
import type { Metadata } from "next";
import { PublicShell } from "../../components/PublicShell";

export const metadata: Metadata = {
  title: "Legal Center",
  description: "Review-ready legal and policy templates for SONARA Industries.",
};

const legalLinks = [
  ["Terms", "/legal/terms"],
  ["Privacy", "/legal/privacy"],
  ["Refund Policy", "/legal/refund-policy"],
  ["Acceptable Use", "/legal/acceptable-use"],
  ["Cookie Policy", "/legal/cookie-policy"],
  ["Accessibility", "/legal/accessibility"],
  ["Security", "/legal/security"],
  ["Data Processing Addendum", "/legal/data-processing-addendum"],
  ["Subprocessors", "/legal/subprocessors"],
  ["AI Usage", "/legal/ai-usage"],
  ["Billing Terms", "/legal/billing-terms"],
  ["Service Levels", "/legal/service-levels"],
] as const;

export default function LegalPage() {
  return (
    <PublicShell>
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#2DD4BF]">Legal center</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-black text-white">Review-ready policy templates.</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[#CBD5E1]">
          These pages are launch scaffolds for attorney review. They do not claim guaranteed legal compliance and do not
          replace legal, tax, financial, medical, or security advice.
        </p>
      </section>
      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {legalLinks.map(([label, href]) => (
          <Link
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm font-black text-white transition hover:-translate-y-0.5 hover:border-[#2DD4BF]"
            href={href}
            key={href}
          >
            {label}
          </Link>
        ))}
      </section>
    </PublicShell>
  );
}

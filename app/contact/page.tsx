import type { Metadata } from "next";
import { ContactForm } from "../../components/support/ContactForm";
import { PublicShell } from "../../components/PublicShell";
import { contactCategories } from "../../lib/support/contact-schema";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact SONARA Industries for general, billing, technical, security, legal, privacy, and partnership requests.",
};

export default function ContactPage() {
  const contactLabel = process.env.NEXT_PUBLIC_SUPPORT_CONTACT_LABEL || "your account or project settings";

  return (
    <PublicShell>
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#2DD4BF]">Contact</p>
        <h1 className="mt-3 max-w-4xl text-4xl font-black text-white">Contact SONARA Industries</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[#CBD5E1]">
          Use this page for general questions, partnerships, billing questions, support, security reports, and legal or
          privacy requests. We aim to respond within 1-2 business days during beta.
        </p>
        <p className="mt-4 max-w-3xl rounded-2xl border border-white/10 bg-[#081827] p-4 text-sm leading-6 text-[#CBD5E1]">
          If the form is unavailable, contact support through the email listed in {contactLabel}. Do not submit
          passwords, card numbers, payout details, API keys, private customer data, or legal documents through public
          forms.
        </p>
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {contactCategories.map((category) => (
          <div key={category.value} className="rounded-2xl border border-white/10 bg-[#081827] p-4 text-sm font-black text-white">
            {category.label}
          </div>
        ))}
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-3xl border border-white/10 bg-[#081827] p-6">
          <h2 className="text-2xl font-black text-white">Before you submit</h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-[#CBD5E1]">
            <p>Support forms validate requests and may store them if Supabase is configured.</p>
            <p>Email delivery is optional and remains disabled unless a reviewed provider adapter is configured.</p>
            <p>High-risk requests do not trigger refunds, legal changes, security changes, or customer-facing actions automatically.</p>
          </div>
        </div>
        <ContactForm sourcePath="/contact" />
      </section>
    </PublicShell>
  );
}

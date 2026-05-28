import type { Metadata } from "next";
import { FeedbackForm } from "../../components/support/FeedbackForm";
import { PublicShell } from "../../components/PublicShell";
import { feedbackTypes } from "../../lib/support/contact-schema";

export const metadata: Metadata = {
  title: "Feedback",
  description: "Beta feedback path for bugs, feature requests, friction, pricing, mobile, and accessibility issues.",
};

export default function FeedbackPage() {
  return (
    <PublicShell>
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#2DD4BF]">Feedback</p>
        <h1 className="mt-3 max-w-4xl text-4xl font-black text-white">Help improve the beta.</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[#CBD5E1]">
          Share bug reports, feature requests, confusion, pricing feedback, mobile issues, accessibility issues, or
          general feedback. Feedback is validated and may be stored when Supabase is configured.
        </p>
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {feedbackTypes.map((type) => (
          <div key={type.value} className="rounded-2xl border border-white/10 bg-[#081827] p-4 text-sm font-black text-white">
            {type.label}
          </div>
        ))}
      </section>

      <section className="mt-6">
        <FeedbackForm />
      </section>
    </PublicShell>
  );
}

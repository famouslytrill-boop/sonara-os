const faqs = [
  {
    question: "Can I send secrets through support forms?",
    answer: "No. Do not send passwords, card numbers, payout details, API keys, private customer records, or sensitive documents through public forms.",
  },
  {
    question: "What happens if email delivery is not configured?",
    answer: "The form validates your request and attempts safe database storage if Supabase is configured. If delivery is missing, the page explains that clearly instead of pretending the message was sent.",
  },
  {
    question: "Are legal, billing, or security reports handled automatically?",
    answer: "No. High-risk support categories are routed as review-ready requests. They do not trigger refunds, legal updates, security changes, or customer-facing actions automatically.",
  },
];

export function SupportFAQ() {
  return (
    <section className="rounded-3xl border border-white/10 bg-[#081827] p-6">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-[#2DD4BF]">Support FAQ</p>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {faqs.map((faq) => (
          <article key={faq.question} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-base font-black text-white">{faq.question}</h2>
            <p className="mt-3 text-sm leading-6 text-[#CBD5E1]">{faq.answer}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

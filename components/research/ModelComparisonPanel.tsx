import { modelComparisonProviders, modelComparisonRubric, modelComparisonSafetyNotes } from "../../lib/research/model-comparison";

const statusLabels = {
  not_configured: "Not configured",
  server_only_env_required: "Server env required",
  review_required: "Review required",
} as const;

const riskTone = {
  low: "border-[#22C55E]/35 bg-[#22C55E]/10 text-[#BBF7D0]",
  medium: "border-[#FACC15]/35 bg-[#FACC15]/10 text-[#FEF08A]",
  high: "border-[#EF4444]/35 bg-[#EF4444]/10 text-[#FECACA]",
} as const;

export function ModelComparisonPanel() {
  return (
    <div className="grid gap-6">
      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <h2 className="text-xl font-black text-white">Prompt input placeholder</h2>
        <p className="mt-2 text-sm leading-6 text-[#CBD5E1]">
          Prompt tests are disabled until a server-side provider, cost control, and safety policy are configured.
        </p>
        <textarea
          aria-label="Prompt placeholder"
          className="mt-4 min-h-32 w-full resize-none rounded-xl border border-white/10 bg-[#07111F] p-4 text-sm text-[#CBD5E1]"
          disabled
          placeholder="Provider calls are setup-gated. Paste nothing sensitive here."
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {modelComparisonProviders.map((provider) => (
          <article key={provider.name} className="rounded-2xl border border-white/10 bg-[#081827] p-5">
            <p className="text-lg font-black text-white">{provider.name}</p>
            <p className="mt-3 rounded-full border border-[#2DD4BF]/30 bg-[#2DD4BF]/10 px-3 py-1 text-xs font-black text-[#99F6E4]">
              {statusLabels[provider.status]}
            </p>
            <p className="mt-3 text-sm leading-6 text-[#CBD5E1]">{provider.notes}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {modelComparisonRubric.map((item) => (
          <article key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-black text-white">{item.label}</h2>
              <span className={`rounded-full border px-3 py-1 text-xs font-black ${riskTone[item.risk]}`}>
                {item.risk} risk
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-[#CBD5E1]">{item.description}</p>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-[#FFB454]/40 bg-[#FFB454]/10 p-5">
        <h2 className="text-xl font-black text-white">Safety review notes</h2>
        <ul className="mt-4 grid gap-2 text-sm leading-6 text-[#FDE68A]">
          {modelComparisonSafetyNotes.map((note) => (
            <li key={note} className="rounded-xl border border-[#FFB454]/30 bg-[#07111F]/70 px-4 py-3">
              {note}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

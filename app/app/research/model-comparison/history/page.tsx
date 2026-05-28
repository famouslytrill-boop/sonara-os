import { AppDashboardShell } from "../../../../../components/AppDashboardShell";

export default function ModelComparisonHistoryPage() {
  return (
    <AppDashboardShell title="Model Comparison History">
      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <h2 className="text-xl font-black text-white">No saved reports yet</h2>
        <p className="mt-3 text-sm leading-6 text-[#CBD5E1]">
          Model comparison reports will appear only after server-side providers, storage, cost controls, and safety review
          are configured. No API keys or prompts are stored by this placeholder.
        </p>
      </section>
    </AppDashboardShell>
  );
}

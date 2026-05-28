import Link from "next/link";
import { AppDashboardShell } from "../../../../components/AppDashboardShell";
import { ModelComparisonPanel } from "../../../../components/research/ModelComparisonPanel";

export default function AppModelComparisonPage() {
  return (
    <AppDashboardShell title="Model Comparison Lab">
      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:flex-row">
        <Link className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#2DD4BF] px-4 text-sm font-black text-[#07111F]" href="/app/research/model-comparison/new">
          New test report
        </Link>
        <Link className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 px-4 text-sm font-black text-white" href="/app/research/model-comparison/history">
          History
        </Link>
      </div>
      <ModelComparisonPanel />
    </AppDashboardShell>
  );
}

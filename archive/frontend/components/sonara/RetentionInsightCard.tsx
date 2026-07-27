import { RefreshCw } from "lucide-react";
import { getRetentionInsight } from "../../lib/sonara/retention/retentionEngine";

export function RetentionInsightCard() {
  const insight = getRetentionInsight(["created_project_no_export", "activation_incomplete"]);

  return (
    <article className="rounded-lg border border-[#332A40] bg-[#191522] p-4 text-[#F9FAFB]">
      <RefreshCw className="text-[#2DD4BF]" size={22} />
      <p className="mt-3 text-xs font-black uppercase text-[#FFB454]">Retention</p>
      <h2 className="mt-1 text-xl font-black">{insight.riskScore}/100 churn signal</h2>
      <p className="mt-2 text-sm leading-6 text-[#C4BFD0]">{insight.nextAction}</p>
    </article>
  );
}

import { ShieldCheck } from "lucide-react";
import { getAutonomyChecks, summarizeAutonomy } from "../../lib/sonara/autonomy/autonomyEngine";

export function AutonomyStatusCard() {
  const checks = getAutonomyChecks();
  const summary = summarizeAutonomy(checks);

  return (
    <section className="rounded-lg border border-[#332A40] bg-[#191522] p-5 text-[#F9FAFB]">
      <div className="flex items-center gap-3">
        <ShieldCheck className="text-[#2DD4BF]" size={24} />
        <div>
          <p className="text-xs font-black uppercase text-[#FFB454]">Supervised autonomy</p>
          <h2 className="text-2xl font-black">Background checks with human approval gates.</h2>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Metric label="Readiness" value={`${summary.score}/100`} />
        <Metric label="Manual setup" value={`${summary.manual}`} />
        <Metric label="Blocked" value={`${summary.blocked}`} />
      </div>
      <ul className="mt-4 grid gap-2 text-sm leading-6 text-[#C4BFD0]">
        {checks.slice(0, 5).map((check) => (
          <li key={check.id}>- {check.label}: {check.status}</li>
        ))}
      </ul>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#332A40] bg-[#121018] p-3">
      <p className="text-xs font-bold uppercase text-[#8F879C]">{label}</p>
      <p className="mt-1 text-xl font-black text-[#F9FAFB]">{value}</p>
    </div>
  );
}

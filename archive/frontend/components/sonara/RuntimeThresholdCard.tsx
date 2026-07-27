import type { RuntimeThreshold } from "../../lib/sonara/runtime/runtimeTypes";
import { formatRuntime } from "../../lib/sonara/runtime/runtimeThresholdEngine";

export function RuntimeThresholdCard({ threshold }: { threshold: RuntimeThreshold }) {
  return (
    <section className="rounded-lg border border-[#2A2A35] bg-[#171720] p-5 text-[#F8FAFC]">
      <p className="text-xs font-black uppercase text-[#22D3EE]">Runtime Target</p>
      <h2 className="mt-2 text-xl font-black">Project Runtime Threshold</h2>
      <p className="mt-2 text-sm leading-6 text-[#A1A1AA]">
        Recommended runtime range based on the project type, genre, platform, and commercial lane.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <RuntimeValue label="Minimum" value={formatRuntime(threshold.minSeconds)} />
        <RuntimeValue label="Ideal" value={formatRuntime(threshold.idealSeconds)} accent />
        <RuntimeValue label="Maximum" value={formatRuntime(threshold.maxSeconds)} />
        <RuntimeValue label="Warning" value={formatRuntime(threshold.warningSeconds)} warning />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <RuntimeNotes title="Notes" items={threshold.notes} />
        <RuntimeNotes title="Arrangement" items={threshold.arrangementGuidance} />
        <RuntimeNotes title="Platform" items={threshold.platformGuidance} />
      </div>
    </section>
  );
}

function RuntimeValue({
  label,
  value,
  accent = false,
  warning = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
  warning?: boolean;
}) {
  const colorClass = accent ? "text-[#22D3EE]" : warning ? "text-[#F59E0B]" : "text-[#F8FAFC]";

  return (
    <div className="rounded-lg border border-[#2A2A35] bg-[#111118] p-4">
      <p className="text-xs font-bold uppercase text-[#71717A]">{label}</p>
      <p className={`mt-1 text-2xl font-black ${colorClass}`}>{value}</p>
    </div>
  );
}

function RuntimeNotes({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="text-sm font-bold text-[#F8FAFC]">{title}</h3>
      <ul className="mt-2 grid gap-1 text-sm leading-6 text-[#A1A1AA]">
        {items.length ? items.map((note) => <li key={note}>{note}</li>) : <li>Use standard release pacing.</li>}
      </ul>
    </div>
  );
}

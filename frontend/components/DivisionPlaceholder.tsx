import Link from "next/link";

export function DivisionPlaceholder({
  description,
  name,
  type,
}: {
  description: string;
  name: string;
  type: string;
}) {
  return (
    <section className="rounded-lg border border-[#2A2A35] bg-[#171720] p-5">
      <p className="text-xs font-black uppercase text-[#22D3EE]">{type}</p>
      <h1 className="mt-2 text-3xl font-black">{name}</h1>
      <p className="mt-3 max-w-3xl leading-7 text-[#A1A1AA]">{description}</p>
      <div className="mt-6 rounded-lg border border-[#2A2A35] bg-[#111118] p-4">
        <p className="text-sm font-black text-[#F8FAFC]">Module under development</p>
        <p className="mt-2 text-sm leading-6 text-[#A1A1AA]">
          This division is present for ecosystem routing and launch readiness. Detailed tools stay hidden until they support the core SONARA OS™ workflow.
        </p>
      </div>
      <Link className="mt-5 inline-flex min-h-10 items-center rounded-lg bg-[#8B5CF6] px-4 text-sm font-bold text-white" href="/dashboard">
        Back to SONARA OS™
      </Link>
    </section>
  );
}

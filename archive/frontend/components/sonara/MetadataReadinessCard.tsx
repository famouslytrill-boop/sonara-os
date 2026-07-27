import { evaluateMetadataReadiness } from "../../lib/sonara/rights/metadataReadinessEngine";

export function MetadataReadinessCard() {
  const result = evaluateMetadataReadiness({ title: "SONARA Demo Release", creator: "Demo Artist", explicitnessMode: "radio_safe" });
  return (
    <section className="rounded-lg border border-[#332A40] bg-[#191522] p-4 text-[#F9FAFB]">
      <p className="text-xs font-black uppercase text-[#2DD4BF]">Metadata Readiness</p>
      <h3 className="mt-2 text-xl font-black">{result.score}/100</h3>
      <p className="mt-2 text-sm text-[#C4BFD0]">{result.missing.length ? `Missing: ${result.missing.join(", ")}` : "Core metadata is present."}</p>
    </section>
  );
}

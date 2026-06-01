export function DeviceCapabilityCard({ title }: { title: string }) {
  return <article className="rounded-2xl border border-white/10 bg-[#081827] p-5 text-sm text-[#CBD5E1]"><strong className="text-white">{title}</strong><br />Capability is disabled until reviewed and consent-gated.</article>;
}

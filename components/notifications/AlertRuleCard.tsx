export function AlertRuleCard({ title }: { title: string }) {
  return <article className="rounded-2xl border border-white/10 bg-[#081827] p-5 text-sm text-[#CBD5E1]"><strong className="text-white">{title}</strong><br />High-risk alerts require review and audit records.</article>;
}

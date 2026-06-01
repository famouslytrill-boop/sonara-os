export function VoiceEscalationRules() {
  return (
    <ul className="grid gap-2 text-sm text-[#CBD5E1]">
      {["Escalate billing, safety, legal, privacy, and account-access issues to a human.", "Do not call customers or send messages automatically.", "Keep transcripts tenant-private when storage is enabled."].map((item) => (
        <li key={item} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
          {item}
        </li>
      ))}
    </ul>
  );
}

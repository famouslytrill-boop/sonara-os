import { Palette } from "lucide-react";
import { runDesignAudit } from "../../lib/sonara/design/designIntelligenceEngine";

export function DesignAuditCard() {
  const audit = runDesignAudit({
    hasDarkTheme: true,
    hasReadableText: true,
    hasMobileNav: true,
    hasPrimaryCta: true,
    usesWarmAccent: true,
    hasTrustLinks: true,
  });

  return (
    <article className="rounded-lg border border-[#332A40] bg-[#191522] p-4 text-[#F9FAFB]">
      <Palette className="text-[#F472B6]" size={22} />
      <p className="mt-3 text-xs font-black uppercase text-[#FFB454]">Design intelligence</p>
      <h2 className="mt-1 text-xl font-black">{audit.score}/100 premium music-tech readiness</h2>
      <ul className="mt-3 grid gap-2 text-sm leading-6 text-[#C4BFD0]">
        {audit.nextActions.slice(0, 3).map((action) => (
          <li key={action}>- {action}</li>
        ))}
      </ul>
    </article>
  );
}

import { PublicShell } from "../../components/PublicShell";
import { SupportRequestCard } from "../../components/sonara/SupportRequestCard";

const categories = ["account", "billing", "exports", "sound rights", "app bug", "feature request", "Google Play/mobile", "store product"] as const;

export default function SupportPage() {
  return (
    <PublicShell>
      <SupportRequestCard />
      <section className="mt-6 rounded-lg border border-[#332A40] bg-[#191522] p-5 text-[#F9FAFB]">
        <p className="text-sm font-black">Support categories</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((category) => (
            <span key={category} className="rounded-lg border border-[#332A40] bg-[#121018] p-3 text-sm text-[#C4BFD0]">
              {category}
            </span>
          ))}
        </div>
      </section>
    </PublicShell>
  );
}

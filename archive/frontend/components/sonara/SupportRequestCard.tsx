import { LifeBuoy } from "lucide-react";

export function SupportRequestCard() {
  return (
    <section className="rounded-lg border border-[#332A40] bg-[#191522] p-5 text-[#F9FAFB]">
      <LifeBuoy className="text-[#2DD4BF]" size={24} />
      <p className="mt-3 text-xs font-black uppercase text-[#FFB454]">Support</p>
      <h1 className="mt-1 text-3xl font-black">How can SONARA help?</h1>
      <p className="mt-3 max-w-2xl leading-7 text-[#C4BFD0]">
        Email support@sonaraindustries.com for account, billing, exports, sound rights, sound discovery/license review, writing/lyrics, app bugs, feature requests, mobile/PWA, or store product questions.
      </p>
      <div className="mt-5 rounded-lg border border-[#332A40] bg-[#121018] p-4 text-sm leading-6 text-[#C4BFD0]">
        Support form submission is a placeholder until email or ticketing integration is configured. No fake tickets are created.
      </div>
    </section>
  );
}

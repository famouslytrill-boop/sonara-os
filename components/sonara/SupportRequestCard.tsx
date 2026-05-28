import { LifeBuoy } from "lucide-react";

export function SupportRequestCard() {
  return (
    <section className="rounded-lg border border-[#332A40] bg-[#191522] p-5 text-[#F9FAFB]">
      <LifeBuoy className="text-[#2DD4BF]" size={24} />
      <p className="mt-3 text-xs font-black uppercase text-[#FFB454]">Support</p>
      <h1 className="mt-1 text-3xl font-black">How can SONARA help?</h1>
      <p className="mt-3 max-w-2xl leading-7 text-[#C4BFD0]">
        Use the public contact and feedback paths for account, billing, technical support, security, privacy, app bug,
        feature request, mobile, accessibility, or product questions. Do not submit secrets or private customer data.
      </p>
      <div className="mt-5 rounded-lg border border-[#332A40] bg-[#121018] p-4 text-sm leading-6 text-[#C4BFD0]">
        Support form submission is a placeholder until email or ticketing integration is configured. No fake tickets are created.
      </div>
    </section>
  );
}

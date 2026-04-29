import type { ReactNode } from "react";
import { CreditCard, Cpu, HardDrive, KeyRound, ShieldCheck } from "lucide-react";
import { ProductShell } from "../../components/ProductShell";
import { getSupabaseStatus } from "../../lib/supabase";
import { getAIProvider, hasOpenAIKey } from "../../lib/sonara/ai/providerConfig";
import { providerLabel, sonaraProviderOptions, type SonaraProvider } from "../../lib/sonara-core";

const providerIcons: Record<SonaraProvider, ReactNode> = {
  local_rules: <Cpu size={22} />,
  openai_byok: <KeyRound size={22} />,
  ollama_local: <HardDrive size={22} />,
  lmstudio_local: <HardDrive size={22} />,
};

export default function SettingsPage() {
  const supabase = getSupabaseStatus();
  const activeProvider = getAIProvider();
  const openAiByokReady = hasOpenAIKey();

  return (
    <ProductShell>
      <section className="rounded-lg border border-[#2A2A35] bg-[#171720] p-5 text-[#F8FAFC]">
        <p className="text-xs font-black uppercase text-[#22D3EE]">Settings</p>
        <h1 className="mt-2 text-3xl font-black text-[#F8FAFC]">Launch configuration.</h1>
        <p className="mt-3 max-w-2xl leading-7 text-[#A1A1AA]">
          SONARA launches with Local Rules by default. Provider modes are optional and stay inside SONARA Core.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <StatusPanel icon={<Cpu size={22} />} label="Model provider" value={providerLabel(activeProvider)} />
          <StatusPanel
            icon={<ShieldCheck size={22} />}
            label="Supabase"
            value={supabase.configured ? `Configured: ${supabase.storageBucket}` : "Optional until auth and storage go live"}
          />
          <StatusPanel
            icon={<CreditCard size={22} />}
            label="Stripe"
            value={process.env.STRIPE_SECRET_KEY ? "Server key configured" : "Add Stripe keys and tier price IDs before checkout goes live"}
          />
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-4">
          {sonaraProviderOptions.map((option) => (
            <ProviderPanel
              key={option.id}
              active={option.id === activeProvider}
              configured={option.id !== "openai_byok" || openAiByokReady}
              icon={providerIcons[option.id]}
              label={option.label}
              description={option.description}
            />
          ))}
        </div>

        <div className="mt-6 rounded-lg border border-[#2A2A35] bg-[#111118] p-4">
          <p className="text-sm font-black text-[#F8FAFC]">Welcome to SONARA OS™</p>
          <p className="mt-2 text-sm leading-6 text-[#A1A1AA]">
            SONARA OS™ is the creator operating system from SONARA Industries™, built to help artists, producers, labels, and music entrepreneurs organize songs, sounds, prompts, release plans, and full artist ecosystems.
          </p>
        </div>

        <div className="mt-4 rounded-lg border border-[#2A2A35] bg-[#111118] p-4">
          <p className="text-sm font-black text-[#F8FAFC]">Product boundary</p>
          <p className="mt-2 text-sm leading-6 text-[#A1A1AA]">
            SONARA is a music identity and release-readiness system. It does not become a generator, distributor, streaming platform, OBS clone, video editor, raw analytics clone, or cluttered dashboard.
          </p>
        </div>
      </section>
    </ProductShell>
  );
}

function StatusPanel({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#2A2A35] bg-[#111118] p-4">
      <div className="text-[#22D3EE]">{icon}</div>
      <p className="mt-3 text-sm font-black text-[#F8FAFC]">{label}</p>
      <p className="mt-1 text-sm text-[#A1A1AA]">{value}</p>
    </div>
  );
}

function ProviderPanel({
  active,
  configured,
  description,
  icon,
  label,
}: {
  active: boolean;
  configured: boolean;
  description: string;
  icon: ReactNode;
  label: string;
}) {
  return (
    <div className={`rounded-lg border p-4 ${active ? "border-[#8B5CF6] bg-[#211A33]" : "border-[#2A2A35] bg-[#111118]"}`}>
      <div className={active ? "text-[#8B5CF6]" : "text-[#22D3EE]"}>{icon}</div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <p className="text-sm font-black text-[#F8FAFC]">{label}</p>
        <span className="rounded-full border border-[#2A2A35] bg-[#171720] px-2 py-1 text-[11px] font-black uppercase text-[#A1A1AA]">
          {active ? "Active" : configured ? "Optional" : "BYOK"}
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-[#A1A1AA]">{description}</p>
    </div>
  );
}

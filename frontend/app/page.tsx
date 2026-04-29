import Link from "next/link";
import { CheckCircle2, Fingerprint } from "lucide-react";
import { sonaraProductDoors } from "../config/sonara/businessPrinciples";
import { brandSystem } from "../config/brandSystem";
import { sonaraWebsiteSections } from "../config/sonara/productArchitecture";
import { ProductShell } from "../components/ProductShell";
import { FingerprintStrip } from "../components/FingerprintStrip";
import { PricingTiers } from "../components/PricingTiers";

const promises = [
  "Every song gets a fingerprint.",
  "Every release gets a plan.",
  "Every creator gets a cleaner path from idea to launch.",
];

export default function HomePage() {
  const hero = sonaraWebsiteSections[0];

  return (
    <ProductShell>
      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr] lg:items-start">
        <section className="rounded-lg border border-[#2A2A35] bg-[#171720] p-5">
          <p className="text-xs font-black uppercase text-[#22D3EE]">{hero.label}</p>
          <h1 className="mt-2 max-w-2xl text-3xl font-black leading-tight sm:text-5xl">
            {brandSystem.publicCopy.homepageHeroTitle}
          </h1>
          <p className="mt-3 text-xl font-black text-[#F8FAFC]">{brandSystem.publicCopy.homepageHeroSubtitle}</p>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[#A1A1AA]">
            {brandSystem.publicCopy.homepageHeroBody}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link className="inline-flex min-h-11 items-center rounded-lg bg-[#8B5CF6] px-4 text-sm font-bold text-white" href="/dashboard">
              Launch SONARA OS™
            </Link>
            <Link className="inline-flex min-h-11 items-center rounded-lg border border-[#2A2A35] bg-[#111118] px-4 text-sm font-bold text-[#F8FAFC]" href="/vault">
              Explore SONARA Vault™
            </Link>
            <Link className="inline-flex min-h-11 items-center rounded-lg border border-[#2A2A35] bg-[#111118] px-4 text-sm font-bold text-[#F8FAFC]" href="/records">
              Discover SONARA Records™
            </Link>
          </div>
        </section>

        <section className="grid gap-4">
          <FingerprintStrip />
          <div className="rounded-lg border border-[#2A2A35] bg-[#171720] p-5">
            <div className="flex items-center gap-3">
              <Fingerprint className="text-[#22D3EE]" size={24} />
              <h2 className="text-xl font-black">SONARA Core</h2>
            </div>
            <div className="mt-4 grid gap-3">
              {promises.map((promise) => (
                <div key={promise} className="flex gap-3 text-sm font-semibold text-[#A1A1AA]">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-[#22C55E]" size={18} />
                  <span>{promise}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
      <section className="mt-6 grid gap-3 lg:grid-cols-4">
        {sonaraProductDoors.map((door) => (
          <Link key={door.id} href={door.route} className="rounded-lg border border-[#2A2A35] bg-[#171720] p-4 transition hover:border-[#22D3EE]">
            <p className="text-sm font-black">{door.name}</p>
            <p className="mt-2 text-sm leading-6 text-[#A1A1AA]">{door.description}</p>
          </Link>
        ))}
      </section>

      <section className="mt-6 grid gap-4">
        {sonaraWebsiteSections.slice(1).map((section) => (
          <div key={section.id} className="rounded-lg border border-[#2A2A35] bg-[#171720] p-5">
            <p className="text-xs font-black uppercase text-[#22D3EE]">{section.label}</p>
            <h2 className="mt-2 text-2xl font-black">{section.title}</h2>
            <p className="mt-3 max-w-3xl leading-7 text-[#A1A1AA]">{section.description}</p>
            {section.id === "pricing" ? (
              <PricingTiers />
            ) : null}
          </div>
        ))}
      </section>
    </ProductShell>
  );
}

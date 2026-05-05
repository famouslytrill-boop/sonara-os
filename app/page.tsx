import Link from "next/link";
import { ArrowRight, Building2, CheckCircle2, Compass, Disc3, Fingerprint, Package, ShieldCheck } from "lucide-react";
import { PublicShell } from "../components/PublicShell";
import { TrustBadges } from "../components/sonara/TrustBadges";
import { brandSystem } from "../config/brandSystem";

const promises = [
  "Every song gets a fingerprint.",
  "Every release gets a plan.",
  "Every creator gets a cleaner path from idea to launch.",
];

const divisions = [
  brandSystem.divisions.os,
  brandSystem.divisions.core,
  brandSystem.divisions.records,
  brandSystem.divisions.vault,
  brandSystem.divisions.engine,
  brandSystem.divisions.exchange,
  brandSystem.divisions.labs,
];

const divisionIcons = [Compass, Fingerprint, Disc3, Package, Building2, ShieldCheck, Compass] as const;

export default function HomePage() {
  return (
    <PublicShell>
      <section className="grid gap-6 py-6 lg:grid-cols-[1fr_0.82fr] lg:items-start">
        <div className="p-1 sm:py-8">
          <p className="text-xs font-black uppercase text-[#22D3EE]">Music technology company</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-black leading-tight text-[#F8FAFC] sm:text-6xl">
            {brandSystem.publicCopy.homepageHeroTitle}
          </h1>
          <p className="mt-4 text-xl font-black text-[#F8FAFC]">{brandSystem.publicCopy.homepageHeroSubtitle}</p>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[#A1A1AA]">{brandSystem.publicCopy.homepageHeroBody}</p>
          <p className="mt-3 max-w-2xl text-sm font-bold text-[#22D3EE]">
            SONARA OS™ is built for music as a whole: traditional, AI-assisted, and hybrid workflows.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#8B5CF6] px-4 text-sm font-bold text-white" href="/dashboard">
              Launch SONARA OS™ <ArrowRight size={16} />
            </Link>
            <Link className="inline-flex min-h-11 items-center rounded-lg border border-[#2A2A35] bg-[#111118] px-4 text-sm font-bold text-[#F8FAFC]" href="/store">
              Explore Store
            </Link>
            <Link className="inline-flex min-h-11 items-center rounded-lg border border-[#2A2A35] bg-[#111118] px-4 text-sm font-bold text-[#F8FAFC]" href="/tutorial">
              View Tutorial
            </Link>
          </div>
        </div>

        <div className="rounded-lg border border-[#2A2A35] bg-[#171720] p-5">
          <div className="flex items-center gap-3">
            <Fingerprint className="text-[#22D3EE]" size={24} />
            <h2 className="text-xl font-black text-[#F8FAFC]">Product Promise</h2>
          </div>
          <div className="mt-4 grid gap-3">
            {promises.map((promise) => (
              <div key={promise} className="flex gap-3 rounded-lg border border-[#2A2A35] bg-[#111118] p-3 text-sm font-semibold text-[#A1A1AA]">
                <CheckCircle2 className="mt-0.5 shrink-0 text-[#22C55E]" size={18} />
                <span>{promise}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-[#2A2A35] bg-[#171720] p-5">
        <p className="text-xs font-black uppercase text-[#22D3EE]">Mission</p>
        <p className="mt-3 max-w-4xl text-lg leading-8 text-[#F8FAFC]">
          SONARA Industries™ builds music technology, creator infrastructure, sound systems, and release tools that help artists,
          producers, labels, and music entrepreneurs turn ideas into organized, release-ready creative systems.
        </p>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-[#332A40] bg-[#191522] p-5">
          <p className="text-xs font-black uppercase text-[#FFB454]">Who it is for</p>
          <p className="mt-3 leading-7 text-[#C4BFD0]">
            Artists, producers, creators, local businesses, labels, and digital product builders who need cleaner project systems, rights-aware exports, and launch discipline.
          </p>
        </div>
        <div className="rounded-lg border border-[#332A40] bg-[#191522] p-5">
          <p className="text-xs font-black uppercase text-[#FFB454]">What the OS does</p>
          <p className="mt-3 leading-7 text-[#C4BFD0]">
            SONARA OS™ creates song fingerprints, runtime targets, prompt-length guidance, authentic writing checks, broadcast kits, and export bundles from one creator workspace.
          </p>
        </div>
      </section>

      <section className="mt-6">
        <TrustBadges />
      </section>

      <section className="mt-6 rounded-lg border border-[#332A40] bg-[#191522] p-5">
        <p className="text-xs font-black uppercase text-[#FFB454]">SONARA Coreâ„¢</p>
        <h2 className="mt-2 text-2xl font-black text-[#F9FAFB]">Built for every genre. Structured for every release.</h2>
        <p className="mt-3 max-w-4xl leading-7 text-[#C4BFD0]">
          SONARA Coreâ„¢ reads the creative path from idea to arrangement across hip-hop, R&B, pop, country, rock, electronic, Latin,
          Afrobeats, gospel, cinematic, ambient, experimental, spoken word, and hybrid genres.
        </p>
        <p className="mt-3 max-w-4xl leading-7 text-[#C4BFD0]">
          It turns genre, rhythm, harmony, drums, vocals, sound identity, runtime, and release goals into a clear operating system for modern music creators.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {["Genre Intelligence", "Arrangement Core", "Sound Identity", "Runtime Target", "Rights-Aware Vault", "Release-Ready Exports"].map((item) => (
            <div key={item} className="rounded-lg border border-[#332A40] bg-[#121018] p-3 text-sm font-black text-[#F9FAFB]">
              {item}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase text-[#22D3EE]">Core divisions</p>
            <h2 className="mt-2 text-2xl font-black text-[#F8FAFC]">One ecosystem, focused product doors.</h2>
          </div>
          <Link href="/pricing" className="text-sm font-black text-[#22D3EE]">
            View pricing
          </Link>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {divisions.map((division, index) => {
            const Icon = divisionIcons[index] ?? Compass;
            return (
              <Link key={division.name} href={division.route} className="rounded-lg border border-[#2A2A35] bg-[#171720] p-4 transition hover:border-[#22D3EE]">
                <Icon className="text-[#22D3EE]" size={23} />
                <p className="mt-3 text-sm font-black text-[#F8FAFC]">{division.name}</p>
                <p className="mt-1 text-xs font-black uppercase text-[#71717A]">{division.type}</p>
                <p className="mt-2 text-sm leading-6 text-[#A1A1AA]">{division.description}</p>
              </Link>
            );
          })}
        </div>
      </section>
    </PublicShell>
  );
}

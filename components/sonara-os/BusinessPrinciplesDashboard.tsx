import Link from "next/link";
import { AlertTriangle, ArrowRight, BadgeCheck, CircleDollarSign, Compass, Gauge, ShieldCheck } from "lucide-react";
import { sonaraBusinessPrinciplesLayer, sonaraProductDoors } from "../../config/sonara/businessPrinciples";
import { sonaraActiveTools, sonaraCreatorBusinessModules } from "../../config/sonara/productArchitecture";
import { sonaraSystemVisibility } from "../../config/sonara/systemVisibility";
import { runSonaraFinalCompanyAudit } from "../../lib/sonara/businessPrinciples";

const iconByIndex = [Compass, BadgeCheck, Gauge, ShieldCheck] as const;
const businessModuleIcons = [BadgeCheck, Gauge, CircleDollarSign] as const;
const activeToolIcons = [Compass, BadgeCheck, Gauge, ShieldCheck, CircleDollarSign] as const;

export function BusinessPrinciplesDashboard() {
  const audit = runSonaraFinalCompanyAudit();

  return (
    <div className="grid gap-6">
      <section className="rounded-lg border border-[#2A2A35] bg-[#171720] p-5 text-[#F8FAFC]">
        <p className="text-xs font-black uppercase text-[#22D3EE]">SONARA OS</p>
        <div className="mt-2 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <h1 className="max-w-3xl text-3xl font-black leading-tight text-[#F8FAFC] sm:text-5xl">
              SONARA Creator Business OS
            </h1>
            <p className="mt-4 max-w-2xl leading-7 text-[#A1A1AA]">
              AI-powered workflows for artists, creators, local businesses, and digital product builders building brands, content, ideas, revenue paths, and launch systems.
            </p>
          </div>
          <div className="rounded-lg border border-[#2A2A35] bg-[#111118] p-4">
            <p className="text-xs font-black uppercase text-[#22D3EE]">{audit.name}</p>
            <p className="mt-2 text-4xl font-black text-[#F8FAFC]">{audit.oneOfOneCompanyScore}/100</p>
            <p className="mt-1 text-sm font-bold capitalize text-[#A1A1AA]">{audit.status}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-4">
        {sonaraProductDoors.map((door, index) => {
          const Icon = iconByIndex[index] ?? Compass;
          return (
            <Link key={door.id} href={door.route} className="rounded-lg border border-[#2A2A35] bg-[#171720] p-4 transition hover:border-[#22D3EE]">
              <Icon className="text-[#22D3EE]" size={24} />
              <p className="mt-3 text-sm font-black text-[#F8FAFC]">{door.name}</p>
              <p className="mt-2 text-sm leading-6 text-[#A1A1AA]">{door.description}</p>
              <span className="mt-3 inline-flex items-center gap-2 text-xs font-black uppercase text-[#22D3EE]">
                Open door <ArrowRight size={14} />
              </span>
            </Link>
          );
        })}
      </section>

      <section className="rounded-lg border border-[#2A2A35] bg-[#171720] p-5">
        <p className="text-xs font-black uppercase text-[#22D3EE]">Creator Business OS</p>
        <h2 className="mt-2 text-2xl font-black text-[#F8FAFC]">A&R, decisions, and revenue pathways in one operating layer.</h2>
        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          {sonaraCreatorBusinessModules.map((module, index) => {
            const Icon = businessModuleIcons[index] ?? Compass;
            return (
              <div key={module.name} className="rounded-lg border border-[#2A2A35] bg-[#111118] p-4">
                <Icon className="text-[#22D3EE]" size={24} />
                <p className="mt-3 text-sm font-black text-[#F8FAFC]">{module.name}</p>
                <p className="mt-2 text-sm leading-6 text-[#A1A1AA]">{module.purpose}</p>
                <p className="mt-3 text-xs font-bold leading-5 text-[#71717A]">{module.output}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border border-[#2A2A35] bg-[#171720] p-5">
        <p className="text-xs font-black uppercase text-[#22D3EE]">Active Tools</p>
        <h2 className="mt-2 text-2xl font-black text-[#F8FAFC]">Prompt, artist, content, visual, and local business systems.</h2>
        <div className="mt-5 grid gap-3 lg:grid-cols-5">
          {sonaraActiveTools.map((tool, index) => {
            const Icon = activeToolIcons[index] ?? Compass;
            return (
              <Link key={tool.name} href={tool.route} className="rounded-lg border border-[#2A2A35] bg-[#111118] p-4 transition hover:border-[#22D3EE]">
                <Icon className="text-[#22D3EE]" size={22} />
                <p className="mt-3 text-sm font-black text-[#F8FAFC]">{tool.name}</p>
                <p className="mt-2 text-sm leading-6 text-[#A1A1AA]">{tool.purpose}</p>
                <p className="mt-3 text-xs font-bold leading-5 text-[#71717A]">{tool.output}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border border-[#2A2A35] bg-[#171720] p-5">
        <div className="flex items-center gap-3">
          <CircleDollarSign className="text-[#22D3EE]" size={24} />
          <div>
            <p className="text-xs font-black uppercase text-[#22D3EE]">Admin-only operating layer</p>
            <h2 className="text-2xl font-black text-[#F8FAFC]">{sonaraBusinessPrinciplesLayer.internalName}</h2>
          </div>
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {audit.results.map((result) => (
            <div key={result.id} className="rounded-lg border border-[#2A2A35] bg-[#111118] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-[#F8FAFC]">{result.name}</p>
                  <p className="mt-2 text-sm leading-6 text-[#A1A1AA]">{result.summary}</p>
                </div>
                <span className="rounded-full border border-[#2A2A35] bg-[#171720] px-3 py-1 text-xs font-black uppercase text-[#A1A1AA]">
                  {result.status} {result.score}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <AuditList title="Public product doors" items={sonaraSystemVisibility.publicDoors} />
        <AuditList title="Admin-only systems" items={sonaraSystemVisibility.adminOnly} />
        <AuditList title="Studio-only systems" items={sonaraSystemVisibility.studioOnly} />
        <AuditList title="Research-only systems" items={sonaraSystemVisibility.researchOnly} />
        <AuditList title="Hidden or delayed" items={sonaraSystemVisibility.delayed} />
        <AuditList title="Dead systems" items={sonaraSystemVisibility.dead} />
        <AuditList title="Phase gate roadmap" items={sonaraBusinessPrinciplesLayer.phaseGateRoadmap.map((item) => `${item.phase}: ${item.gate}`)} />
        <AuditList title="Skipped intentionally" items={audit.skippedIntentionally} />
      </section>

      <section className="rounded-lg border border-[#F59E0B] bg-[#21190C] p-4">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 shrink-0 text-[#F59E0B]" size={22} />
          <div>
            <p className="text-sm font-black text-[#F8FAFC]">Operating boundary</p>
            <p className="mt-2 text-sm leading-6 text-[#A1A1AA]">
              {sonaraBusinessPrinciplesLayer.exportNotice}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function AuditList({ items, title }: { items: readonly string[]; title: string }) {
  return (
    <div className="rounded-lg border border-[#2A2A35] bg-[#171720] p-4">
      <p className="text-sm font-black text-[#F8FAFC]">{title}</p>
      <ul className="mt-3 grid gap-2 text-sm leading-6 text-[#A1A1AA]">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <ShieldCheck className="mt-1 shrink-0 text-[#22C55E]" size={15} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

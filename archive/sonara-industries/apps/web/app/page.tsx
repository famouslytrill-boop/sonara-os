import { BrandShell } from "@/components/layout/BrandShell";
import { ParentHero } from "@/components/sonara/ParentHero";
import { DivisionCards } from "@/components/sonara/DivisionCards";
import { TrustCenter } from "@/components/sonara/TrustCenter";
import { MoatEngine } from "@/components/sonara/MoatEngine";
import { LaunchGates } from "@/components/sonara/LaunchGates";
import { OperatingRules } from "@/components/sonara/OperatingRules";

export default function Page() {
  return (
    <BrandShell>
      <ParentHero />
      <DivisionCards />
      <section className="mt-10">
        <TrustCenter />
      </section>
      <section className="mt-10">
        <MoatEngine />
      </section>
      <section className="mt-10 grid-auto">
        <LaunchGates />
        <OperatingRules />
      </section>
    </BrandShell>
  );
}

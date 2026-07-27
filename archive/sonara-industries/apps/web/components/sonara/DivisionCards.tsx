import { divisions } from "@/lib/divisions";
import { parentCopy } from "@/lib/constants";
import { ProductCard } from "@/components/ui/ProductCard";
import { SectionHeader } from "@/components/ui/SectionHeader";

export function DivisionCards() {
  return (
    <section className="mt-8">
      <SectionHeader
        eyebrow="Three separate operating companies"
        title="Distinct systems, distinct markets, strict boundaries."
        body={parentCopy.separation}
      />
      <div className="grid-auto">
        <ProductCard
          title={divisions.music.name}
          body={divisions.music.purpose}
          href={divisions.music.route}
          accent={divisions.music.accent}
          meta="Music identity, media, and release readiness"
        />
        <ProductCard
          title={divisions.tableops.name}
          body={divisions.tableops.purpose}
          href={divisions.tableops.route}
          accent={divisions.tableops.accent}
          meta="Restaurant operations, labor, and training"
        />
        <ProductCard
          title={divisions.civic.name}
          body={divisions.civic.purpose}
          href={divisions.civic.route}
          accent={divisions.civic.accent}
          meta="Public feeds, alerts, and approval workflows"
        />
      </div>
    </section>
  );
}

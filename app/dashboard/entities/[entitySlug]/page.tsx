import { notFound } from "next/navigation";
import { ProductShell } from "../../../../components/ProductShell";
import { EntityDashboardShell } from "../../../../components/entities/EntityDashboardShell";
import { EntityOverview } from "../../../../components/entities/EntityOverview";
import { getEntityBySlug } from "../../../../lib/entities/config";

export default async function EntityOverviewPage({ params }: { params: Promise<{ entitySlug: string }> }) {
  const { entitySlug } = await params;
  const entity = getEntityBySlug(entitySlug);
  if (!entity) notFound();

  return (
    <ProductShell>
      <EntityDashboardShell entity={entity} activePath="">
        <EntityOverview entity={entity} />
      </EntityDashboardShell>
    </ProductShell>
  );
}

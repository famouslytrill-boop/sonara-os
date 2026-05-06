import { notFound } from "next/navigation";
import { ProductShell } from "../../../../../components/ProductShell";
import { EntityDashboardShell } from "../../../../../components/entities/EntityDashboardShell";
import { EntityBrowserView } from "../../../../../components/entities/EntityViews";
import { getEntityBySlug } from "../../../../../lib/entities/config";

export default async function EntityBrowserPage({ params }: { params: Promise<{ entitySlug: string }> }) {
  const { entitySlug } = await params;
  const entity = getEntityBySlug(entitySlug);
  if (!entity) notFound();

  return (
    <ProductShell>
      <EntityDashboardShell entity={entity} activePath="browser">
        <EntityBrowserView entity={entity} />
      </EntityDashboardShell>
    </ProductShell>
  );
}

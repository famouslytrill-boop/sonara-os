import { notFound } from "next/navigation";
import { ProductShell } from "../../../../../components/ProductShell";
import { EntityDashboardShell } from "../../../../../components/entities/EntityDashboardShell";
import { EntityNotesView } from "../../../../../components/entities/EntityViews";
import { getEntityBySlug } from "../../../../../lib/entities/config";

export default async function EntityNotesPage({ params }: { params: Promise<{ entitySlug: string }> }) {
  const { entitySlug } = await params;
  const entity = getEntityBySlug(entitySlug);
  if (!entity) notFound();

  return (
    <ProductShell>
      <EntityDashboardShell entity={entity} activePath="notes">
        <EntityNotesView />
      </EntityDashboardShell>
    </ProductShell>
  );
}

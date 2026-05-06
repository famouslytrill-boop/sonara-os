import { notFound } from "next/navigation";
import { ProductShell } from "../../../../../components/ProductShell";
import { EntityDashboardShell } from "../../../../../components/entities/EntityDashboardShell";
import { EntityBookmarksView } from "../../../../../components/entities/EntityViews";
import { getEntityBySlug } from "../../../../../lib/entities/config";

export default async function EntityBookmarksPage({ params }: { params: Promise<{ entitySlug: string }> }) {
  const { entitySlug } = await params;
  const entity = getEntityBySlug(entitySlug);
  if (!entity) notFound();

  return (
    <ProductShell>
      <EntityDashboardShell entity={entity} activePath="bookmarks">
        <EntityBookmarksView entity={entity} />
      </EntityDashboardShell>
    </ProductShell>
  );
}

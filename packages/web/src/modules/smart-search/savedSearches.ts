import type { SavedSearch, SearchContext } from "./contracts.ts";
export function canRunSavedSearch(search: SavedSearch, context: SearchContext): boolean {
  return (
    search.organization_id === context.organization_id &&
    context.permissions.includes(search.permission)
  );
}

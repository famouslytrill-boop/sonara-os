import { AppSidebar } from "@/components/layout/AppSidebar";
import { divisions } from "@/lib/divisions";

export function TableOpsSidebar() {
  return <AppSidebar app={divisions.tableops.name} nav={divisions.tableops.nav} accent={divisions.tableops.accent} />;
}

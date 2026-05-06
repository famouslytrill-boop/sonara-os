import { AppSidebar } from "@/components/layout/AppSidebar";
import { divisions } from "@/lib/divisions";

export function CivicSidebar() {
  return <AppSidebar app={divisions.civic.name} nav={divisions.civic.nav} accent={divisions.civic.accent} />;
}

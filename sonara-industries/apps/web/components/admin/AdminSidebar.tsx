import { AppSidebar } from "@/components/layout/AppSidebar";
import { adminNav } from "@/lib/divisions";

export function AdminSidebar() {
  return <AppSidebar app="Parent Admin" nav={adminNav} accent="#22d3ee" />;
}

import { AdminModulePage } from "@/components/admin/AdminModulePage";

export default function Page() {
  return <AdminModulePage title="Users" description="Parent governance for user access, memberships, and app-specific role separation." modules={["Users", "Memberships", "Role changes"]} />;
}

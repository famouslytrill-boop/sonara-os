import { AdminModulePage } from "@/components/admin/AdminModulePage";

export default function Page() {
  return <AdminModulePage title="Audit" description="Audit history and access events for the parent governance layer." modules={["Audit logs", "Access events", "Security review"]} />;
}

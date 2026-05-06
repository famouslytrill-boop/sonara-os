import { AdminModulePage } from "@/components/admin/AdminModulePage";

export default function Page() {
  return <AdminModulePage title="System Health" description="Parent operational visibility for infrastructure, ingestion jobs, app status, and support signals." modules={["Health events", "Ingestion jobs", "Service status"]} />;
}

import { AdminModulePage } from "@/components/admin/AdminModulePage";

export default function Page() {
  return <AdminModulePage title="Organizations" description="Parent governance for organization records and app access boundaries." modules={["Organization list", "App access", "Approval queue"]} />;
}

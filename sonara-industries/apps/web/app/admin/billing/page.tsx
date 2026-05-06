import { AdminModulePage } from "@/components/admin/AdminModulePage";

export default function Page() {
  return <AdminModulePage title="Billing" description="Shared billing spine visibility without merging customer app dashboards." modules={["Subscriptions", "Plan groups", "Webhook status"]} />;
}

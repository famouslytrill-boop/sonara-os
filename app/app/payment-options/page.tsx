import { PaymentLinkPlanner } from "../../../components/payments/PaymentLinkPlanner";
import { TapToPayPlanningCard } from "../../../components/payments/TapToPayPlanningCard";
import { AppDashboardShell } from "../../../components/AppDashboardShell";

export default function PaymentOptionsPage() {
  return <AppDashboardShell title="Payment options"><PaymentLinkPlanner /><div className="mt-5"><TapToPayPlanningCard /></div></AppDashboardShell>;
}

import { BillingSafetyNotice } from "../../../components/payments/BillingSafetyNotice";
import { PaymentProviderNotice } from "../../../components/payments/PaymentProviderNotice";
import { AppDashboardShell } from "../../../components/AppDashboardShell";

export default function AppBillingPage() {
  return <AppDashboardShell title="Billing"><PaymentProviderNotice /><div className="mt-5"><BillingSafetyNotice /></div></AppDashboardShell>;
}

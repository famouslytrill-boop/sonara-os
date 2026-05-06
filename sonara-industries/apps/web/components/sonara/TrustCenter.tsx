import { SecurityNotice } from "@/components/ui/SecurityNotice";
import { parentCopy } from "@/lib/constants";

export function TrustCenter() {
  return (
    <SecurityNotice>
      <span>
        {parentCopy.security} Customer data, dashboards, analytics, and workflows stay separated by operating company.
      </span>
    </SecurityNotice>
  );
}

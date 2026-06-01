import { ContactConsentNotice } from "../../../components/contacts/ContactConsentNotice";
import { ContactImportPanel } from "../../../components/contacts/ContactImportPanel";
import { AppDashboardShell } from "../../../components/AppDashboardShell";

export default function ContactsPage() {
  return (
    <AppDashboardShell title="Contacts">
      <ContactConsentNotice />
      <div className="mt-5"><ContactImportPanel /></div>
    </AppDashboardShell>
  );
}

import { AppPlaceholderPage } from "../../components/AppPlaceholderPage";

export default function AdminPage() {
  return (
    <AppPlaceholderPage
      title="Admin Command Center"
      cards={["Organizations", "Users", "Billing", "Audit log", "Integrations", "System health"]}
    />
  );
}

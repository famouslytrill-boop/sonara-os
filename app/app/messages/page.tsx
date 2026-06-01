import { MessageBoard } from "../../../components/messages/MessageBoard";
import { AppDashboardShell } from "../../../components/AppDashboardShell";

export default function MessagesPage() {
  return <AppDashboardShell title="Messages"><MessageBoard /></AppDashboardShell>;
}

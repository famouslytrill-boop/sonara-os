import { AppointmentPlanner } from "../../../components/booking/AppointmentPlanner";
import { AppDashboardShell } from "../../../components/AppDashboardShell";

export default function AppointmentsPage() {
  return <AppDashboardShell title="Appointments"><AppointmentPlanner /></AppDashboardShell>;
}

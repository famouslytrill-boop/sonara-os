import { AppModulePage } from "@/components/layout/AppModulePage";

export default function Page() {
  return (
    <AppModulePage
      division="tableops"
      title="Menus"
      description="QR menu and menu operations placeholders for restaurant teams, pop-ups, and hospitality groups."
      features={["QR menus", "Menu notes", "Publishing checks"]}
    />
  );
}

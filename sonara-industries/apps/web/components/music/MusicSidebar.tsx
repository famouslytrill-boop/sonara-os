import { AppSidebar } from "@/components/layout/AppSidebar";
import { divisions } from "@/lib/divisions";

export function MusicSidebar() {
  return <AppSidebar app={divisions.music.name} nav={divisions.music.nav} accent={divisions.music.accent} />;
}

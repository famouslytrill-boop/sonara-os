import { createElement } from "../../../../dom.ts";
import { defaultGrowthTactics, growthChecklistTemplates } from "../../../../lib/growth-studio/index.ts";
import { renderAdminShell, renderMetricCard } from "../../../../ui/admin-components.ts";

export function renderAdminGrowthTacticsPage() {
  const cards = createElement("div", { className: "planning-grid" });
  cards.append(
    renderMetricCard({
      title: "Tactic drafts",
      value: String(defaultGrowthTactics.length),
      description: "Draft tactics are setup records only. No fake analytics are shown.",
      status: "review"
    }),
    renderMetricCard({
      title: "Checklist templates",
      value: String(growthChecklistTemplates.length),
      description: "Checklist templates can guide launch work after owner review.",
      status: "ready"
    }),
    renderMetricCard({
      title: "Phone outreach",
      value: "Disabled",
      description: "SMS, calls, and voicemail require consent records and provider review.",
      status: "blocked"
    })
  );
  return renderAdminShell({
    activeRoute: "/admin/growth/tactics",
    title: "Growth Tactics",
    description: "Admin review surface for Growth Studio tactics and checklist activity.",
    warning:
      "No campaign sends, SMS, calls, voicemail, fake reviews, or analytics claims are enabled here.",
    children: [cards]
  });
}

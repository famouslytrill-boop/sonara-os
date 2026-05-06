export type AppCode = "parent_admin" | "soundos" | "tableos" | "alertos";
export type DivisionKey = "music" | "tableops" | "civic";

export const appSessionCookies: Record<AppCode, string> = {
  parent_admin: "sonara_admin_session",
  soundos: "soundos_session",
  tableos: "tableos_session",
  alertos: "alertos_session",
};

export const divisions = {
  parent: {
    name: "SONARA Industries",
    short: "Parent Company",
    route: "/",
    appCode: "parent_admin" as AppCode,
    accent: "#22d3ee",
  },
  music: {
    name: "SoundOS",
    short: "Music Operating System",
    route: "/music",
    appCode: "soundos" as AppCode,
    gradient: "from-[#16091f] via-[#1f1035] to-[#042f3a]",
    accent: "#a78bfa",
    buttonVariant: "music" as const,
    sessionCookie: appSessionCookies.soundos,
    audience: "artists, producers, labels, studios, creators",
    purpose: "SoundOS is a dedicated music identity, media intake, catalog, transcription, and release-readiness system.",
    nav: [
      ["Dashboard", "/music/dashboard"],
      ["Artist Genome", "/music/artist-genome"],
      ["Projects", "/music/projects"],
      ["Catalog", "/music/catalog"],
      ["Transcripts", "/music/transcripts"],
      ["Exports", "/music/exports"],
      ["Readiness", "/music/release-readiness"],
      ["Settings", "/music/settings"],
    ],
  },
  tableops: {
    name: "TableOS",
    short: "Hospitality Operating System",
    route: "/tableops",
    appCode: "tableos" as AppCode,
    gradient: "from-[#1f1305] via-[#3a1f0a] to-[#3a1018]",
    accent: "#f59e0b",
    buttonVariant: "tableops" as const,
    sessionCookie: appSessionCookies.tableos,
    audience: "restaurants, chefs, kitchens, food trucks, pop-ups, franchises, hospitality teams",
    purpose: "TableOS is a dedicated restaurant operations, labor, scheduling, training, vendor, document, and menu system.",
    nav: [
      ["Dashboard", "/tableops/dashboard"],
      ["Recipes", "/tableops/recipes"],
      ["Costing", "/tableops/costing"],
      ["Prep", "/tableops/prep"],
      ["Training", "/tableops/training"],
      ["Inventory", "/tableops/inventory"],
      ["Menus", "/tableops/menus"],
      ["Settings", "/tableops/settings"],
    ],
  },
  civic: {
    name: "AlertOS",
    short: "Public Information Operating System",
    route: "/civic",
    appCode: "alertos" as AppCode,
    gradient: "from-[#06151f] via-[#073328] to-[#082f49]",
    accent: "#34d399",
    buttonVariant: "civic" as const,
    sessionCookie: appSessionCookies.alertos,
    audience: "residents, local organizations, libraries, nonprofits, transit riders, public access teams, civic partners",
    purpose: "AlertOS is a dedicated public feed, alert, notice, transit, weather, and approval-gated broadcast system.",
    nav: [
      ["Dashboard", "/civic/dashboard"],
      ["Feed", "/civic/feed"],
      ["Transit", "/civic/transit"],
      ["Alerts", "/civic/alerts"],
      ["Organizations", "/civic/organizations"],
      ["Broadcast", "/civic/broadcast"],
      ["Documents", "/civic/documents"],
      ["Settings", "/civic/settings"],
    ],
  },
} as const;

export const adminNav = [
  ["Dashboard", "/admin/dashboard"],
  ["Organizations", "/admin/organizations"],
  ["Users", "/admin/users"],
  ["Billing", "/admin/billing"],
  ["Audit", "/admin/audit"],
  ["System Health", "/admin/system-health"],
] as const;

export type AppCode = "parent_admin" | "sonara_one" | "tableops" | "civic_signal";
export type DivisionKey = "music" | "tableops" | "civic";

export const appSessionCookies: Record<AppCode, string> = {
  parent_admin: "sonara_admin_session",
  sonara_one: "sonara_music_session",
  tableops: "sonara_tableops_session",
  civic_signal: "sonara_civic_session",
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
    name: "SONARA One",
    short: "Music OS",
    route: "/music",
    appCode: "sonara_one" as AppCode,
    gradient: "from-[#16091f] via-[#1f1035] to-[#042f3a]",
    accent: "#a78bfa",
    buttonVariant: "music" as const,
    sessionCookie: appSessionCookies.sonara_one,
    audience: "artists, producers, songwriters, labels, managers, creators",
    purpose: "SONARA One is a dedicated music identity and release-readiness system.",
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
    name: "TableOps Systems",
    short: "Kitchen OS",
    route: "/tableops",
    appCode: "tableops" as AppCode,
    gradient: "from-[#1f1305] via-[#3a1f0a] to-[#3a1018]",
    accent: "#f59e0b",
    buttonVariant: "tableops" as const,
    sessionCookie: appSessionCookies.tableops,
    audience: "restaurants, chefs, kitchens, food trucks, pop-ups, franchises, hospitality teams",
    purpose: "TableOps Systems is a dedicated restaurant operations and training system.",
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
    name: "CivicSignal Network",
    short: "Public Info OS",
    route: "/civic",
    appCode: "civic_signal" as AppCode,
    gradient: "from-[#06151f] via-[#073328] to-[#082f49]",
    accent: "#34d399",
    buttonVariant: "civic" as const,
    sessionCookie: appSessionCookies.civic_signal,
    audience: "residents, local organizations, libraries, nonprofits, transit riders, public access teams, civic partners",
    purpose: "CivicSignal Network is a dedicated public information and local-access system.",
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

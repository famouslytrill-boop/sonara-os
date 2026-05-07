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
    name: "TrackFoundry",
    short: "Music Operating System",
    route: "/trackfoundry",
    appCode: "soundos" as AppCode,
    gradient: "from-[#16091f] via-[#1f1035] to-[#042f3a]",
    accent: "#a78bfa",
    buttonVariant: "music" as const,
    sessionCookie: appSessionCookies.soundos,
    audience: "artists, producers, labels, studios, creators",
    purpose: "TrackFoundry is a dedicated music identity, media intake, catalog, transcription, and release-readiness system.",
    nav: [
      ["Dashboard", "/trackfoundry/dashboard"],
      ["Artist Genome", "/trackfoundry/artist-genome"],
      ["Projects", "/trackfoundry/projects"],
      ["Catalog", "/trackfoundry/catalog"],
      ["Transcripts", "/trackfoundry/transcripts"],
      ["Exports", "/trackfoundry/exports"],
      ["Readiness", "/trackfoundry/release-readiness"],
      ["Settings", "/trackfoundry/settings"],
    ],
  },
  tableops: {
    name: "LineReady",
    short: "Hospitality Operating System",
    route: "/lineready",
    appCode: "tableos" as AppCode,
    gradient: "from-[#1f1305] via-[#3a1f0a] to-[#3a1018]",
    accent: "#f59e0b",
    buttonVariant: "tableops" as const,
    sessionCookie: appSessionCookies.tableos,
    audience: "restaurants, chefs, kitchens, food trucks, pop-ups, franchises, hospitality teams",
    purpose: "LineReady is a dedicated restaurant operations, labor, scheduling, training, vendor, document, and menu system.",
    nav: [
      ["Dashboard", "/lineready/dashboard"],
      ["Recipes", "/lineready/recipes"],
      ["Costing", "/lineready/costing"],
      ["Prep", "/lineready/prep"],
      ["Training", "/lineready/training"],
      ["Inventory", "/lineready/inventory"],
      ["Menus", "/lineready/menus"],
      ["Settings", "/lineready/settings"],
    ],
  },
  civic: {
    name: "NoticeGrid",
    short: "Public Information Operating System",
    route: "/noticegrid",
    appCode: "alertos" as AppCode,
    gradient: "from-[#06151f] via-[#073328] to-[#082f49]",
    accent: "#34d399",
    buttonVariant: "civic" as const,
    sessionCookie: appSessionCookies.alertos,
    audience: "residents, local organizations, libraries, nonprofits, transit riders, public access teams, civic partners",
    purpose: "NoticeGrid is a dedicated public feed, alert, notice, transit, weather, and approval-gated broadcast system.",
    nav: [
      ["Dashboard", "/noticegrid/dashboard"],
      ["Feed", "/noticegrid/feed"],
      ["Transit", "/noticegrid/transit"],
      ["Alerts", "/noticegrid/alerts"],
      ["Organizations", "/noticegrid/organizations"],
      ["Broadcast", "/noticegrid/broadcast"],
      ["Documents", "/noticegrid/documents"],
      ["Settings", "/noticegrid/settings"],
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

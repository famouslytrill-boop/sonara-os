import { appSessionCookies, type AppCode } from "./divisions";

export type SessionUser = { id: string; email: string; name?: string };

export type AppAuthScope = {
  currentApp: AppCode;
  sessionCookie: string;
  loginRoute: string;
  onboardingRoute: string;
  dashboardRoute: string;
};

export const appAuthScopes: Record<AppCode, AppAuthScope> = {
  parent_admin: {
    currentApp: "parent_admin",
    sessionCookie: appSessionCookies.parent_admin,
    loginRoute: "/admin/login",
    onboardingRoute: "/admin/dashboard",
    dashboardRoute: "/admin/dashboard",
  },
  soundos: {
    currentApp: "soundos",
    sessionCookie: appSessionCookies.soundos,
    loginRoute: "/trackfoundry/login",
    onboardingRoute: "/trackfoundry/onboarding",
    dashboardRoute: "/trackfoundry/dashboard",
  },
  tableos: {
    currentApp: "tableos",
    sessionCookie: appSessionCookies.tableos,
    loginRoute: "/lineready/login",
    onboardingRoute: "/lineready/onboarding",
    dashboardRoute: "/lineready/dashboard",
  },
  alertos: {
    currentApp: "alertos",
    sessionCookie: appSessionCookies.alertos,
    loginRoute: "/noticegrid/login",
    onboardingRoute: "/noticegrid/onboarding",
    dashboardRoute: "/noticegrid/dashboard",
  },
};

const appDisplayNames: Record<AppCode, string> = {
  parent_admin: "SONARA Industries",
  soundos: "TrackFoundry",
  tableos: "LineReady",
  alertos: "NoticeGrid",
};

export function getMockSession(): SessionUser | null {
  return null;
}

export function getAuthScope(app: AppCode) {
  return appAuthScopes[app];
}

export function getAuthGuardCopy(app: AppCode) {
  return `Protected ${appDisplayNames[app]} routes must verify product access, workspace membership, role permission, and plan entitlement before loading private data.`;
}

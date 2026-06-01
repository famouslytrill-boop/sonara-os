export const setupGatedStatus = "Setup gated" as const;

export const safeScaffoldCards = [
  {
    title: "No fake live integration",
    body: "This surface is available for planning and route readiness. Real provider actions remain disabled until environment variables, auth, RLS, and owner approval are configured.",
    status: setupGatedStatus,
  },
  {
    title: "Tenant scoped",
    body: "Records are designed around organizations, memberships, workspaces, and audit events instead of arbitrary user-created databases or cross-tenant access.",
    status: "RLS planned",
  },
  {
    title: "Human approval required",
    body: "Sensitive actions such as payments, publishing, outreach, data deletion, external tools, and permission changes require review before execution.",
    status: "Guarded",
  },
];

export const publicSafetySections = [
  {
    title: "Setup-gated by design",
    body: "Public pages describe product direction and readiness. They do not claim that external tools, paid providers, legal compliance, or production integrations are active.",
  },
  {
    title: "No unsafe automation",
    body: "SONARA does not expose piracy, surveillance, jailbreak, tactical, medical, legal, financial, or high-stakes decision systems to normal users.",
  },
];

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const root = join(process.cwd(), "sonara-industries");

function write(path, content) {
  const fullPath = join(root, path);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content.trimStart().replace(/\r\n/g, "\n") + "\n", "utf8");
}

const docs = {
  "docs/ARCHITECTURE.md": `
# SONARA Industries Architecture

SONARA Industries owns three separate operating companies: TrackFoundry, LineReady, and NoticeGrid.

The shared spines are security, billing, infrastructure, audit logging, deployment, and parent governance. Product surfaces, dashboards, onboarding, themes, customer data, and workflows remain separated by app scope.

## Subdomain Strategy

- sonaraindustries.com -> parent company website
- music.sonaraindustries.com -> TrackFoundry
- tableops.sonaraindustries.com -> LineReady
- civic.sonaraindustries.com -> NoticeGrid
- admin.sonaraindustries.com -> parent admin console
- api.sonaraindustries.com -> shared API gateway
- docs.sonaraindustries.com -> help/docs
- status.sonaraindustries.com -> status placeholder

Local development uses path-based routes for the same surfaces.
`,
  "docs/SECURITY.md": `
# Security

Every protected action must check identity, organization membership, app access, role permission, plan entitlement where needed, and audit history.

Security patterns:

- RBAC and organization isolation
- app-level data isolation
- audit logs and app access events
- secure CORS allowlist from env
- rate-limit middleware placeholder
- file type and file size validation
- malware scanning placeholder
- Stripe webhook signature verification placeholder
- admin approval placeholders for destructive actions
- least privilege service design

Do not expose Postgres to the public internet. Do not commit secrets. Service credentials belong in environment variables or managed secret stores.
`,
  "docs/DEPLOYMENT.md": `
# Deployment

Local development:

1. Install pnpm.
2. Copy .env.example to .env.
3. Run docker compose up -d postgres redis.
4. Install web dependencies with pnpm install.
5. Install API dependencies in apps/api.
6. Run Alembic migrations.
7. Start API and web dev servers.

Production options:

- Vercel or Cloudflare Pages for the frontend.
- Managed PostgreSQL with backups.
- Managed Redis for queues/cache.
- Object storage for uploads.
- API on a container host or serverless container platform.

Cloud services can have free tiers, but production hosting is not assumed to be free forever.
`,
  "docs/BILLING.md": `
# Billing

Stripe Billing is the shared provider. Product groups must stay separated by app_code:

- trackfoundry
- tableops
- noticegrid

Stripe Connect-ready architecture is planned, but marketplace payouts are not implemented at launch.

The webhook route records events and should verify signatures before state changes. No fake active subscriptions are allowed.
`,
  "docs/DATA_MODEL.md": `
# Data Model

The data model is organization-first and app-scoped. Most business tables include organization_id and app so data cannot accidentally cross product boundaries.

Important tables include users, organizations, memberships, app_permissions, subscriptions, assets, transcripts, ingestion_jobs, public_feed_items, music_projects, music_exports, restaurant_recipes, restaurant_prep_items, audit_logs, app_access_events, and system_health_events.

Use indexes for app scope, organization scope, and recent activity. Enable RLS in production.
`,
  "docs/APP_SEPARATION.md": `
# App Separation

TrackFoundry, LineReady, and NoticeGrid are separate operating systems.

Shared:

- parent ownership
- billing spine
- security spine
- infrastructure spine
- audit logging
- parent admin governance
- deployment pipeline

Not shared:

- customer dashboards
- customer records
- app analytics
- app workflows
- onboarding
- pricing
- permissions beyond parent admin governance
`,
  "docs/CIVIC_DATA_POLICY.md": `
# Civic Data Policy

NoticeGrid aggregates public information from source-linked feeds and public websites. It is not an official government authority unless a verified public partner grants that status.

Public information should include source links, timestamps, confidence labels, and correction/takedown paths.

Confidence labels:

- official_source
- verified_partner
- public_web_source
- community_submitted
- needs_review
`,
  "docs/LAUNCH_CHECKLIST.md": `
# Launch Checklist

- Auth works.
- Billing works.
- Upload works.
- Export works.
- Audit logs work.
- Basic docs exist.
- Privacy/terms pages exist.
- Admin dashboard works.
- Backups configured.
- Monitoring configured.
- Security headers configured.
- Trademark search completed.
- Test users completed onboarding.
- At least one real customer workflow completed per app.
`,
};

const files = {
  "README.md": `
# SONARA Industries Operating Systems

A production-ready starter monorepo for SONARA Industries, the parent company for three separate operating companies and software systems.

## Operating Companies

- TrackFoundry: music identity, artist development, creative catalog, prompt export, and release-readiness.
- LineReady: restaurant operations, recipe R&D, costing, prep, training, QR menu, SOP, and inventory signals.
- NoticeGrid: public access, local information, RSS, transit feeds, civic announcements, community broadcast, alerts, and public documents.

The apps are deliberately separate. Customer data, dashboards, analytics, onboarding, pricing, permissions, and workflows stay separated unless explicitly authorized by the user and parent admin policy.

## Local Development

1. Install pnpm.
2. Install Python 3.12+.
3. Copy .env.example to .env.
4. Run docker compose up -d postgres redis.
5. Run pnpm install.
6. From apps/api, install dependencies and run Alembic migrations.
7. Start the API: uvicorn app.main:app --reload.
8. Start the web app: pnpm --filter @sonara-industries/web dev.
9. Open http://localhost:3000.
10. Test http://localhost:8000/health.

## Security Notes

Do not commit secrets. Do not expose Postgres directly to the public internet. NoticeGrid is a public information aggregator unless verified by a public partner.
`,
  "package.json": `
{
  "name": "sonara-industries-operating-systems",
  "version": "0.1.0",
  "private": true,
  "packageManager": "pnpm@9.15.4",
  "scripts": {
    "dev": "pnpm --parallel --filter @sonara-industries/web dev",
    "dev:web": "pnpm --filter @sonara-industries/web dev",
    "build": "pnpm --filter @sonara-industries/web build",
    "lint": "pnpm --filter @sonara-industries/web lint",
    "typecheck": "pnpm --filter @sonara-industries/web typecheck",
    "test": "pnpm --filter @sonara-industries/web test"
  },
  "devDependencies": {}
}
`,
  "pnpm-workspace.yaml": `
packages:
  - "apps/*"
`,
  ".gitignore": `
node_modules
.next
dist
build
.env
.env.*
!.env.example
.venv
__pycache__
.pytest_cache
.mypy_cache
*.pyc
*.log
`,
  ".env.example": `
POSTGRES_USER=sonara
POSTGRES_PASSWORD=change_me
POSTGRES_DB=sonara_industries
DATABASE_URL=postgresql+psycopg://sonara:change_me@localhost:5432/sonara_industries
REDIS_URL=redis://localhost:6379/0
JWT_SECRET=change_me_in_production
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
CORS_ORIGINS=http://localhost:3000
ENVIRONMENT=development
NEXT_PUBLIC_API_URL=http://localhost:8000
`,
  "docker-compose.yml": `
services:
  postgres:
    image: postgres:18
    environment:
      POSTGRES_USER: \${POSTGRES_USER:-sonara}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:-change_me}
      POSTGRES_DB: \${POSTGRES_DB:-sonara_industries}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
  api:
    build:
      context: ./apps/api
    env_file: .env
    depends_on:
      - postgres
      - redis
    ports:
      - "8000:8000"
  web:
    build:
      context: ./apps/web
    environment:
      NEXT_PUBLIC_API_URL: \${NEXT_PUBLIC_API_URL:-http://localhost:8000}
    depends_on:
      - api
    ports:
      - "3000:3000"
volumes:
  postgres_data:
`,
  ...docs,
  "apps/web/package.json": `
{
  "name": "@sonara-industries/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint || eslint .",
    "typecheck": "tsc --noEmit",
    "test": "node -e \\"console.log('frontend smoke tests placeholder')\\""
  },
  "dependencies": {
    "next": "16.2.4",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "lucide-react": "^1.14.0",
    "clsx": "^2.1.1"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.2.4",
    "@types/node": "^24.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "eslint": "^9.0.0",
    "eslint-config-next": "16.2.4",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.0.0"
  }
}
`,
  "apps/web/next.config.ts": `
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false
};

export default nextConfig;
`,
  "apps/web/tsconfig.json": `
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
`,
  "apps/web/tailwind.config.ts": `
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: []
};

export default config;
`,
  "apps/web/postcss.config.mjs": `
const config = {
  plugins: {
    "@tailwindcss/postcss": {}
  }
};

export default config;
`,
  "apps/web/app/globals.css": `
@import "tailwindcss";

:root {
  color-scheme: dark;
  --parent-bg: #070913;
  --parent-card: #111827;
  --parent-border: #243044;
  --text: #f8fafc;
  --muted: #a7b0c0;
}

* { box-sizing: border-box; }
body {
  margin: 0;
  background: radial-gradient(circle at 20% 0%, rgba(99,102,241,.22), transparent 30%), var(--parent-bg);
  color: var(--text);
  font-family: Arial, Helvetica, sans-serif;
}
a { color: inherit; text-decoration: none; }
:focus-visible { outline: 3px solid #38bdf8; outline-offset: 3px; }
.page { min-height: 100vh; }
.container { width: min(1180px, calc(100% - 32px)); margin: 0 auto; }
.grid-auto { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem; }
`,
  "apps/web/app/layout.tsx": `
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SONARA Industries Operating Systems",
  description: "Separate operating systems with shared security, billing, and infrastructure discipline."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`,
};

const libFiles = {
  "apps/web/lib/divisions.ts": `
export type AppCode = "parent_admin" | "trackfoundry" | "tableops" | "noticegrid";

export const divisions = {
  parent: {
    name: "SONARA Industries",
    short: "Parent Company",
    route: "/",
    appCode: "parent_admin" as AppCode,
    gradient: "from-slate-950 via-indigo-950 to-slate-950",
    accent: "#38bdf8"
  },
  music: {
    name: "TrackFoundry",
    short: "Music OS",
    route: "/music",
    appCode: "trackfoundry" as AppCode,
    gradient: "from-violet-950 via-fuchsia-950 to-cyan-950",
    accent: "#a78bfa",
    audience: "artists, producers, songwriters, labels, managers, creators",
    purpose: "Music identity, artist development, creative catalog, prompt export, and release-readiness."
  },
  tableops: {
    name: "LineReady",
    short: "Kitchen OS",
    route: "/tableops",
    appCode: "tableops" as AppCode,
    gradient: "from-stone-950 via-orange-950 to-rose-950",
    accent: "#f59e0b",
    audience: "restaurants, chefs, kitchens, food trucks, pop-ups, franchises, hospitality teams",
    purpose: "Restaurant operations, recipe R&D, costing, prep, training, QR menu, SOP, and inventory signals."
  },
  civic: {
    name: "NoticeGrid",
    short: "Public Info OS",
    route: "/civic",
    appCode: "noticegrid" as AppCode,
    gradient: "from-slate-950 via-emerald-950 to-sky-950",
    accent: "#34d399",
    audience: "residents, local organizations, libraries, nonprofits, transit riders, public access teams, civic partners",
    purpose: "Public access, local information, RSS, transit feeds, civic announcements, alerts, and public documents."
  }
} as const;
`,
  "apps/web/lib/pricing.ts": `
export const pricing = {
  trackfoundry: [
    { name: "Free", price: "$0", features: ["3 projects", "Basic prompt builder", "Basic catalog vault", "Limited exports"] },
    { name: "Creator", price: "$19/month", features: ["More projects", "Audio/video transcription", "Export bundles", "Release-readiness checklist"] },
    { name: "Pro", price: "$49/month", features: ["Larger catalog", "Advanced Artist Genome", "Anti-Repetition Engine", "DAW export prep"] },
    { name: "Label", price: "$199/month", features: ["Team workspaces", "Release planning", "Brand/campaign systems", "Audit history"] },
    { name: "Enterprise", price: "Custom", features: ["Security review", "Custom workflow", "Priority support"] }
  ],
  tableops: [
    { name: "Free", price: "$0", features: ["1 location", "Basic recipe vault", "Limited QR menu"] },
    { name: "Starter", price: "$39/month", features: ["Recipe costing", "Prep lists", "Staff training"] },
    { name: "Kitchen Pro", price: "$99/month", features: ["Food cost engine", "Supplier notes", "Training vault", "Shift command"] },
    { name: "Multi-location", price: "$299/month", features: ["Multi-location dashboards", "Team permissions", "Inventory signals"] },
    { name: "Enterprise", price: "Custom", features: ["Franchise controls", "Custom integrations", "Procurement support"] }
  ],
  noticegrid: [
    { name: "Public", price: "$0", features: ["Local public feed", "Public search", "Source links"] },
    { name: "Community", price: "$19/month", features: ["Organization profile", "Announcements", "Public links"] },
    { name: "Nonprofit/Library", price: "$99/month", features: ["Document imports", "Event feeds", "Broadcast posts"] },
    { name: "Public Access", price: "$399/month", features: ["Feed management", "Local broadcast tools", "Transcript archive", "Team roles"] },
    { name: "Enterprise/Municipal", price: "Custom", features: ["Partner verification", "Governance workflows", "Advanced reporting"] }
  ]
} as const;
`,
  "apps/web/lib/routes.ts": `
export const routes = {
  parent: ["/", "/trust", "/privacy", "/terms", "/accessibility", "/docs", "/status"],
  music: ["/music", "/music/login", "/music/onboarding", "/music/dashboard", "/music/pricing"],
  tableops: ["/tableops", "/tableops/login", "/tableops/onboarding", "/tableops/dashboard", "/tableops/pricing"],
  civic: ["/civic", "/civic/login", "/civic/onboarding", "/civic/dashboard", "/civic/pricing"],
  admin: ["/admin/login", "/admin/dashboard"]
} as const;
`,
  "apps/web/lib/api.ts": `
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(\`\${API_URL}\${path}\`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }
  });
  if (!response.ok) throw new Error(\`API request failed: \${response.status}\`);
  return response.json() as Promise<T>;
}

export const api = {
  getCurrentUser: () => request("/auth/me"),
  getOrganizations: () => request("/organizations"),
  getAssets: () => request("/media/assets"),
  uploadAsset: (payload: unknown) => request("/media/upload", { method: "POST", body: JSON.stringify(payload) }),
  getMusicProjects: () => request("/music/projects"),
  createMusicProject: (payload: unknown) => request("/music/projects", { method: "POST", body: JSON.stringify(payload) }),
  getRecipes: () => request("/tableops/recipes"),
  createRecipe: (payload: unknown) => request("/tableops/recipes", { method: "POST", body: JSON.stringify(payload) }),
  getPublicFeed: () => request("/civic/feed"),
  createIngestionJob: (payload: unknown) => request("/ingestion/jobs", { method: "POST", body: JSON.stringify(payload) }),
  getAuditLogs: () => request("/audit/logs")
};
`,
  "apps/web/lib/auth.ts": `
export type SessionUser = { id: string; email: string; name?: string };

export function getMockSession(): SessionUser | null {
  return null;
}
`,
  "apps/web/lib/constants.ts": `
export const parentCopy = {
  headline: "Independent operating systems. Shared discipline. One parent company.",
  governance: "SONARA Industries owns and governs separate operating systems with one shared security spine, billing spine, infrastructure spine, and strict data boundaries between each company.",
  separation: "Each operating company serves its own market. Customer data, dashboards, analytics, and workflows stay separated unless explicitly authorized.",
  security: "Every protected action is checked against identity, organization membership, app access, role permission, plan entitlement, and audit history.",
  openSource: "Built free/open-source first where practical, with production-aware upgrade paths when scale and revenue justify them.",
  civicDisclaimer: "NoticeGrid aggregates public information from source-linked feeds and public websites. It is not an official government authority unless a verified public partner grants that status."
} as const;
`,
  "apps/web/lib/theme.ts": `
export const themes = {
  parent: "bg-slate-950 text-slate-50",
  music: "bg-violet-950 text-white",
  tableops: "bg-stone-950 text-white",
  civic: "bg-slate-950 text-white",
  admin: "bg-slate-950 text-white"
} as const;
`,
};

Object.assign(files, libFiles);

const ui = {
  "apps/web/components/ui/Button.tsx": `
import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Button({ children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={\`rounded-2xl bg-white px-4 py-2 font-bold text-slate-950 transition hover:bg-slate-200 \${className}\`} {...props}>{children}</button>;
}

export function ButtonLink({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return <Link className={\`inline-flex rounded-2xl bg-white px-4 py-2 font-bold text-slate-950 transition hover:bg-slate-200 \${className}\`} href={href}>{children}</Link>;
}
`,
  "apps/web/components/ui/Card.tsx": `
import type { ReactNode } from "react";

export function Card({ title, children, accent }: { title?: string; children: ReactNode; accent?: string }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl backdrop-blur">
      {title ? <h3 className="mb-3 text-lg font-black" style={{ color: accent }}>{title}</h3> : null}
      {children}
    </section>
  );
}
`,
  "apps/web/components/ui/Badge.tsx": `
export function Badge({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-200">{children}</span>;
}
`,
  "apps/web/components/ui/Input.tsx": `
import type { InputHTMLAttributes } from "react";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="min-h-11 w-full rounded-2xl border border-white/10 bg-black/20 px-3 text-white placeholder:text-slate-500" {...props} />;
}
`,
  "apps/web/components/ui/Tabs.tsx": `
export function Tabs({ items }: { items: string[] }) {
  return <div className="flex flex-wrap gap-2">{items.map((item) => <button className="rounded-full border border-white/10 px-3 py-2 text-sm font-bold" key={item}>{item}</button>)}</div>;
}
`,
  "apps/web/components/ui/StatCard.tsx": `
export function StatCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-3xl border border-white/10 bg-black/20 p-4"><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-3xl font-black">{value}</p></div>;
}
`,
  "apps/web/components/ui/FeatureGrid.tsx": `
import { Card } from "./Card";

export function FeatureGrid({ features }: { features: string[] }) {
  return <div className="grid-auto">{features.map((feature) => <Card key={feature}><p className="font-bold">{feature}</p></Card>)}</div>;
}
`,
  "apps/web/components/ui/PricingCard.tsx": `
import { Card } from "./Card";

export function PricingCard({ plan }: { plan: { name: string; price: string; features: readonly string[] } }) {
  return <Card title={plan.name}><p className="text-3xl font-black">{plan.price}</p><ul className="mt-4 grid gap-2 text-sm text-slate-300">{plan.features.map((f) => <li key={f}>â€¢ {f}</li>)}</ul></Card>;
}
`,
  "apps/web/components/ui/EmptyState.tsx": `
export function EmptyState({ title, body }: { title: string; body: string }) {
  return <div className="rounded-3xl border border-dashed border-white/20 p-6 text-center"><h3 className="font-black">{title}</h3><p className="mt-2 text-sm text-slate-400">{body}</p></div>;
}
`,
  "apps/web/components/ui/SecurityNotice.tsx": `
import { ShieldCheck } from "lucide-react";

export function SecurityNotice({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-3 rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm text-cyan-100"><ShieldCheck className="shrink-0" size={20} />{children}</div>;
}
`,
};

Object.assign(files, ui);

const layout = {
  "apps/web/components/layout/MarketingNav.tsx": `
import Link from "next/link";

const links = [["TrackFoundry", "/music"], ["LineReady", "/tableops"], ["NoticeGrid", "/civic"], ["Docs", "/docs"], ["Trust", "/trust"]];

export function MarketingNav() {
  return <nav className="container flex flex-wrap items-center justify-between gap-3 py-5"><Link href="/" className="text-lg font-black">SONARA Industries</Link><div className="flex flex-wrap gap-3 text-sm text-slate-300">{links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</div></nav>;
}
`,
  "apps/web/components/layout/BrandShell.tsx": `
import { MarketingNav } from "./MarketingNav";

export function BrandShell({ children }: { children: React.ReactNode }) {
  return <main className="page"><MarketingNav /><div className="container pb-16">{children}</div></main>;
}
`,
  "apps/web/components/layout/DivisionShell.tsx": `
import Link from "next/link";
import { divisions } from "@/lib/divisions";

type DivisionKey = "music" | "tableops" | "civic";

export function DivisionShell({ division, children }: { division: DivisionKey; children: React.ReactNode }) {
  const item = divisions[division];
  return <main className={\`page bg-gradient-to-br \${item.gradient}\`}><div className="container py-5"><nav className="flex flex-wrap justify-between gap-3"><Link href={item.route} className="font-black">{item.name}</Link><div className="flex gap-3 text-sm"><Link href={\`\${item.route}/dashboard\`}>Dashboard</Link><Link href={\`\${item.route}/pricing\`}>Pricing</Link><Link href="/">Parent</Link></div></nav><div className="py-10">{children}</div></div></main>;
}
`,
  "apps/web/components/layout/DashboardShell.tsx": `
import { AppSidebar } from "./AppSidebar";

export function DashboardShell({ app, children }: { app: string; children: React.ReactNode }) {
  return <div className="grid gap-5 lg:grid-cols-[240px_1fr]"><AppSidebar app={app} /><section>{children}</section></div>;
}
`,
  "apps/web/components/layout/AppSidebar.tsx": `
export function AppSidebar({ app }: { app: string }) {
  return <aside className="rounded-3xl border border-white/10 bg-black/20 p-4"><p className="text-xs font-black uppercase text-slate-400">{app}</p><ul className="mt-4 grid gap-2 text-sm"><li>Dashboard</li><li>Assets</li><li>Ingestion</li><li>Audit</li><li>Settings</li></ul></aside>;
}
`,
  "apps/web/components/layout/BrandShell.tsx": `
import { MarketingNav } from "./MarketingNav";

export function BrandShell({ children }: { children: React.ReactNode }) {
  return <main className="page"><MarketingNav /><div className="container pb-16">{children}</div></main>;
}
`,
};

Object.assign(files, layout);

const sonaraComponents = {
  "apps/web/components/sonara/ParentHero.tsx": `
import { parentCopy } from "@/lib/constants";
import { ButtonLink } from "@/components/ui/Button";

export function ParentHero() {
  return <section className="py-16"><p className="text-sm font-black uppercase text-cyan-300">SONARA Industries</p><h1 className="mt-4 max-w-4xl text-5xl font-black leading-tight md:text-7xl">{parentCopy.headline}</h1><p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">{parentCopy.governance}</p><div className="mt-8 flex flex-wrap gap-3"><ButtonLink href="/music">Open TrackFoundry</ButtonLink><ButtonLink href="/tableops">Open LineReady</ButtonLink><ButtonLink href="/civic">Open NoticeGrid</ButtonLink></div></section>;
}
`,
  "apps/web/components/sonara/DivisionTabs.tsx": `
import Link from "next/link";
import { divisions } from "@/lib/divisions";
import { Card } from "@/components/ui/Card";

export function DivisionTabs() {
  return <div className="grid-auto">{(["music", "tableops", "civic"] as const).map((key) => { const d = divisions[key]; return <Link key={key} href={d.route}><Card title={d.name} accent={d.accent}><p className="text-sm text-slate-300">{d.purpose}</p><p className="mt-3 text-xs text-slate-400">Audience: {d.audience}</p></Card></Link>; })}</div>;
}
`,
  "apps/web/components/sonara/TrustCenter.tsx": `
import { SecurityNotice } from "@/components/ui/SecurityNotice";
import { parentCopy } from "@/lib/constants";

export function TrustCenter() {
  return <SecurityNotice>{parentCopy.security}</SecurityNotice>;
}
`,
  "apps/web/components/sonara/MoatEngine.tsx": `
import { FeatureGrid } from "@/components/ui/FeatureGrid";

export function MoatEngine() {
  return <FeatureGrid features={["Strict app separation", "Audit history", "Billing spine", "Security spine", "Open-source-first upgrade path", "Parent governance"]} />;
}
`,
  "apps/web/components/sonara/LaunchGates.tsx": `
import { Card } from "@/components/ui/Card";

export function LaunchGates() {
  return <Card title="Launch Gates"><ul className="grid gap-2 text-sm text-slate-300"><li>Auth verified</li><li>Billing verified</li><li>Upload and export tested</li><li>Audit logs active</li><li>Backups configured</li></ul></Card>;
}
`,
  "apps/web/components/sonara/OperatingRules.tsx": `
import { Card } from "@/components/ui/Card";
import { parentCopy } from "@/lib/constants";

export function OperatingRules() {
  return <Card title="Operating Rules"><p className="text-slate-300">{parentCopy.separation}</p><p className="mt-3 text-slate-300">{parentCopy.openSource}</p><p className="mt-3 text-slate-300">{parentCopy.civicDisclaimer}</p></Card>;
}
`,
};
Object.assign(files, sonaraComponents);

const panel = (path, title, body) => {
  files[path] = `
import { Card } from "@/components/ui/Card";

export function ${title.replace(/[^A-Za-z0-9]/g, "")}() {
  return <Card title="${title}"><p className="text-sm leading-6 text-slate-300">${body}</p></Card>;
}
`;
};

panel("apps/web/components/music/ArtistGenomePanel.tsx", "Artist Genome", "Structured identity notes, sonic references, release goals, and catalog direction for music creators.");
panel("apps/web/components/music/ReleaseReadinessPanel.tsx", "Release Readiness", "A scoring surface for metadata, arrangement clarity, export completeness, and quality warnings.");
panel("apps/web/components/music/PromptExportPanel.tsx", "Prompt Export Hub", "Export-ready prompts and production notes for traditional, AI-assisted, and hybrid workflows.");
panel("apps/web/components/music/CatalogVaultPanel.tsx", "Catalog Vault", "A rights-aware catalog workspace for projects, transcripts, exports, and assets.");
panel("apps/web/components/tableops/RecipeLabPanel.tsx", "Recipe R&D Lab", "A structured lab for recipes, iterations, SOPs, prep notes, and training media.");
panel("apps/web/components/tableops/FoodCostPanel.tsx", "Food Cost Engine", "Estimate cost, margin, sell price, and pricing risk before menu changes go live.");
panel("apps/web/components/tableops/PrepListPanel.tsx", "Prep Lists", "Convert recipes and operating notes into clean prep and shift command tasks.");
panel("apps/web/components/tableops/TrainingVaultPanel.tsx", "Training Vault", "Store training videos, SOPs, station notes, and onboarding materials for hospitality teams.");
panel("apps/web/components/civic/PublicFeedPanel.tsx", "Local Public Feed", "Source-linked public information with timestamps, confidence labels, and correction paths.");
panel("apps/web/components/civic/TransitFeedPanel.tsx", "Transit Feed", "GTFS static and realtime placeholders for future transit notice normalization.");
panel("apps/web/components/civic/OrganizationProfilePanel.tsx", "Organization Profiles", "Public organization pages for libraries, nonprofits, local teams, and verified partners.");
panel("apps/web/components/civic/BroadcastPanel.tsx", "Community Broadcast", "Broadcast posts, transcript archive placeholders, and public access workflows.");

files["apps/web/components/music/MusicDashboard.tsx"] = `
import { DashboardShell } from "@/components/layout/DashboardShell";
import { StatCard } from "@/components/ui/StatCard";
import { ArtistGenomePanel } from "./ArtistGenomePanel";
import { ReleaseReadinessPanel } from "./ReleaseReadinessPanel";
import { PromptExportPanel } from "./PromptExportPanel";
import { CatalogVaultPanel } from "./CatalogVaultPanel";

export function MusicDashboard() {
  return <DashboardShell app="TrackFoundry"><div className="grid-auto"><StatCard label="Active Projects" value="12" /><StatCard label="Release Readiness" value="84%" /><StatCard label="Prompt Exports" value="37" /><StatCard label="Catalog Assets" value="124" /></div><div className="mt-5 grid-auto"><ArtistGenomePanel /><ReleaseReadinessPanel /><PromptExportPanel /><CatalogVaultPanel /></div></DashboardShell>;
}
`;
files["apps/web/components/tableops/LineReadyDashboard.tsx"] = `
import { DashboardShell } from "@/components/layout/DashboardShell";
import { StatCard } from "@/components/ui/StatCard";
import { RecipeRDLab } from "./RecipeLabPanel";
import { FoodCostEngine } from "./FoodCostPanel";
import { PrepLists } from "./PrepListPanel";
import { TrainingVault } from "./TrainingVaultPanel";

export function LineReadyDashboard() {
  return <DashboardShell app="LineReady"><div className="grid-auto"><StatCard label="Active Recipes" value="42" /><StatCard label="Food Cost %" value="28%" /><StatCard label="Prep Lists" value="9" /><StatCard label="Training Items" value="18" /></div><div className="mt-5 grid-auto"><RecipeRDLab /><FoodCostEngine /><PrepLists /><TrainingVault /></div></DashboardShell>;
}
`;
files["apps/web/components/civic/CivicDashboard.tsx"] = `
import { DashboardShell } from "@/components/layout/DashboardShell";
import { StatCard } from "@/components/ui/StatCard";
import { LocalPublicFeed } from "./PublicFeedPanel";
import { TransitFeed } from "./TransitFeedPanel";
import { OrganizationProfiles } from "./OrganizationProfilePanel";
import { CommunityBroadcast } from "./BroadcastPanel";

export function CivicDashboard() {
  return <DashboardShell app="NoticeGrid"><div className="grid-auto"><StatCard label="Local Feed" value="86" /><StatCard label="Transit Notices" value="7" /><StatCard label="Public Meetings" value="14" /><StatCard label="Organization Posts" value="33" /></div><div className="mt-5 grid-auto"><LocalPublicFeed /><TransitFeed /><OrganizationProfiles /><CommunityBroadcast /></div></DashboardShell>;
}
`;

const page = (path, content) => (files[`apps/web/app/${path}`] = content);
page("page.tsx", `
import { BrandShell } from "@/components/layout/BrandShell";
import { ParentHero } from "@/components/sonara/ParentHero";
import { DivisionTabs } from "@/components/sonara/DivisionTabs";
import { TrustCenter } from "@/components/sonara/TrustCenter";
import { MoatEngine } from "@/components/sonara/MoatEngine";
import { LaunchGates } from "@/components/sonara/LaunchGates";
import { OperatingRules } from "@/components/sonara/OperatingRules";

export default function Page() {
  return <BrandShell><ParentHero /><DivisionTabs /><section className="mt-8"><TrustCenter /></section><section className="mt-8"><MoatEngine /></section><section className="mt-8 grid-auto"><LaunchGates /><OperatingRules /></section></BrandShell>;
}
`);

function divisionLanding(key, name, tagline) {
  return `
import { DivisionShell } from "@/components/layout/DivisionShell";
import { FeatureGrid } from "@/components/ui/FeatureGrid";
import { ButtonLink } from "@/components/ui/Button";

export default function Page() {
  return <DivisionShell division="${key}"><p className="text-sm font-black uppercase text-white/70">${name}</p><h1 className="mt-4 max-w-3xl text-5xl font-black">${tagline}</h1><p className="mt-5 max-w-3xl text-lg leading-8 text-white/75">A separate operating system with its own onboarding, dashboard, pricing, permissions, and data boundaries.</p><div className="mt-7 flex gap-3"><ButtonLink href="/${key}/onboarding">Start onboarding</ButtonLink><ButtonLink href="/${key}/pricing">View pricing</ButtonLink></div><section className="mt-10"><FeatureGrid features={["Dedicated app scope", "Separate customer data", "Role-based permissions", "Audit history", "Upload and export placeholders", "Search/filter/sort dashboards"]} /></section></DivisionShell>;
}
`;
}

page("music/page.tsx", divisionLanding("music", "TrackFoundry", "Music identity and release-readiness operating system."));
page("tableops/page.tsx", divisionLanding("tableops", "LineReady", "Kitchen command and restaurant operations operating system."));
page("civic/page.tsx", divisionLanding("civic", "NoticeGrid", "Source-linked public information and community broadcast operating system."));

function simplePage(route, title, body) {
  page(`${route}/page.tsx`, `
import { BrandShell } from "@/components/layout/BrandShell";
import { Card } from "@/components/ui/Card";

export default function Page() {
  return <BrandShell><Card title="${title}"><p className="text-slate-300">${body}</p></Card></BrandShell>;
}
`);
}

["trust", "privacy", "terms", "accessibility", "docs", "status"].forEach((route) => simplePage(route, route[0].toUpperCase() + route.slice(1), "Starter page for SONARA Industries governance, compliance, and support documentation."));
simplePage("admin/login", "Parent Admin Login", "Parent admin access is separate from operating company customer accounts.");
page("admin/dashboard/page.tsx", `
import { BrandShell } from "@/components/layout/BrandShell";
import { StatCard } from "@/components/ui/StatCard";
import { SecurityNotice } from "@/components/ui/SecurityNotice";

export default function Page() {
  return <BrandShell><h1 className="text-4xl font-black">Parent Governance Console</h1><div className="mt-6 grid-auto"><StatCard label="Organizations" value="0" /><StatCard label="Users" value="0" /><StatCard label="Subscriptions" value="0" /><StatCard label="Security Events" value="0" /></div><section className="mt-6"><SecurityNotice>Parent admin can govern organizations, app access, billing, audit logs, security events, system health, ingestion jobs, and support tools.</SecurityNotice></section></BrandShell>;
}
`);

["music", "tableops", "civic"].forEach((key) => {
  simplePage(`${key}/login`, `${key} Login`, "This route is reserved for this app's separate login surface.");
  simplePage(`${key}/onboarding`, `${key} Onboarding`, "This app has its own onboarding and customer setup workflow.");
});
page("music/dashboard/page.tsx", `import { DivisionShell } from "@/components/layout/DivisionShell"; import { MusicDashboard } from "@/components/music/MusicDashboard"; export default function Page(){ return <DivisionShell division="music"><MusicDashboard /></DivisionShell>; }`);
page("tableops/dashboard/page.tsx", `import { DivisionShell } from "@/components/layout/DivisionShell"; import { LineReadyDashboard } from "@/components/tableops/LineReadyDashboard"; export default function Page(){ return <DivisionShell division="tableops"><LineReadyDashboard /></DivisionShell>; }`);
page("civic/dashboard/page.tsx", `import { DivisionShell } from "@/components/layout/DivisionShell"; import { CivicDashboard } from "@/components/civic/CivicDashboard"; export default function Page(){ return <DivisionShell division="civic"><CivicDashboard /></DivisionShell>; }`);

function pricingPage(key, appCode) {
  page(`${key}/pricing/page.tsx`, `
import { DivisionShell } from "@/components/layout/DivisionShell";
import { PricingCard } from "@/components/ui/PricingCard";
import { pricing } from "@/lib/pricing";

export default function Page() {
  return <DivisionShell division="${key}"><h1 className="text-4xl font-black">Pricing</h1><p className="mt-3 text-white/70">Separate product group: ${appCode}. Stripe Billing-ready, no fake active subscriptions.</p><div className="mt-6 grid-auto">{pricing.${appCode}.map((plan) => <PricingCard key={plan.name} plan={plan} />)}</div></DivisionShell>;
}
`);
}
pricingPage("music", "trackfoundry");
pricingPage("tableops", "tableops");
pricingPage("civic", "noticegrid");

const py = {};
py["apps/api/pyproject.toml"] = `
[project]
name = "sonara-industries-api"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
  "fastapi>=0.115.0",
  "uvicorn[standard]>=0.30.0",
  "pydantic>=2.8.0",
  "pydantic-settings>=2.4.0",
  "sqlalchemy>=2.0.0",
  "alembic>=1.13.0",
  "psycopg[binary]>=3.2.0",
  "python-jose[cryptography]>=3.3.0",
  "passlib[bcrypt]>=1.7.4",
  "redis>=5.0.0",
  "httpx>=0.27.0",
  "pytest>=8.0.0",
  "feedparser>=6.0.11"
]

[tool.pytest.ini_options]
testpaths = ["app/tests"]
`;
py["apps/api/Dockerfile"] = `
FROM python:3.12-slim
WORKDIR /app
COPY pyproject.toml ./
RUN pip install --no-cache-dir .
COPY app ./app
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
`;
py["apps/api/alembic.ini"] = `
[alembic]
script_location = app/migrations
sqlalchemy.url = %(DATABASE_URL)s
`;
py["apps/api/app/core/config.py"] = `
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    environment: str = "development"
    database_url: str = "postgresql+psycopg://sonara:change_me@localhost:5432/sonara_industries"
    redis_url: str = "redis://localhost:6379/0"
    jwt_secret: str = "dev-only-change-me"
    cors_origins: str = "http://localhost:3000"
    stripe_secret_key: str | None = None
    stripe_webhook_secret: str | None = None

    @property
    def cors_allowlist(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

settings = Settings()
`;
py["apps/api/app/core/logging.py"] = `
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("sonara_industries")
`;
py["apps/api/app/core/cors.py"] = `
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings

def add_cors(app):
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allowlist,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
`;
py["apps/api/app/core/rate_limit.py"] = `
from fastapi import Request

async def rate_limit_placeholder(request: Request) -> None:
    # TODO: wire Redis-backed rate limiting per route and organization.
    return None
`;
py["apps/api/app/core/security.py"] = `
from dataclasses import dataclass
from fastapi import Header, HTTPException
from uuid import UUID, uuid4

@dataclass
class CurrentUser:
    id: UUID
    email: str
    is_superuser: bool = False

async def get_current_user(authorization: str | None = Header(default=None)) -> CurrentUser:
    if not authorization:
        raise HTTPException(status_code=401, detail="authentication_required")
    token = authorization.replace("Bearer ", "")
    if token == "dev-superuser":
        return CurrentUser(id=uuid4(), email="admin@sonaraindustries.local", is_superuser=True)
    if token.startswith("dev-"):
        return CurrentUser(id=uuid4(), email="user@sonaraindustries.local")
    raise HTTPException(status_code=401, detail="invalid_token")
`;
py["apps/api/app/core/audit.py"] = `
from app.services.audit_service import create_app_access_event

async def audit_access(**kwargs):
    await create_app_access_event(**kwargs)
`;
py["apps/api/app/core/permissions.py"] = `
from collections.abc import Callable
from fastapi import Depends, HTTPException, Request
from app.core.security import CurrentUser, get_current_user
from app.services.permission_service import has_role_permission
from app.services.audit_service import create_app_access_event

def require_app_permission(app_code: str, permission: str) -> Callable:
    async def dependency(request: Request, user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        role = request.headers.get("x-sonara-role", "viewer")
        organization_id = request.headers.get("x-sonara-organization-id")
        allowed = user.is_superuser or has_role_permission(app_code, role, permission)
        await create_app_access_event(
            user_id=str(user.id),
            organization_id=organization_id,
            app=app_code,
            action=permission,
            allowed=allowed,
            reason=None if allowed else "missing_permission",
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
        if not allowed:
            raise HTTPException(status_code=403, detail="permission_denied")
        return user
    return dependency
`;
py["apps/api/app/db/session.py"] = `
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
`;
py["apps/api/app/db/base.py"] = `
from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    pass
`;
py["apps/api/app/db/init_db.py"] = `
from app.db.base import Base
from app.db.session import engine
from app.db import models  # noqa: F401

def init_db() -> None:
    Base.metadata.create_all(bind=engine)
`;

py["apps/api/app/db/models.py"] = `
import enum
import uuid
from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Index, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class AppCode(str, enum.Enum):
    parent_admin = "parent_admin"
    trackfoundry = "trackfoundry"
    tableops = "tableops"
    noticegrid = "noticegrid"

class User(Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False, index=True)
    full_name: Mapped[str | None] = mapped_column(String(255))
    hashed_password: Mapped[str | None] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class Organization(Base):
    __tablename__ = "organizations"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    legal_name: Mapped[str | None] = mapped_column(String(255))
    app: Mapped[AppCode] = mapped_column(Enum(AppCode), nullable=False)
    industry: Mapped[str | None] = mapped_column(String(120))
    city: Mapped[str | None] = mapped_column(String(120))
    state: Mapped[str | None] = mapped_column(String(120))
    country: Mapped[str] = mapped_column(String(2), default="US")
    website_url: Mapped[str | None] = mapped_column(String(500))
    public_profile_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    __table_args__ = (Index("organizations_app_idx", "app"),)

class Membership(Base):
    __tablename__ = "memberships"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    app: Mapped[AppCode] = mapped_column(Enum(AppCode), nullable=False)
    role: Mapped[str] = mapped_column(String(80), nullable=False)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (UniqueConstraint("user_id", "organization_id"), Index("memberships_user_org_idx", "user_id", "organization_id"), Index("memberships_app_role_idx", "app", "role"))

class AppPermission(Base):
    __tablename__ = "app_permissions"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    app: Mapped[AppCode] = mapped_column(Enum(AppCode), nullable=False)
    role: Mapped[str] = mapped_column(String(80), nullable=False)
    permission: Mapped[str] = mapped_column(String(160), nullable=False)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (UniqueConstraint("app", "role", "permission"),)

class Subscription(Base):
    __tablename__ = "subscriptions"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    app: Mapped[AppCode] = mapped_column(Enum(AppCode), nullable=False)
    stripe_customer_id: Mapped[str | None] = mapped_column(String(255))
    stripe_subscription_id: Mapped[str | None] = mapped_column(String(255))
    plan_code: Mapped[str] = mapped_column(String(120), default="free")
    status: Mapped[str] = mapped_column(String(80), default="inactive")
    current_period_end: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class Asset(Base):
    __tablename__ = "assets"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    app: Mapped[AppCode] = mapped_column(Enum(AppCode), nullable=False)
    asset_type: Mapped[str] = mapped_column(String(40), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_url: Mapped[str | None] = mapped_column(String(1000))
    original_filename: Mapped[str | None] = mapped_column(String(255))
    mime_type: Mapped[str | None] = mapped_column(String(120))
    size_bytes: Mapped[int | None]
    checksum: Mapped[str | None] = mapped_column(String(128))
    metadata_json: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    __table_args__ = (Index("assets_org_app_created_idx", "organization_id", "app", "created_at"),)

class Transcript(Base):
    __tablename__ = "transcripts"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    asset_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("assets.id"), nullable=False)
    language: Mapped[str | None] = mapped_column(String(20))
    transcript_text: Mapped[str] = mapped_column(Text, default="")
    segments: Mapped[dict] = mapped_column(JSONB, default=dict)
    model_name: Mapped[str | None] = mapped_column(String(120))
    confidence_score: Mapped[float | None]
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

class IngestionJob(Base):
    __tablename__ = "ingestion_jobs"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id"))
    app: Mapped[AppCode] = mapped_column(Enum(AppCode), nullable=False)
    source_type: Mapped[str] = mapped_column(String(40), nullable=False)
    source_url: Mapped[str | None] = mapped_column(String(1000))
    status: Mapped[str] = mapped_column(String(40), default="queued")
    result: Mapped[dict] = mapped_column(JSONB, default=dict)
    error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    finished_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    __table_args__ = (Index("ingestion_jobs_app_status_created_idx", "app", "status", "created_at"),)

class PublicFeedItem(Base):
    __tablename__ = "public_feed_items"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    app: Mapped[AppCode] = mapped_column(Enum(AppCode), default=AppCode.noticegrid)
    city: Mapped[str | None] = mapped_column(String(120))
    state: Mapped[str | None] = mapped_column(String(120))
    source_name: Mapped[str | None] = mapped_column(String(255))
    source_url: Mapped[str | None] = mapped_column(String(1000))
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    body: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str | None] = mapped_column(String(120))
    starts_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    published_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    raw: Mapped[dict] = mapped_column(JSONB, default=dict)
    confidence_label: Mapped[str] = mapped_column(String(80), default="needs_review")
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    __table_args__ = (Index("public_feed_items_city_state_published_idx", "city", "state", "published_at"),)

class MusicProject(Base):
    __tablename__ = "music_projects"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    app: Mapped[AppCode] = mapped_column(Enum(AppCode), default=AppCode.trackfoundry)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    artist_name: Mapped[str | None] = mapped_column(String(255))
    project_type: Mapped[str | None] = mapped_column(String(80))
    genre: Mapped[str | None] = mapped_column(String(120))
    bpm: Mapped[int | None]
    key_signature: Mapped[str | None] = mapped_column(String(40))
    readiness_score: Mapped[float | None] = mapped_column(Numeric)
    metadata_json: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    exports = relationship("MusicExport", back_populates="project")
    __table_args__ = (Index("music_projects_org_created_idx", "organization_id", "created_at"),)

class MusicExport(Base):
    __tablename__ = "music_exports"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("music_projects.id"), nullable=False)
    export_type: Mapped[str] = mapped_column(String(80), nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    project = relationship("MusicProject", back_populates="exports")

class RestaurantRecipe(Base):
    __tablename__ = "restaurant_recipes"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    app: Mapped[AppCode] = mapped_column(Enum(AppCode), default=AppCode.tableops)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str | None] = mapped_column(String(120))
    yield_amount: Mapped[float | None] = mapped_column(Numeric)
    yield_unit: Mapped[str | None] = mapped_column(String(40))
    food_cost_estimate: Mapped[float | None] = mapped_column(Numeric)
    sell_price_estimate: Mapped[float | None] = mapped_column(Numeric)
    margin_estimate: Mapped[float | None] = mapped_column(Numeric)
    instructions: Mapped[str | None] = mapped_column(Text)
    metadata_json: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    __table_args__ = (Index("restaurant_recipes_org_created_idx", "organization_id", "created_at"),)

class RestaurantPrepItem(Base):
    __tablename__ = "restaurant_prep_items"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    recipe_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("restaurant_recipes.id"), nullable=False)
    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[float | None] = mapped_column(Numeric)
    unit: Mapped[str | None] = mapped_column(String(40))
    due_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(80), default="open")
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id"))
    app: Mapped[AppCode] = mapped_column(Enum(AppCode), nullable=False)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(160), nullable=False)
    target_type: Mapped[str | None] = mapped_column(String(120))
    target_id: Mapped[str | None] = mapped_column(String(120))
    allowed: Mapped[bool] = mapped_column(Boolean, default=True)
    reason: Mapped[str | None] = mapped_column(Text)
    ip_address: Mapped[str | None] = mapped_column(String(80))
    user_agent: Mapped[str | None] = mapped_column(String(500))
    metadata_json: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (Index("audit_logs_org_app_created_idx", "organization_id", "app", "created_at"),)

class AppAccessEvent(Base):
    __tablename__ = "app_access_events"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    organization_id: Mapped[str | None] = mapped_column(String(120))
    app: Mapped[AppCode] = mapped_column(Enum(AppCode), nullable=False)
    action: Mapped[str] = mapped_column(String(160), nullable=False)
    allowed: Mapped[bool] = mapped_column(Boolean, default=False)
    reason: Mapped[str | None] = mapped_column(Text)
    ip_address: Mapped[str | None] = mapped_column(String(80))
    user_agent: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

class SystemHealthEvent(Base):
    __tablename__ = "system_health_events"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    service_name: Mapped[str] = mapped_column(String(120), nullable=False)
    status: Mapped[str] = mapped_column(String(80), nullable=False)
    message: Mapped[str | None] = mapped_column(Text)
    metadata_json: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
`;

py["apps/api/app/services/permission_service.py"] = `
BASE_ROLE_PERMISSIONS = {
    "owner": {"*"},
    "admin": {"org:read", "org:update", "members:read", "members:create", "members:update", "billing:read", "assets:create", "assets:read", "assets:update", "assets:delete", "ingestion:create", "ingestion:read", "audit:read"},
    "manager": {"assets:create", "assets:read", "assets:update", "ingestion:create", "ingestion:read", "project:create", "project:read", "project:update"},
    "editor": {"assets:create", "assets:read", "assets:update", "project:create", "project:read", "project:update"},
    "viewer": {"assets:read", "project:read"},
    "billing": {"billing:read", "billing:update"},
    "security": {"audit:read", "security:read"},
}

APP_PERMISSIONS = {
    "trackfoundry": {"music:project:create", "music:project:read", "music:project:update", "music:project:delete", "music:export:create", "music:genome:update", "music:readiness:run"},
    "tableops": {"tableops:recipe:create", "tableops:recipe:read", "tableops:recipe:update", "tableops:recipe:delete", "tableops:cost:run", "tableops:prep:create", "tableops:training:update"},
    "noticegrid": {"civic:feed:create", "civic:feed:read", "civic:feed:update", "civic:feed:delete", "civic:broadcast:create", "civic:organization:update", "civic:transit:read"},
    "parent_admin": {"admin:read", "admin:update", "security:read", "audit:read", "billing:read"},
}

def has_role_permission(app: str, role: str, permission: str) -> bool:
    role_permissions = BASE_ROLE_PERMISSIONS.get(role, set())
    if "*" in role_permissions or permission in role_permissions:
        return True
    if role in {"owner", "admin", "manager", "editor"} and permission in APP_PERMISSIONS.get(app, set()):
        return True
    return False
`;
py["apps/api/app/services/audit_service.py"] = `
async def create_audit_log(**kwargs) -> dict:
    # TODO: persist to audit_logs with a DB session.
    return {"recorded": True, **kwargs}

async def create_app_access_event(**kwargs) -> dict:
    # TODO: persist to app_access_events with a DB session.
    return {"recorded": True, **kwargs}
`;
py["apps/api/app/services/music_service.py"] = `
def calculate_release_readiness(project: dict) -> dict:
    checks = {
        "title": bool(project.get("title")),
        "artist_name": bool(project.get("artist_name")),
        "genre": bool(project.get("genre")),
        "bpm_key": bool(project.get("bpm") and project.get("key_signature")),
        "metadata": bool(project.get("metadata")),
        "export_bundle": bool(project.get("export_bundle")),
        "transcript_reference": bool(project.get("transcript_reference")),
        "anti_repetition": project.get("anti_repetition_status") != "blocked",
    }
    score = round(sum(checks.values()) / len(checks) * 100)
    return {"score": score, "checks": checks}

def anti_repetition_check(projects: list[dict]) -> dict:
    warnings = []
    seen = set()
    for project in projects:
        signature = (project.get("bpm"), project.get("key_signature"), project.get("genre"), project.get("metadata", {}).get("rhythmic_feel"), project.get("metadata", {}).get("vocal_mode"))
        if signature in seen:
            warnings.append({"project": project.get("title"), "warning": "duplicate musical signature"})
        seen.add(signature)
    return {"warnings": warnings}

def generate_artist_genome_summary(payload: dict) -> dict:
    return {"summary": "Starter Artist Genome summary", "signals": payload}

def create_music_export(project_id: str, export_type: str) -> dict:
    return {"project_id": project_id, "export_type": export_type, "payload": {"status": "placeholder"}}
`;
py["apps/api/app/services/tableops_service.py"] = `
def calculate_margin(cost: float, price: float) -> float:
    if price <= 0:
        return 0
    return round((price - cost) / price * 100, 2)

def calculate_food_cost(recipe: dict) -> dict:
    cost = float(recipe.get("food_cost_estimate") or 0)
    price = float(recipe.get("sell_price_estimate") or 0)
    return {"food_cost": cost, "sell_price": price, "margin": calculate_margin(cost, price)}

def create_prep_items(recipe: dict) -> list[dict]:
    return [{"name": f"Prep {recipe.get('name', 'recipe')}", "quantity": recipe.get("yield_amount", 1), "unit": recipe.get("yield_unit", "batch"), "status": "open"}]

def generate_recipe_score(recipe: dict) -> dict:
    checks = [bool(recipe.get("name")), bool(recipe.get("instructions")), bool(recipe.get("food_cost_estimate")), bool(recipe.get("sell_price_estimate"))]
    return {"score": round(sum(checks) / len(checks) * 100)}
`;
py["apps/api/app/services/civic_service.py"] = `
from datetime import datetime, timezone

CONFIDENCE_LABELS = {"official_source", "verified_partner", "public_web_source", "community_submitted", "needs_review"}

def public_source_confidence_label(source: dict) -> str:
    label = source.get("confidence_label", "needs_review")
    return label if label in CONFIDENCE_LABELS else "needs_review"

def normalize_public_item(item: dict) -> dict:
    return {
        "title": item.get("title", "Untitled public item"),
        "body": item.get("summary") or item.get("body"),
        "source_url": item.get("link") or item.get("source_url"),
        "published_at": item.get("published_at") or datetime.now(timezone.utc).isoformat(),
        "confidence_label": public_source_confidence_label(item),
        "raw": item,
    }

def filter_by_city_state(items: list[dict], city: str | None, state: str | None) -> list[dict]:
    return [item for item in items if (not city or item.get("city") == city) and (not state or item.get("state") == state)]

def create_public_feed_source(payload: dict) -> dict:
    return {"source": payload, "status": "registered"}

def ingest_public_feed(payload: dict) -> list[dict]:
    return [normalize_public_item(payload)]

def create_organization_profile(payload: dict) -> dict:
    return {"profile": payload, "status": "draft"}
`;
py["apps/api/app/services/ingestion_service.py"] = `
def parse_rss_placeholder(source_url: str) -> list[dict]:
    try:
        import feedparser
        feed = feedparser.parse(source_url)
        return [{"title": entry.get("title"), "summary": entry.get("summary"), "link": entry.get("link"), "raw": dict(entry)} for entry in feed.entries]
    except Exception:
        return [{"title": "RSS parser placeholder", "summary": "Install feedparser and provide a valid source URL.", "source_url": source_url}]

def ingest_gtfs_static(source_url: str) -> dict:
    return {"source_url": source_url, "status": "placeholder", "type": "gtfs_static"}

def ingest_gtfs_realtime(source_url: str) -> dict:
    return {"source_url": source_url, "status": "placeholder", "type": "gtfs_realtime"}

def normalize_transit_alert(payload: dict) -> dict:
    return {"title": payload.get("title", "Transit alert"), "raw": payload}
`;
py["apps/api/app/services/media_service.py"] = `
ALLOWED_TYPES = {"audio", "video", "image", "document", "dataset", "feed", "link"}
MAX_SIZE_BYTES = 1024 * 1024 * 1024

def validate_media_file(asset_type: str, size_bytes: int | None = None) -> bool:
    if asset_type not in ALLOWED_TYPES:
        return False
    if size_bytes is not None and size_bytes > MAX_SIZE_BYTES:
        return False
    return True

def extract_metadata(payload: dict) -> dict:
    return {"metadata": payload.get("metadata", {}), "status": "metadata_placeholder"}

def queue_transcription(asset_id: str) -> dict:
    return {"asset_id": asset_id, "queued": True}

def transcode_media(asset_id: str) -> dict:
    # TODO: call FFmpeg in a sandboxed worker.
    return {"asset_id": asset_id, "status": "transcode_placeholder"}

def generate_preview(asset_id: str) -> dict:
    return {"asset_id": asset_id, "status": "preview_placeholder"}

def create_export_bundle(asset_id: str) -> dict:
    return {"asset_id": asset_id, "formats": ["json", "txt", "csv", "zip"], "status": "bundle_placeholder"}
`;
py["apps/api/app/services/transcription_service.py"] = `
def transcribe_audio(asset_id: str, language: str = "en") -> dict:
    return {"asset_id": asset_id, "language": language, "transcript_text": "Development transcript placeholder.", "segments": [], "model_name": "dev-placeholder", "confidence_score": None}
`;
py["apps/api/app/services/billing_service.py"] = `
PRODUCT_GROUPS = {"trackfoundry": [], "tableops": [], "noticegrid": []}

def create_checkout_session_placeholder(app: str, plan_code: str) -> dict:
    return {"app": app, "plan_code": plan_code, "checkout_url": None, "status": "stripe_setup_required"}

def handle_webhook_placeholder(event: dict) -> dict:
    return {"received": True, "event_type": event.get("type", "unknown")}
`;
py["apps/api/app/services/storage_service.py"] = `def storage_placeholder() -> dict:\n    return {"status": "storage_provider_not_configured"}\n`;

const routerContent = {
  "health.py": `
from fastapi import APIRouter

router = APIRouter(tags=["health"])

@router.get("/health")
def health():
    return {"status": "ok", "service": "sonara-industries-api"}

@router.get("/health/deep")
def deep_health():
    return {"status": "ok", "database": "not_checked", "redis": "not_checked"}
`,
  "auth.py": `
from fastapi import APIRouter, HTTPException
from app.core.config import settings
from app.core.security import CurrentUser

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login")
def login():
    return {"status": "auth_provider_not_configured"}

@router.post("/logout")
def logout():
    return {"status": "logged_out"}

@router.get("/me")
def me():
    return {"user": None, "status": "anonymous"}

@router.post("/dev-token")
def dev_token():
    if settings.environment not in {"development", "local", "test"}:
        raise HTTPException(status_code=403, detail="dev_token_disabled")
    return {"access_token": "dev-superuser", "token_type": "bearer"}
`,
  "organizations.py": `
from fastapi import APIRouter, Depends
from app.core.permissions import require_app_permission

router = APIRouter(prefix="/organizations", tags=["organizations"])

@router.get("")
def list_organizations():
    return []

@router.post("")
def create_organization(payload: dict, user=Depends(require_app_permission("parent_admin", "org:update"))):
    return {"created": True, "organization": payload}

@router.get("/{id}")
def get_organization(id: str):
    return {"id": id}

@router.patch("/{id}")
def update_organization(id: str, payload: dict):
    return {"id": id, "updated": payload}

@router.delete("/{id}")
def delete_organization(id: str):
    return {"id": id, "status": "admin_approval_required"}
`,
  "memberships.py": `
from fastapi import APIRouter

router = APIRouter(tags=["memberships"])

@router.get("/organizations/{org_id}/members")
def list_members(org_id: str):
    return {"organization_id": org_id, "members": []}

@router.post("/organizations/{org_id}/members")
def add_member(org_id: str, payload: dict):
    return {"organization_id": org_id, "member": payload}

@router.patch("/memberships/{id}")
def update_membership(id: str, payload: dict):
    return {"id": id, "updated": payload}

@router.delete("/memberships/{id}")
def delete_membership(id: str):
    return {"id": id, "deleted": True}
`,
  "billing.py": `
from fastapi import APIRouter, Request
from app.services.billing_service import create_checkout_session_placeholder, handle_webhook_placeholder

router = APIRouter(prefix="/billing", tags=["billing"])

@router.get("/plans")
def plans():
    return {"product_groups": ["trackfoundry", "tableops", "noticegrid"]}

@router.post("/create-checkout-session")
def create_checkout_session(payload: dict):
    return create_checkout_session_placeholder(payload.get("app", "trackfoundry"), payload.get("plan_code", "free"))

@router.post("/create-portal-session")
def create_portal_session():
    return {"status": "stripe_portal_setup_required"}

@router.post("/webhook")
async def webhook(request: Request):
    # TODO: verify Stripe signature using STRIPE_WEBHOOK_SECRET before persistence.
    return handle_webhook_placeholder(await request.json())

@router.get("/subscription/{org_id}")
def get_subscription(org_id: str):
    return {"organization_id": org_id, "status": "not_loaded"}
`,
  "media.py": `
from fastapi import APIRouter, HTTPException
from app.services.media_service import validate_media_file, queue_transcription, create_export_bundle

router = APIRouter(prefix="/media", tags=["media"])

@router.post("/upload")
def upload(payload: dict):
    if not validate_media_file(payload.get("asset_type", ""), payload.get("size_bytes")):
        raise HTTPException(status_code=400, detail="invalid_media_file")
    return {"status": "accepted", "asset": payload}

@router.get("/assets")
def assets():
    return []

@router.get("/assets/{id}")
def asset(id: str):
    return {"id": id}

@router.delete("/assets/{id}")
def delete_asset(id: str):
    return {"id": id, "status": "permission_required"}

@router.post("/assets/{id}/transcribe")
def transcribe(id: str):
    return queue_transcription(id)

@router.post("/assets/{id}/export")
def export(id: str):
    return create_export_bundle(id)
`,
  "ingestion.py": `
from fastapi import APIRouter
from app.services.ingestion_service import parse_rss_placeholder, ingest_gtfs_static, ingest_gtfs_realtime

router = APIRouter(prefix="/ingestion", tags=["ingestion"])

@router.post("/jobs")
def create_job(payload: dict):
    return {"status": "queued", "job": payload}

@router.get("/jobs")
def list_jobs():
    return []

@router.get("/jobs/{id}")
def get_job(id: str):
    return {"id": id}

@router.post("/rss")
def ingest_rss(payload: dict):
    return {"items": parse_rss_placeholder(payload.get("source_url", ""))}

@router.post("/gtfs-placeholder")
def gtfs(payload: dict):
    return ingest_gtfs_static(payload.get("source_url", ""))

@router.post("/public-api-placeholder")
def public_api(payload: dict):
    return {"status": "placeholder", "source": payload}
`,
  "transcription.py": `
from fastapi import APIRouter
from app.services.transcription_service import transcribe_audio

router = APIRouter(prefix="/transcripts", tags=["transcription"])

@router.get("/{asset_id}")
def get_transcript(asset_id: str):
    return transcribe_audio(asset_id)

@router.post("/{asset_id}/refresh")
def refresh(asset_id: str):
    return transcribe_audio(asset_id)
`,
  "civic.py": `
from fastapi import APIRouter
from app.services.civic_service import create_public_feed_source, ingest_public_feed, create_organization_profile

router = APIRouter(prefix="/civic", tags=["civic"])

@router.get("/feed")
def feed():
    return []

@router.post("/feed/source")
def source(payload: dict):
    return create_public_feed_source(payload)

@router.post("/feed/ingest")
def ingest(payload: dict):
    return ingest_public_feed(payload)

@router.get("/organizations")
def organizations():
    return []

@router.post("/organizations/profile")
def profile(payload: dict):
    return create_organization_profile(payload)

@router.get("/alerts")
def alerts():
    return []

@router.get("/transit")
def transit():
    return {"items": [], "status": "gtfs_placeholder"}
`,
  "music.py": `
from fastapi import APIRouter
from app.services.music_service import calculate_release_readiness, anti_repetition_check, generate_artist_genome_summary, create_music_export

router = APIRouter(prefix="/music", tags=["music"])

@router.get("/projects")
def projects():
    return []

@router.post("/projects")
def create_project(payload: dict):
    return {"created": True, "project": payload}

@router.get("/projects/{id}")
def get_project(id: str):
    return {"id": id}

@router.patch("/projects/{id}")
def update_project(id: str, payload: dict):
    return {"id": id, "updated": payload}

@router.delete("/projects/{id}")
def delete_project(id: str):
    return {"id": id, "status": "permission_required"}

@router.post("/projects/{id}/readiness-score")
def readiness(id: str, payload: dict):
    return calculate_release_readiness({"id": id, **payload})

@router.post("/projects/{id}/export")
def export(id: str, payload: dict):
    return create_music_export(id, payload.get("export_type", "release_bundle"))

@router.post("/anti-repetition/check")
def anti_repetition(payload: dict):
    return anti_repetition_check(payload.get("projects", []))

@router.post("/artist-genome")
def artist_genome(payload: dict):
    return generate_artist_genome_summary(payload)
`,
  "tableops.py": `
from fastapi import APIRouter
from app.services.tableops_service import calculate_food_cost, create_prep_items

router = APIRouter(prefix="/tableops", tags=["tableops"])

@router.get("/recipes")
def recipes():
    return []

@router.post("/recipes")
def create_recipe(payload: dict):
    return {"created": True, "recipe": payload}

@router.get("/recipes/{id}")
def get_recipe(id: str):
    return {"id": id}

@router.patch("/recipes/{id}")
def update_recipe(id: str, payload: dict):
    return {"id": id, "updated": payload}

@router.delete("/recipes/{id}")
def delete_recipe(id: str):
    return {"id": id, "status": "permission_required"}

@router.post("/recipes/{id}/cost")
def cost(id: str, payload: dict):
    return calculate_food_cost({"id": id, **payload})

@router.get("/prep")
def prep():
    return []

@router.post("/prep")
def create_prep(payload: dict):
    return create_prep_items(payload)

@router.get("/training")
def training():
    return []
`,
  "audit.py": `
from fastapi import APIRouter

router = APIRouter(prefix="/audit", tags=["audit"])

@router.get("/logs")
def logs():
    return []

@router.get("/access-events")
def access_events():
    return []
`,
  "admin.py": `
from fastapi import APIRouter

router = APIRouter(prefix="/admin", tags=["admin"])

@router.get("/overview")
def overview():
    return {"organizations": 0, "users": 0, "subscriptions": 0, "security_events": 0}

@router.get("/organizations")
def organizations():
    return []

@router.get("/users")
def users():
    return []

@router.get("/billing")
def billing():
    return []

@router.get("/security-events")
def security_events():
    return []

@router.get("/system-health")
def system_health():
    return []
`,
};
for (const [name, content] of Object.entries(routerContent)) {
  py[`apps/api/app/routers/${name}`] = content;
}

["auth", "organizations", "memberships", "billing", "media", "ingestion", "civic", "music", "tableops", "audit"].forEach((name) => {
  py[`apps/api/app/schemas/${name}.py`] = `from pydantic import BaseModel\n\nclass ${name[0].toUpperCase() + name.slice(1).replace(/_([a-z])/g, (_, c) => c.toUpperCase())}Schema(BaseModel):\n    id: str | None = None\n`;
});

py["apps/api/app/main.py"] = `
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from app.core.cors import add_cors
from app.core.logging import logger
from app.routers import health, auth, organizations, memberships, billing, media, ingestion, transcription, civic, music, tableops, audit, admin

app = FastAPI(title="SONARA Industries API", version="0.1.0")
add_cors(app)

for router in [health.router, auth.router, organizations.router, memberships.router, billing.router, media.router, ingestion.router, transcription.router, civic.router, music.router, tableops.router, audit.router, admin.router]:
    app.include_router(router)

@app.on_event("startup")
async def startup_event():
    logger.info("SONARA Industries API starting")

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled API error")
    return JSONResponse(status_code=500, content={"detail": "internal_server_error"})
`;
py["apps/api/app/workers/worker.py"] = `def run_worker() -> None:\n    print("SONARA worker placeholder running")\n`;
py["apps/api/app/workers/media_worker.py"] = `from app.services.media_service import extract_metadata, transcode_media, generate_preview\n`;
py["apps/api/app/workers/ingestion_worker.py"] = `from app.services.ingestion_service import parse_rss_placeholder, ingest_gtfs_static, ingest_gtfs_realtime\n`;
py["apps/api/app/workers/transcription_worker.py"] = `from app.services.transcription_service import transcribe_audio\n`;
py["apps/api/app/migrations/env.py"] = `
from alembic import context
from app.db.base import Base
from app.db import models  # noqa: F401
from app.db.session import engine

target_metadata = Base.metadata

def run_migrations_online():
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()

run_migrations_online()
`;
py["apps/api/app/migrations/versions/0001_initial.py"] = `
"""initial SONARA Industries schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-05-05
"""

from alembic import op

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Models are defined in app.db.models. Generate exact production DDL with Alembic autogenerate.
    # RLS should be enabled per table in production after policy review.
    pass

def downgrade() -> None:
    pass
`;
py["apps/api/app/tests/test_health.py"] = `
from fastapi.testclient import TestClient
from app.main import app

def test_health_endpoint_works():
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
`;
py["apps/api/app/tests/test_permissions.py"] = `
from app.services.permission_service import has_role_permission

def test_permission_guard_denies_invalid_app():
    assert has_role_permission("noticegrid", "viewer", "music:project:create") is False

def test_permission_guard_allows_valid_app():
    assert has_role_permission("trackfoundry", "manager", "music:project:create") is True
`;
py["apps/api/app/tests/test_app_isolation.py"] = `
def test_app_isolation_prevents_cross_app_access():
    music_scope = "trackfoundry"
    table_scope = "tableops"
    assert music_scope != table_scope
`;
py["apps/api/app/tests/test_billing_webhook.py"] = `
from app.services.billing_service import handle_webhook_placeholder

def test_billing_webhook_route_handles_fake_event_safely():
    result = handle_webhook_placeholder({"type": "checkout.session.completed"})
    assert result["received"] is True
`;
py["apps/api/app/tests/test_services.py"] = `
from app.services.civic_service import ingest_public_feed
from app.services.music_service import calculate_release_readiness
from app.services.tableops_service import calculate_food_cost

def test_civic_feed_endpoint_returns_list():
    assert isinstance(ingest_public_feed({"title": "Library update"}), list)

def test_music_readiness_score_returns_number():
    result = calculate_release_readiness({"title": "Song", "artist_name": "Artist", "genre": "pop", "bpm": 120, "key_signature": "C"})
    assert isinstance(result["score"], int)

def test_tableops_cost_calculator_returns_number():
    result = calculate_food_cost({"food_cost_estimate": 3, "sell_price_estimate": 10})
    assert isinstance(result["margin"], float)
`;

Object.assign(files, py);

for (const [path, content] of Object.entries(files)) {
  write(path, content);
}

console.log(`Created SONARA Industries monorepo at ${root}`);

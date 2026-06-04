import { brandIdentity } from "@signal-os/ui";
import { createElement, createMetric } from "../dom.ts";
import { renderPublicShell } from "../ui/shared-components.ts";

type PublicInfoRoute =
  | "/legal"
  | "/legal/cookie-policy"
  | "/legal/accessibility"
  | "/legal/dpa"
  | "/research-lab"
  | "/research-lab/open-source"
  | "/research-lab/github-radar"
  | "/open-source"
  | "/docs"
  | "/api-webhooks"
  | "/integrations"
  | "/changelog";

type PublicInfoPage = Readonly<{
  eyebrow: string;
  title: string;
  summary: string;
  status: string;
  items: readonly string[];
}>;

const publicInfoPages: Readonly<Record<PublicInfoRoute, PublicInfoPage>> = Object.freeze({
  "/legal": page(
    "Legal center",
    "Legal",
    "Terms, privacy, refunds, acceptable use, security, accessibility, cookie, and DPA review paths for SONARA Industries.",
    "Draft policy center"
  ),
  "/legal/cookie-policy": page(
    "Legal policy draft",
    "Cookie Policy",
    "Cookie and local storage disclosures remain attorney-review-ready until analytics and consent tooling are finalized.",
    "Draft for legal review"
  ),
  "/legal/accessibility": page(
    "Legal policy draft",
    "Accessibility",
    "Accessibility commitments and support paths for public pages, app shell, forms, and mobile layouts.",
    "Draft for legal review"
  ),
  "/legal/dpa": page(
    "Legal policy draft",
    "Data Processing Addendum",
    "DPA terms require attorney review, subprocessors review, data map confirmation, and final customer contract approval.",
    "Draft for legal review"
  ),
  "/research-lab": page(
    "Research Lab",
    "Research Lab",
    "SONARA Research Lab tracks useful open-source tools, AI systems, creative software, and infrastructure patterns, then converts approved ideas into safe SONARA-native systems.",
    "Reference and review only"
  ),
  "/research-lab/open-source": page(
    "Research Lab",
    "Open Source Review",
    "Open-source references are not automatically bundled, endorsed, or shipped. Every integration requires license, security, safety, and commercial-use review.",
    "Review gated"
  ),
  "/research-lab/github-radar": page(
    "Research Lab",
    "GitHub Opportunity Radar",
    "GitHub Radar helps review repository value, license risk, security risk, and SONARA product fit before any adapter or integration is considered.",
    "Admin review required"
  ),
  "/open-source": page(
    "Research Lab",
    "Open Source",
    "Public open-source references are review records only and do not imply SONARA ownership, endorsement, bundling, or production integration.",
    "Reference only"
  ),
  "/docs": page(
    "Documentation",
    "Docs",
    "Developer, owner, support, deployment, security, and product readiness documentation for the SONARA Industries workspace.",
    "Launch documentation"
  ),
  "/api-webhooks": page(
    "Platform",
    "API and Webhooks",
    "API and webhook docs are planning-ready. Production webhooks must verify signatures server-side and never expose secrets.",
    "Provider setup required"
  ),
  "/integrations": page(
    "Platform",
    "Integrations",
    "Integration records are provider-aware and feature-gated. Missing optional providers must lock only their own modules.",
    "Review gated"
  ),
  "/changelog": page(
    "Release notes",
    "Changelog",
    "Launch-readiness changes, safety gates, route updates, and provider setup notes are tracked for owner review.",
    "Draft release history"
  )
});

export function renderPublicInfoPage(route: PublicInfoRoute) {
  const info = publicInfoPages[route];
  const page = renderPublicShell("public-info-page");
  const header = createElement("header", { className: "shell-header public-hero" });
  header.append(
    createElement("p", { className: "shell-kicker", textContent: info.eyebrow }),
    createElement("h1", { textContent: info.title }),
    createElement("p", { className: "screen-copy", textContent: info.summary })
  );

  const card = createElement("article", { className: "planning-card shell-card" });
  const list = createElement("ul", { className: "security-list" });
  for (const item of info.items) {
    list.append(createElement("li", { textContent: item }));
  }
  card.append(
    createElement("h2", { textContent: "Launch status" }),
    createMetric("Status", info.status),
    createMetric("Company", brandIdentity.parentName),
    list
  );

  page.append(header, card);
  return page;
}

function page(eyebrow: string, title: string, summary: string, status: string): PublicInfoPage {
  return Object.freeze({
    eyebrow,
    title,
    summary,
    status,
    items: Object.freeze([
      "Provider-backed features stay setup-gated until environment values are configured and tested.",
      "No customer data, secrets, payment details, or service-role actions are exposed on this public route.",
      "Final public claims, pricing, legal language, and integration status require owner review before launch."
    ])
  });
}

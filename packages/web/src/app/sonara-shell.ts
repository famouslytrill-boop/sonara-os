import { brandIdentity, getProductTheme, type ProductThemeId } from "@signal-os/ui";
import { createElement } from "../dom.ts";
import {
  renderDashboardHeader,
  renderProductCard,
  type BadgeTone
} from "../ui/shared-components.ts";

export type ShellCard = Readonly<{
  title: string;
  description: string;
  status: string;
  href?: string;
  badge?: string;
}>;

export function renderShellDashboard() {
  return renderShellPage({
    kicker: brandIdentity.platformName,
    title: "Launch Dashboard",
    description:
      "A focused workspace for building, operating, and reviewing the three core product areas before launch.",
    cards: [
      {
        title: brandIdentity.products.businessBuilder,
        description: "Proof, payment setup, booking, intake, reviews, and customer records.",
        status: "Shell ready",
        href: "/business-builder"
      },
      {
        title: brandIdentity.products.creatorStudio,
        description: "Creator profile, asset organization, packages, and project setup.",
        status: "Shell ready",
        href: "/creator-studio"
      },
      {
        title: brandIdentity.products.growthStudio,
        description: "Campaign planning, trust signals, review growth, and customer follow-up.",
        status: "Shell ready",
        href: "/growth-studio"
      },
      {
        title: "Guided Onboarding",
        description: "Choose a product path and save the first setup checklist before launch.",
        status: "Setup",
        href: "/onboarding"
      },
      {
        title: "Security Center",
        description: "Safety checks, privacy boundaries, and launch review requirements.",
        status: "Setup required",
        href: "/security-center"
      },
      {
        title: "Reliability Center",
        description: "Build health, known risks, validation commands, and release readiness.",
        status: "Manual review",
        href: "/admin/reliability-center"
      },
      {
        title: "Developer Tools",
        description: "Internal utilities for specs, validation, and repo handoff.",
        status: "Internal",
        badge: "Admin",
        href: "/admin/developer-tools"
      },
      {
        title: "AI Provider Registry",
        description: "Internal provider review, prompt redaction, and external model approval.",
        status: "Review required",
        badge: "Admin",
        href: "/admin/ai-providers"
      },
      {
        title: "Video Intelligence",
        description: "Beta source and consent review shell. Upload processing is disabled.",
        status: "Beta gated",
        badge: "Beta",
        href: "/admin/video-intelligence"
      }
    ]
  });
}

export function renderBusinessBuilderDashboard() {
  return renderShellPage({
    kicker: "Product",
    title: brandIdentity.products.businessBuilder,
    productThemeId: "business-builder",
    description:
      "A launch-focused workspace for proof, getting paid, booking, intake, reviews, and customer organization.",
    cards: [
      {
        title: "Proof Passport",
        description: "Prepare a controlled public profile with services and proof points.",
        status: "Setup required",
        href: "/business-builder/proof-passport"
      },
      {
        title: "Money Path",
        description: "Prepare safe provider-hosted payment links and manual payment instructions.",
        status: "Setup required",
        href: "/business-builder/payment-options"
      },
      {
        title: "Booking/Appointments",
        description: "Collect booking requests for owner review before confirmation.",
        status: "Setup required",
        href: "/business-builder/bookings"
      },
      {
        title: "Smart Intake",
        description: "Collect basic project or service details without exposing submissions.",
        status: "Setup required",
        href: "/business-builder/smart-intake"
      },
      {
        title: "Reviews",
        description: "Prepare review links and testimonials with owner moderation.",
        status: "Setup required",
        href: "/business-builder/reviews"
      },
      {
        title: "Customer Records",
        description: "Organize private customer records for owner and admin access only.",
        status: "Setup required",
        href: "/business-builder/customers"
      },
      {
        title: "Legal Readiness",
        description: "Prepare contract, policy, and attorney review packets for human review.",
        status: "Review required",
        href: "/business-builder/legal-readiness"
      }
    ]
  });
}

export function renderCreatorStudioDashboard() {
  return renderShellPage({
    kicker: "Product",
    title: brandIdentity.products.creatorStudio,
    productThemeId: "creator-studio",
    description:
      "A creator workspace for profile setup, offer packaging, asset organization, and client intake.",
    cards: [
      {
        title: "Creator Profile",
        description: "Prepare public creator details, offers, and contact actions.",
        status: "Setup required"
      },
      {
        title: "Asset Vault",
        description: "Organize asset records with rights and provenance notes before publishing.",
        status: "Setup required",
        href: "/creator-studio/asset-vault"
      },
      {
        title: "Service Packages",
        description: "Draft creator offers without payment processing or automatic publishing.",
        status: "Setup required",
        href: "/creator-studio/service-offers"
      },
      {
        title: "Payment & Booking Links",
        description: "Prepare provider-hosted payment links and owner-reviewed booking options.",
        status: "Setup required",
        href: "/creator-studio/payment-booking"
      },
      {
        title: "Project Rooms",
        description: "Client collaboration shell for future project handoff.",
        status: "Gated",
        badge: "Beta"
      },
      {
        title: "Rights & Licensing",
        description: "Prepare asset rights and licensing notes before public use.",
        status: "Review required",
        href: "/creator-studio/legal-readiness/rights-licensing"
      },
      {
        title: "Video Review",
        description: "Beta video source, consent, and release-readiness review shell.",
        status: "Beta gated",
        badge: "Beta",
        href: "/creator-studio/video-review"
      },
      {
        title: "Voice Studio",
        description: "Beta voice review shell. Cloning and impersonation are disabled.",
        status: "Beta gated",
        badge: "Beta",
        href: "/creator-studio/voice-studio"
      },
      {
        title: "Visual Studio",
        description: "Beta visual review shell. Public generation is disabled.",
        status: "Beta gated",
        badge: "Beta",
        href: "/creator-studio/visual-studio"
      }
    ]
  });
}

export function renderGrowthStudioDashboard() {
  return renderShellPage({
    kicker: "Product",
    title: brandIdentity.products.growthStudio,
    productThemeId: "growth-studio",
    description:
      "A practical growth workspace for campaign planning, trust building, and customer follow-up.",
    cards: [
      {
        title: "Growth Campaigns",
        description: "Plan campaigns without fake metrics, hidden tracking, or revenue guarantees.",
        status: "Setup required",
        href: "/growth-studio/campaigns"
      },
      {
        title: "Reviews & Trust",
        description: "Prepare approved trust signals and external review profile links.",
        status: "Setup required",
        href: "/growth-studio/reviews"
      },
      {
        title: "Customer Follow-Up",
        description: "Plan owner-reviewed follow-up steps without automated customer contact.",
        status: "Gated",
        badge: "Beta"
      },
      {
        title: "Campaign Claim Review",
        description: "Prepare campaign claims and evidence notes for human review.",
        status: "Review required",
        href: "/growth-studio/legal-readiness/campaign-review"
      },
      {
        title: "Campaign Visuals",
        description: "Beta visual planning shell with public generation disabled.",
        status: "Beta gated",
        badge: "Beta",
        href: "/growth-studio/campaign-visuals"
      },
      {
        title: "Results Tracker",
        description: "Placeholder for real results only after validated data wiring exists.",
        status: "Not live",
        badge: "Advanced"
      }
    ]
  });
}

export function renderSecurityCenterPage() {
  return renderShellPage({
    kicker: "Shared Admin",
    title: "Security Center",
    description:
      "Review safety, privacy, and launch security requirements before enabling live workflows.",
    cards: [
      {
        title: "Trust Shield",
        description:
          "Blocks unsafe claims, fake proof, risky payment behavior, and unsafe automation.",
        status: "Configured"
      },
      {
        title: "Privacy Boundaries",
        description:
          "Customer records, intake submissions, and private owner data stay restricted.",
        status: "Review required"
      },
      {
        title: "Provider Safety",
        description: "AI/provider work must route through the Provider Gateway.",
        status: "Required",
        href: "/security-center/external-model-safety"
      },
      {
        title: "Launch Review",
        description: "High-risk changes require human review before release.",
        status: "Required",
        href: "/security-center/legal-risk-review"
      },
      {
        title: "Voice Safety",
        description: "Consent, disclosure, and impersonation review for beta voice workflows.",
        status: "Blocked by default",
        href: "/security-center/voice-safety"
      },
      {
        title: "Visual Safety",
        description: "Rights, fake-proof, and generation boundary review for beta visuals.",
        status: "Blocked by default",
        href: "/security-center/visual-safety"
      },
      {
        title: "Video Source Safety",
        description: "Source, consent, and private-video review before processing is enabled.",
        status: "Blocked by default",
        href: "/security-center/video-source-safety"
      }
    ]
  });
}

export function renderReliabilityCenterPage() {
  return renderShellPage({
    kicker: "Shared Admin",
    title: "Reliability Center",
    description:
      "Track build health, validation commands, known risks, and release readiness without fake uptime metrics.",
    cards: [
      {
        title: "Provider Health",
        description: "Manual provider health cards without fake live status.",
        status: "Manual review",
        href: "/admin/reliability-center/providers"
      },
      {
        title: "Incident Records",
        description: "Create internal incident drafts for reviewed recovery work.",
        status: "Draft records",
        href: "/admin/reliability-center/incidents"
      },
      {
        title: "Continuity Mode",
        description: "Manual continuity state only. Auto-failover is disabled.",
        status: "Manual only",
        href: "/admin/reliability-center/continuity-mode"
      },
      {
        title: "Public Status Page",
        description: "Exists as a private/off placeholder until reviewed publishing is ready.",
        status: "Private/off",
        href: "/status"
      }
    ]
  });
}

export function renderDeveloperToolsPage() {
  return renderShellPage({
    kicker: "Shared Admin",
    title: "Developer Tools",
    description:
      "Internal utilities for specs, validation, handoff, and safe implementation planning.",
    cards: [
      {
        title: "Spec-Driven Build System",
        description: "Require specs, plans, tasks, acceptance criteria, security, and tests first.",
        status: "Internal"
      },
      {
        title: "Repo Validation",
        description: "Use existing scripts for infrastructure, typecheck, build, tests, and smoke.",
        status: "Available"
      },
      {
        title: "AI Provider Registry",
        description: "Provider cards, model router review, redaction gate, and usage audit model.",
        status: "Internal",
        badge: "Admin",
        href: "/admin/ai-providers"
      },
      {
        title: "Implementation Sequencer",
        description: "Internal build-order planning for reviewed work only.",
        status: "Gated",
        badge: "Admin"
      },
      {
        title: "Developer Utility Center",
        description:
          "Local format, encode, decode, UUID, slug, JWT decode, and redacted webhook tools.",
        status: "Available",
        badge: "Internal",
        href: "/admin/developer-utilities"
      },
      {
        title: "Dev Tunnel Tools",
        description: "Local preview, mobile testing, and webhook tunnel command previews.",
        status: "Preview only",
        badge: "Internal",
        href: "/admin/dev-tunnel-tools"
      }
    ]
  });
}

export function renderSettingsPage() {
  return renderShellPage({
    kicker: "Shared",
    title: "Settings",
    description: "Workspace settings shell for account, organization, privacy, and preferences.",
    cards: [
      {
        title: "Organization",
        description: "Placeholder for organization profile and member settings.",
        status: "Setup required"
      },
      {
        title: "Privacy",
        description: "Placeholder for data visibility and owner-controlled sharing settings.",
        status: "Setup required"
      },
      {
        title: "Preferences",
        description: "Placeholder for interface and notification preferences.",
        status: "Setup required"
      }
    ]
  });
}

export function renderBillingPlaceholderPage() {
  return renderShellPage({
    kicker: "Shared",
    title: "Billing",
    description:
      "Billing setup placeholder. No real payment status, checkout, or subscription state is shown here.",
    cards: [
      {
        title: "Plan",
        description: "Plan selection is not live in this shell.",
        status: "Placeholder"
      },
      {
        title: "Payment Provider",
        description: "Sensitive payment data must be handled by provider-hosted flows only.",
        status: "Not connected"
      }
    ]
  });
}

export function renderHelpCenterPlaceholderPage() {
  return renderShellPage({
    kicker: "Shared",
    title: "Help Center",
    description: "Help and support placeholder for launch setup, validation, and owner guidance.",
    cards: [
      {
        title: "Setup Help",
        description: "Guidance will be added as product areas move from shell to implementation.",
        status: "Placeholder"
      },
      {
        title: "Support",
        description: "Support routing is not live in this shell.",
        status: "Not live"
      }
    ]
  });
}

function renderShellPage({
  kicker,
  title,
  description,
  cards,
  productThemeId
}: {
  kicker: string;
  title: string;
  description: string;
  cards: readonly ShellCard[];
  productThemeId?: ProductThemeId;
}) {
  const theme = productThemeId ? getProductTheme(productThemeId) : null;
  const page = createElement("section", {
    className: `work-screen sonara-shell app-shell ${theme?.themeClassName ?? ""}`.trim()
  });
  const header = renderDashboardHeader({ kicker, title, description });
  if (theme) {
    header.append(renderProductLogo(theme.logoSrc, `${theme.publicName} logo placeholder`));
  }

  const grid = createElement("div", { className: "planning-grid" });
  for (const card of cards) {
    grid.append(renderShellCard(card));
  }

  page.append(header, grid);
  return page;
}

function renderProductLogo(src: string, alt: string) {
  const logo = createElement("img", { className: "brand-logo brand-logo--product" });
  logo.setAttribute("src", src);
  logo.setAttribute("alt", alt);
  logo.setAttribute("loading", "lazy");
  return logo;
}

function renderShellCard(card: ShellCard) {
  return renderProductCard({
    title: card.title,
    description: card.description,
    status: card.status,
    href: card.href,
    badge: card.badge,
    badgeTone: getBadgeTone(card.badge)
  });
}

function getBadgeTone(badge?: string): BadgeTone {
  if (badge === "Beta") {
    return "beta";
  }
  if (badge === "Admin" || badge === "Advanced" || badge === "Internal") {
    return "review";
  }
  return "neutral";
}

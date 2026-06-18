import { brandIdentity } from "@signal-os/ui";
import { createElement, createMetric } from "../dom.ts";
import { renderPublicShell } from "../ui/shared-components.ts";

type PolicyPage = Readonly<{
  eyebrow: string;
  title: string;
  summary: string;
  status: string;
  sections: readonly PolicySection[];
}>;

type PolicySection = Readonly<{
  title: string;
  items: readonly string[];
}>;

const sharedDraftNotice = Object.freeze([
  "Attorney-review-ready draft only. This page is not legal advice and is not a final legal document.",
  "Publishing or materially changing this policy requires Owner Confirmation Lock review before release.",
  "SONARA does not claim guaranteed legal compliance, guaranteed cybersecurity, guaranteed uptime, guaranteed revenue, or professional legal, tax, financial, medical, or security advice."
]);

export const legalPolicyDates = Object.freeze({
  effectiveDate: "2026-06-11",
  lastUpdated: "2026-06-11"
});

export function renderTermsPage() {
  return renderPolicyPage({
    eyebrow: "Review-ready policy draft",
    title: "Terms of Use",
    summary:
      "Draft terms for using SONARA Industries, Business Builder, Creator Studio, Growth Studio, and shared admin systems.",
    status: "Draft for attorney review",
    sections: [
      {
        title: "Subscriptions and setup services",
        items: [
          "Subscription access, plan limits, setup services, and billing terms must match the approved pricing page and Stripe configuration.",
          "Setup services support product configuration and launch preparation; they do not guarantee sales, customers, revenue, compliance, or business outcomes.",
          "Plan changes, pricing changes, refunds, payout settings, and other money-related actions require owner approval before execution."
        ]
      },
      {
        title: "User responsibility",
        items: [
          "Users are responsible for the accuracy of business details, proof, reviews, payment links, booking links, customer records, and public claims they publish.",
          "Users must have permission to upload, store, display, or send customer, creator, brand, media, campaign, or payment-related information.",
          "Users must follow applicable laws, provider terms, privacy duties, and communication consent requirements."
        ]
      },
      {
        title: "AI and automation limits",
        items: [
          "AI and automation outputs are draft support only and are not professional advice.",
          "High-risk actions, including customer-facing campaigns, legal/policy text, security settings, pricing, refunds, proof/review publishing, and AI media publishing, require owner confirmation.",
          "The platform may draft, queue, flag, summarize, and recommend actions, but must not execute high-risk actions without approval."
        ]
      }
    ]
  });
}

export function renderPrivacyPage() {
  return renderPolicyPage({
    eyebrow: "Review-ready policy draft",
    title: "Privacy Policy",
    summary:
      "Draft privacy policy for data handling, customer records, payment boundaries, AI limits, and support workflows.",
    status: "Draft for attorney review",
    sections: [
      {
        title: "Data handling",
        items: [
          "The app is designed to keep organization-scoped business, creator, customer, billing, proof, review, booking, and intake records private unless explicitly published.",
          "Customer records, intake submissions, booking requests, audit logs, and approval records should remain owner/admin controlled.",
          "Production data handling, retention, deletion, export, subprocessors, and support access require final legal and operational review before launch."
        ]
      },
      {
        title: "Payments and secrets",
        items: [
          "Payment providers handle sensitive payment data. The app does not store raw card numbers, does not store CVV, and must not store full bank credentials, provider secrets, or service-role keys in client code.",
          "Stripe secret keys, webhook secrets, Supabase service-role keys, and AI provider keys must remain server-side only.",
          "Public configuration values may be browser-exposed only when they are intended to be public, such as publishable keys and NEXT_PUBLIC values."
        ]
      },
      {
        title: "AI feature limits",
        items: [
          "AI processing must not be presented as legal, tax, financial, medical, security, licensing, or compliance advice.",
          "Sensitive AI routing, voice, visual, and video outputs remain gated and require approval before public or commercial use.",
          "Users are responsible for reviewing generated drafts, checking rights, and avoiding deceptive or unauthorized synthetic media."
        ]
      }
    ]
  });
}

export function renderRefundPolicyPage() {
  return renderPolicyPage({
    eyebrow: "Review-ready policy draft",
    title: "Refund Policy",
    summary:
      "Draft refund and dispute policy for subscriptions, setup services, Stripe payments, and owner approval requirements.",
    status: "Draft for attorney review",
    sections: [
      {
        title: "Subscriptions",
        items: [
          "Subscription billing is intended to run through hosted Stripe Checkout, Stripe subscriptions, Payment Links, or the Stripe Customer Portal when configured.",
          "Subscription access and cancellation handling must match Stripe records and the approved billing implementation.",
          "A checkout redirect alone is not proof of payment; signed webhook or Stripe dashboard verification is required."
        ]
      },
      {
        title: "Setup services",
        items: [
          "Setup services are implementation support services and must be scoped clearly before purchase.",
          "Setup service refunds, partial refunds, rescheduling, and cancellations require owner review.",
          "Setup services do not guarantee revenue, customers, ranking, compliance, security outcomes, or launch approval."
        ]
      },
      {
        title: "Refunds and disputes",
        items: [
          "Refunds and disputes are managed through Stripe or the relevant approved payment provider.",
          "Refunds require owner confirmation before action. Automation may draft notes or flag requests but must not issue refunds directly.",
          "Marketplace payouts and paying third-party businesses are not MVP defaults and require future Stripe Connect review."
        ]
      }
    ]
  });
}

export function renderAcceptableUsePage() {
  return renderPolicyPage({
    eyebrow: "Review-ready policy draft",
    title: "Acceptable Use Policy",
    summary:
      "Draft acceptable use policy for safe business, creator, growth, automation, payment, review, and AI/media workflows.",
    status: "Draft for attorney review",
    sections: [
      {
        title: "Permitted use",
        items: [
          "Use SONARA products to draft, organize, review, and prepare business profiles, offers, payment links, bookings, intake, reviews, creator assets, campaigns, and support records.",
          "Use automation for drafting, queueing, reminders, internal tasks, setup flags, and non-public recommendations.",
          "Use provider-hosted payment and booking links with accurate labels and reviewed destination URLs."
        ]
      },
      {
        title: "Prohibited misuse",
        items: [
          "Do not publish fake reviews, fake proof, fake certifications, deceptive badges, fake legal/medical/financial proof, or misleading customer claims.",
          "Do not use the app for illegal automation, spam, phishing, credential theft, harassment, hidden tracking, unauthorized scraping, or bypassing provider or platform safety rules.",
          "Do not store raw card data, CVV, full bank credentials, provider secrets, tokens, service-role keys, or private customer data in public fields."
        ]
      },
      {
        title: "Synthetic media limits",
        items: [
          "Voice cloning requires consent and remains disabled unless a consent record and reviewed workflow exist.",
          "Public or commercial AI voice, visual, and video outputs require owner approval before use.",
          "Do not impersonate public figures, customers, employees, or third parties, and do not create deceptive synthetic proof or endorsements."
        ]
      }
    ]
  });
}

export function renderDisclaimersPage() {
  return renderPolicyPage({
    eyebrow: "Review-ready policy draft",
    title: "Disclaimers",
    summary:
      "Draft disclaimer page for product limits, AI output limits, professional advice boundaries, beta systems, and launch claims.",
    status: "Draft for attorney review",
    sections: [
      {
        title: "No professional advice",
        items: [
          "SONARA outputs are product support, organization, drafting, and decision-support materials only.",
          "The app does not provide legal, tax, financial, medical, compliance, insurance, accounting, investment, or professional cybersecurity advice.",
          "Users should consult qualified professionals before relying on legal, tax, financial, compliance, security, medical, or regulated-industry materials."
        ]
      },
      {
        title: "No guaranteed outcomes",
        items: [
          "The app does not guarantee revenue, customers, growth, search ranking, reviews, conversion rates, legal compliance, cybersecurity, uptime, recoverability, or business success.",
          "Security, Reliability Center, AI Provider Registry, Source Leak Prevention, and related systems are safeguards and readiness tools, not guarantees.",
          "Beta and admin-gated systems must remain labeled as beta, admin-only, coming soon, or requires review until production-ready."
        ]
      },
      {
        title: "Approval boundaries",
        items: [
          "Legal/policy text, customer-facing campaigns, proof/review publishing, AI media publishing, refunds, price changes, payout settings, and security changes require Owner Confirmation Lock.",
          "Automation may draft, queue, recommend, flag, summarize, remind, and prepare actions, but high-risk actions require explicit human confirmation.",
          "Unknown sensitive actions should default to owner review, not automatic execution."
        ]
      }
    ]
  });
}

export function renderSecurityPolicyPage() {
  return renderPolicyPage({
    eyebrow: "Review-ready policy draft",
    title: "Security",
    summary:
      "Draft security overview for launch readiness, data boundaries, provider-hosted payments, admin protection, and owner approval gates.",
    status: "Draft for attorney review",
    sections: [
      {
        title: "Security posture",
        items: [
          "SONARA products are designed around reviewed setup, protected admin routes, security headers, source-leak scanning, secret redaction, and provider-hosted sensitive workflows.",
          "Security features reduce risk but do not guarantee cybersecurity, breach prevention, uptime, legal compliance, or incident recovery.",
          "Critical security actions and security-setting changes require owner/admin review and Owner Confirmation Lock where applicable."
        ]
      },
      {
        title: "Sensitive data boundaries",
        items: [
          "Raw card numbers, CVV, full bank credentials, provider secrets, webhook secrets, tokens, and service-role keys must not be exposed client-side.",
          "Customer records, intake submissions, booking requests, audit logs, and approval records must remain private unless a reviewed public pathway exists.",
          "Public pages must not show private customer contact data, fake reviews, fake proof, or unreviewed verification claims."
        ]
      },
      {
        title: "Support and reporting",
        items: [
          "Report suspected security issues through the support/contact path and avoid sending secrets in support messages.",
          "Production incident response, vulnerability intake, monitoring, backups, and escalation paths require final operational review.",
          "No system owner should disable security gates or delete audit logs through automation."
        ]
      }
    ]
  });
}

export function renderContactPolicyPage() {
  return renderPolicyPage({
    eyebrow: "Support and contact",
    title: "Contact",
    summary:
      "Contact starting point for product access, setup services, support, policy questions, security reports, and billing questions.",
    status: "Support path draft",
    sections: [
      {
        title: "Support path",
        items: [
          "For product access, setup services, billing questions, policy questions, or support, contact SONARA through the published support email or contact channel.",
          "Do not send raw card data, CVV, full bank credentials, passwords, API keys, service-role keys, webhook secrets, or private tokens through support messages.",
          "Security reports should include a clear description, affected route or feature, reproduction notes where safe, and no exploit against real customer data."
        ]
      },
      {
        title: "Billing and disputes",
        items: [
          "Billing questions may require Stripe dashboard review and owner approval before refunds, plan changes, or dispute responses.",
          "Payment provider fees, payout timing, refunds, chargebacks, and disputes are handled through the relevant payment provider.",
          "Marketplace payouts and third-party payout support are not MVP defaults."
        ]
      },
      {
        title: "Policy review",
        items: [
          "Questions about terms, privacy, refunds, acceptable use, disclaimers, or security should be routed for owner review before public policy changes.",
          "SONARA does not provide legal, tax, financial, medical, or professional security advice through support.",
          "Policy updates must not publish until Owner Confirmation Lock approval is complete."
        ]
      }
    ]
  });
}

function renderPolicyPage(policy: PolicyPage) {
  const page = renderPublicShell();
  const header = createElement("header", { className: "shell-header public-hero" });
  const actions = createElement("div", { className: "trust-warning-list" });
  actions.append(
    createElement("a", { className: "primary-action", href: "/contact", textContent: "Contact" }),
    createElement("a", { className: "secondary-action", href: "/terms", textContent: "Terms" }),
    createElement("a", { className: "secondary-action", href: "/privacy", textContent: "Privacy" })
  );
  header.append(
    createElement("p", { className: "shell-kicker", textContent: policy.eyebrow }),
    createElement("h1", { textContent: policy.title }),
    createElement("p", { className: "screen-copy", textContent: policy.summary }),
    actions
  );

  const statusCard = createElement("article", { className: "planning-card shell-card" });
  statusCard.append(
    createElement("h2", { textContent: "Review status" }),
    createMetric("Status", policy.status),
    createMetric("Effective date", legalPolicyDates.effectiveDate),
    createMetric("Last updated", legalPolicyDates.lastUpdated),
    createMetric("Company", brandIdentity.parentName),
    createMetric("Approval", "Owner Confirmation Lock required before publishing changes")
  );

  page.append(header, statusCard, renderDraftNotice(), renderPolicySections(policy.sections));
  return page;
}

function renderDraftNotice() {
  const wrapper = createElement("section", { className: "record-section" });
  const list = createElement("ul", { className: "security-list" });
  for (const item of sharedDraftNotice) {
    list.append(createElement("li", { textContent: item }));
  }
  wrapper.append(createElement("h2", { textContent: "Important Draft Notice" }), list);
  return wrapper;
}

function renderPolicySections(sections: readonly PolicySection[]) {
  const grid = createElement("div", { className: "planning-grid" });
  for (const section of sections) {
    const card = createElement("article", { className: "planning-card shell-card" });
    const list = createElement("ul", { className: "security-list" });
    for (const item of section.items) {
      list.append(createElement("li", { textContent: item }));
    }
    card.append(createElement("h2", { textContent: section.title }), list);
    grid.append(card);
  }
  return grid;
}

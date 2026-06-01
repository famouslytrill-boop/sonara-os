import { brandIdentity, getLogoAsset } from "@signal-os/ui";
import { createElement, createMetric } from "../../dom.ts";
import {
  getProductMarketingPage,
  pricingSafetyNotes,
  pricingTiers,
  productMarketingPages,
  setupServiceTiers,
  sonaraParentStatement,
  sonaraProductPromise,
  sonaraTagline,
  type ProductMarketingPage
} from "../../lib/public-marketing/index.ts";
import { renderPublicShell } from "../../ui/shared-components.ts";

export function renderPublicHomePage() {
  const page = createPublicShell();
  page.append(
    renderHero({
      eyebrow: brandIdentity.parentName,
      title: brandIdentity.platformDisplayName,
      description: `${sonaraProductPromise} ${sonaraTagline} ${sonaraParentStatement}`,
      logoSrc: getLogoAsset("parent-logo").src,
      logoAlt: getLogoAsset("parent-logo").label,
      ctas: [
        ["Start setup", "/onboarding", "primary-action"],
        ["View pricing", "/pricing", "secondary-action"]
      ]
    }),
    renderProductGrid(),
    renderPromiseBand(),
    renderSafetyNote()
  );
  return page;
}

export function renderBusinessBuilderMarketingPage() {
  return renderProductMarketingPage(getProductMarketingPage("/business-builder"));
}

export function renderCreatorStudioMarketingPage() {
  return renderProductMarketingPage(getProductMarketingPage("/creator-studio"));
}

export function renderGrowthStudioMarketingPage() {
  return renderProductMarketingPage(getProductMarketingPage("/growth-studio"));
}

export function renderPricingPage() {
  const page = createPublicShell();
  const tierGrid = createElement("div", { className: "planning-grid" });
  for (const tier of pricingTiers) {
    const card = createElement("article", { className: "planning-card shell-card" });
    card.append(
      createElement("h2", { textContent: tier.name }),
      createElement("p", { className: "recommendation", textContent: tier.description }),
      createMetric("Price", tier.price),
      createMetric("Best for", tier.fit)
    );
    tierGrid.append(card);
  }

  const setupGrid = createElement("div", { className: "planning-grid" });
  for (const setup of setupServiceTiers) {
    const card = createElement("article", { className: "planning-card shell-card" });
    card.append(
      createElement("h3", { textContent: setup.name }),
      createElement("p", { className: "recommendation", textContent: setup.description }),
      createMetric("Setup service", setup.price)
    );
    setupGrid.append(card);
  }

  page.append(
    renderHero({
      eyebrow: "Pricing",
      title: "Pricing for Build. Prove. Get paid. Grow.",
      description:
        "Start small, choose the plan that matches the work, and use setup services only when you want hands-on help.",
      ctas: [
        ["Contact", "/contact", "primary-action"],
        ["About SONARA", "/about", "secondary-action"]
      ]
    }),
    createElement("h2", { textContent: "Plans" }),
    tierGrid,
    createElement("h2", { textContent: "Setup Services" }),
    setupGrid,
    renderSafetyNote(pricingSafetyNotes)
  );
  return page;
}

export function renderAboutPage() {
  const page = createPublicShell();
  page.append(
    renderHero({
      eyebrow: "About",
      title: brandIdentity.parentName,
      description: `${sonaraParentStatement} ${sonaraTagline}`,
      logoSrc: getLogoAsset("parent-logo").src,
      logoAlt: getLogoAsset("parent-logo").label,
      ctas: [
        ["View products", "/business-builder", "primary-action"],
        ["Security", "/security", "secondary-action"]
      ]
    }),
    renderInfoGrid([
      [
        "What we build",
        "Independent software products for business setup, creator workflows, and practical growth."
      ],
      [
        "How we work",
        "Shared infrastructure keeps safety, reliability, and product foundations consistent."
      ],
      [
        "What we avoid",
        "No hidden fees, guaranteed revenue claims, or advice that belongs to legal, tax, or financial professionals."
      ]
    ])
  );
  return page;
}

export function renderPublicSecurityPage() {
  const page = createPublicShell();
  page.append(
    renderHero({
      eyebrow: "Security",
      title: "Safety boundaries before scale.",
      description:
        "SONARA products are designed around reviewed setup, clear privacy boundaries, and provider-hosted sensitive workflows.",
      ctas: [
        ["Contact", "/contact", "primary-action"],
        ["Privacy", "/privacy", "secondary-action"]
      ]
    }),
    renderInfoGrid([
      [
        "Payments",
        "Payment providers handle sensitive payment data. SONARA does not store raw card numbers or CVV."
      ],
      [
        "Customer records",
        "Private customer records should stay owner-controlled and protected from public pages."
      ],
      [
        "Launch review",
        "High-risk actions require human review before publishing or customer-facing use."
      ]
    ]),
    renderSafetyNote()
  );
  return page;
}

export function renderContactPage() {
  const page = createPublicShell();
  page.append(
    renderHero({
      eyebrow: "Contact",
      title: "Tell us what you are building.",
      description:
        "Use this page as the contact starting point for product access, setup services, partnership, or support questions.",
      ctas: [
        ["View pricing", "/pricing", "primary-action"],
        ["Email SONARA", "mailto:hello@sonara.industries", "secondary-action"]
      ]
    }),
    renderInfoGrid([
      ["Product access", "Ask about Business Builder, Creator Studio, or Growth Studio."],
      [
        "Setup services",
        "Request help setting up proof, payment links, booking, intake, and trust pages."
      ],
      ["Security questions", "Ask about privacy, payment handling, and launch review boundaries."]
    ])
  );
  return page;
}

export function renderTermsPlaceholderPage() {
  return renderLegalPlaceholderPage({
    title: "Terms",
    description:
      "Terms are a placeholder until final legal review is complete. Do not rely on this page as a final agreement."
  });
}

export function renderPrivacyPlaceholderPage() {
  return renderLegalPlaceholderPage({
    title: "Privacy",
    description:
      "Privacy policy is a placeholder until final legal review is complete. Production data practices must be documented before launch."
  });
}

function renderProductMarketingPage(product: ProductMarketingPage) {
  const page = createPublicShell(product.productThemeClassName);
  page.append(
    renderHero({
      eyebrow: product.eyebrow,
      title: product.title,
      description: `${product.promise} ${product.description}`,
      logoSrc: product.logoSrc,
      logoAlt: `${product.title} logo placeholder`,
      ctas: product.ctas.map((cta) => [
        cta.label,
        cta.href,
        cta.variant === "primary" ? "primary-action" : "secondary-action"
      ])
    }),
    createMetric("Launch status", product.launchStatusLabel),
    renderFeatureList(product.features),
    renderPromiseBand(),
    renderSafetyNote()
  );
  return page;
}

function renderLegalPlaceholderPage({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  const page = createPublicShell();
  page.append(
    renderHero({
      eyebrow: "Legal Placeholder",
      title,
      description,
      ctas: [
        ["Contact", "/contact", "primary-action"],
        ["Back home", "/", "secondary-action"]
      ]
    }),
    renderSafetyNote([
      "This placeholder is not legal advice.",
      "Final terms and privacy pages require human legal review before public launch.",
      "No customer data, payment data, or consent record is shown here."
    ])
  );
  return page;
}

function createPublicShell(themeClassName = "") {
  return renderPublicShell(themeClassName);
}

function renderHero({
  eyebrow,
  title,
  description,
  logoSrc,
  logoAlt,
  ctas
}: {
  eyebrow: string;
  title: string;
  description: string;
  logoSrc?: string;
  logoAlt?: string;
  ctas: readonly (readonly [string, string, string])[];
}) {
  const header = createElement("header", { className: "shell-header public-hero" });
  const actions = createElement("div", { className: "trust-warning-list" });
  for (const [label, href, className] of ctas) {
    actions.append(createElement("a", { className, href, textContent: label }));
  }
  header.append(
    logoSrc
      ? renderBrandLogo(logoSrc, logoAlt ?? title)
      : createElement("span", { className: "brand-logo-spacer" }),
    createElement("p", { className: "shell-kicker", textContent: eyebrow }),
    createElement("h1", { textContent: title }),
    createElement("p", { className: "screen-copy", textContent: description }),
    actions
  );
  return header;
}

function renderBrandLogo(src: string, alt: string) {
  const logo = createElement("img", { className: "brand-logo" });
  logo.setAttribute("src", src);
  logo.setAttribute("alt", alt);
  logo.setAttribute("loading", "eager");
  return logo;
}

function renderProductGrid() {
  const grid = createElement("div", { className: "planning-grid" });
  for (const product of productMarketingPages) {
    const card = createElement("article", {
      className: `planning-card shell-card ${product.productThemeClassName}`
    });
    card.append(
      renderBrandLogo(product.logoSrc, `${product.title} logo placeholder`),
      createElement("h2", { textContent: product.title }),
      createElement("p", { className: "recommendation", textContent: product.promise }),
      createMetric("Launch status", product.launchStatusLabel),
      createElement("a", {
        className: "secondary-action",
        href: product.route,
        textContent: "Open"
      })
    );
    grid.append(card);
  }
  return grid;
}

function renderFeatureList(features: readonly string[]) {
  const grid = createElement("div", { className: "planning-grid" });
  for (const feature of features) {
    const card = createElement("article", { className: "planning-card shell-card" });
    card.append(
      createElement("h2", { textContent: feature }),
      createElement("p", {
        className: "recommendation",
        textContent: "Built for reviewed setup and plain-language customer use."
      })
    );
    grid.append(card);
  }
  return grid;
}

function renderInfoGrid(items: readonly (readonly [string, string])[]) {
  const grid = createElement("div", { className: "planning-grid" });
  for (const [title, description] of items) {
    const card = createElement("article", { className: "planning-card shell-card" });
    card.append(
      createElement("h2", { textContent: title }),
      createElement("p", { className: "recommendation", textContent: description })
    );
    grid.append(card);
  }
  return grid;
}

function renderPromiseBand() {
  const card = createElement("article", {
    className: "planning-card planning-card--wide shell-card"
  });
  card.append(
    createElement("h2", { textContent: sonaraProductPromise }),
    createElement("p", {
      className: "recommendation",
      textContent:
        "A simple product promise for customer-facing work, supported by reviewed setup and safe infrastructure."
    })
  );
  return card;
}

function renderSafetyNote(notes: readonly string[] = pricingSafetyNotes) {
  const wrapper = createElement("section", { className: "record-section" });
  const list = createElement("ul", { className: "security-list" });
  for (const note of notes) {
    list.append(createElement("li", { textContent: note }));
  }
  wrapper.append(createElement("h2", { textContent: "Plain Terms" }), list);
  return wrapper;
}

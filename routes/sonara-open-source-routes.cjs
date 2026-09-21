// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// /research-lab/open-source
//
// Two pages linked here and it returned 404 in production:
// /research-lab/huggingface and /research-lab/requested-repositories both offer
// an "Open-source research" action, and it had no route behind it.
//
// The register itself was never the problem. data/open-source-tools.ts holds
// reviewed repositories and scripts/verify-open-source-registry.mjs gates it on
// every release. It simply had no page, so the work existed, the gate checked
// it, and nobody could look at it.
//
// This is an operator surface, not a customer one. It names licences,
// repositories and refusal reasons precisely, which is why it sits under
// /research-lab -- lib/sonara-plain-language.cjs exempts that prefix from the
// customer-vocabulary rules for exactly this kind of page.

const {
  readOpenSourceTools,
  displayName,
  integrationLabel,
  commercialLabel,
  riskLabel
} = require("../lib/sonara-open-source-registry.cjs");
const {
  SURFACES,
  getRepositoryProductPlacements,
  customerAvailability
} = require("../lib/sonara-repository-product-routing.cjs");
const { getMarketExpansionRegistry } = require("../lib/sonara-market-expansion-registry.cjs");

const REPOSITORY_SWEEP_INSTALLABLE = "2026 repository sweep installable candidate";
const REPOSITORY_SWEEP_RESEARCH = "2026 repository sweep research-only";
const REPOSITORY_SWEEP_DATE = "2026-09-20";

module.exports = function registerSonaraOpenSourceRoutes(app, deps = {}) {
  const layout = deps.layout || basicLayout;
  const brandCard = deps.brandCard || card;
  const linkAction = deps.linkAction || link;
  const escape = deps.escapeHtml || esc;
  const requireCustomer = deps.requireCustomer;
  if (typeof requireCustomer !== "function") throw new Error("registerSonaraOpenSourceRoutes requires requireCustomer");

  // The JSON carries the same substitution as the page. A retired product name
  // should not leave this application by either door, and a machine reader
  // gains nothing from the one name that is withheld -- every other field on
  // that record is present.
  app.get("/api/ecosystem/open-source", (req, res) => {
    const tools = readOpenSourceTools().map((tool) => ({ ...tool, name: displayName(tool) }));
    const repositorySweep = repositorySweepCounts(tools);
    res.status(200).json({
      ok: true,
      status: "reviewed_register",
      toolCount: tools.length,
      counts: countBy(tools, "integrationStatus"),
      repositorySweep,
      tools
    });
  });

  app.get("/research-lab/open-source", (req, res) => {
    const tools = readOpenSourceTools();
    const byIntegration = countBy(tools, "integrationStatus");
    const blocked = tools.filter((tool) => tool.integrationStatus === "blocked");
    const repositorySweep = repositorySweepCounts(tools);

    const sections = [
      brandCard(
        "What this register is",
        `${tools.length} external repositories reviewed before use. Each records its licence, how far integration may go, and what is refused. scripts/verify-open-source-registry.mjs checks this file on every release.`
      ),
      brandCard(
        "Nothing here runs by default",
        "Being listed is not adoption. Reference-only entries are read, not installed; an optional adapter still needs review before it is wired to anything; blocked entries are recorded so the same question is not asked twice."
      ),
      brandCard(
        `Repository ecosystem sweep — ${repositorySweep.installableCandidates} installable candidates + ${repositorySweep.researchOnly} research only`,
        `Snapshot ${repositorySweep.snapshotDate}. The installable group contains package/service candidates that can be evaluated behind SONARA adapters after licence, security, tenant and workload review. The research-only group is read for architecture, market and UX lessons but is not copied into the runtime. This sweep installs zero dependencies and activates zero production capabilities.`
      )
    ];

    if (blocked.length) {
      sections.push(brandCard(
        `Blocked (${blocked.length})`,
        blocked.map((tool) => `${displayName(tool)} — ${tool.license}`).join(". ") + "."
      ));
    }

    sections.push(registerTable(tools, escape));

    res.status(200).type("html").send(layout({
      title: "Open-source register",
      eyebrow: "Research Lab",
      heading: "Reviewed open-source repositories",
      body: "Every external repository this project has looked at, with the licence it carries, how far it may be integrated, and why anything refused was refused.",
      sections,
      actions: [
        linkAction("/api/ecosystem/open-source", "Register JSON"),
        linkAction("/research-lab/huggingface", "Hugging Face catalog"),
        linkAction("/research-lab/requested-repositories", "Repository intake"),
        linkAction("/", "SONARA home")
      ]
    }));

    void byIntegration;
  });

  app.get("/technology-radar", (req, res) => {
    const placements = getRepositoryProductPlacements(readOpenSourceTools());
    const expansion = getMarketExpansionRegistry();
    const sections = Object.values(SURFACES).map((surface) => {
      const count = placements.filter((placement) => placement.surface.key === surface.key).length;
      return brandCard(
        `${surface.name} (${count})`,
        `${count} reviewed technologies are routed here. They are references, research, or blocked records, not installed customer integrations.`,
        [linkAction(surface.route, `Open ${surface.name}`)]
      );
    });
    sections.push(brandCard(
      "SONARA-native expansion plan",
      `${expansion.counts.capabilities} internal capability records now map the September market and workflow research into shared platform work, add-ons, industry packs, standalone packaging, distribution, and partner integrations. These records separate existing foundations from future work.`
    ));
    sections.push(brandCard(
      "What a listing means",
      "SONARA has identified the upstream repository and recorded its licence, safety boundaries, and possible product fit. Listing does not mean SONARA owns, bundles, endorses, or runs it."
    ));
    sections.push(customerReferenceTable(
      placements.filter((placement) => placement.surface.key === SURFACES.shared_platform.key),
      escape
    ));
    res.status(200).type("html").send(layout({
      title: "Technology Radar",
      eyebrow: "SONARA Industries",
      heading: "Reviewed technology references",
      body: "See where recently researched technologies could inform SONARA, and which ones remain unavailable because review or safety requirements are not satisfied.",
      sections,
      actions: [
        linkAction("/business-builder/technology", "Business Builder references"),
        linkAction("/creator-studio/technology", "Creator Studio references"),
        linkAction("/growth-studio/technology", "Growth Studio references"),
        linkAction("/research-lab/open-source", "Full review register"),
        linkAction("/products", "Customer products"),
        linkAction("/", "SONARA home")
      ]
    }));
  });

  for (const surface of [SURFACES.business_builder, SURFACES.creator_studio, SURFACES.growth_studio]) {
    app.get(surface.route, requireCustomer, (req, res) => {
      const placements = getRepositoryProductPlacements(readOpenSourceTools())
        .filter((placement) => placement.surface.key === surface.key);
      const expansion = getMarketExpansionRegistry().capabilities
        .filter((capability) => capability.targets.includes(surface.key));
      res.status(200).type("html").send(layout({
        title: `${surface.name} Technology References`,
        eyebrow: surface.name,
        heading: "Reviewed technology references",
        body: "These technologies and SONARA-native expansion records may inform future work. None is connected to your account or included in your plan unless a separate product page explicitly proves that it is live.",
        sections: [
          brandCard(
            `${placements.length} external research records routed here`,
            "Every repository record keeps its real review status. Blocked items are shown only to explain why they are unavailable, not as recommendations."
          ),
          customerReferenceTable(placements, escape),
          brandCard(
            `${expansion.length} SONARA-native expansion records`,
            "These are internal product plans, not third-party installations. Existing foundations, provider-dependent features, implementation-next work, design-only work, and research-only work remain visibly separated."
          ),
          expansionReferenceTable(expansion, escape)
        ],
        actions: [
          linkAction(`/${surface.key.replace("_", "-")}/tools`, `${surface.name} tools`),
          linkAction("/technology-radar", "All technology references"),
          linkAction("/research-lab/open-source", "Full review register")
        ]
      }));
    });
  }
};

function customerReferenceTable(placements, escape) {
  const rows = placements.map(({ record }) => {
    const status = customerAvailability(record);
    const purpose = customerReferencePurpose(record);
    const boundary = customerReferenceBoundary(record);
    const cells = [customerReferenceName(record), purpose, status, boundary].map((value) => escape(value));
    return `<tr>${cells.map((cell) => `<td>${cell}</td>`).join("")}</tr>`;
  }).join("");
  const head = ["Technology", "What it may inform", "Availability", "Important boundary"]
    .map((label) => `<th>${escape(label)}</th>`).join("");
  return `<article class="card"><h2>Technology references</h2><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></article>`;
}

function expansionReferenceTable(capabilities, escape) {
  const rows = capabilities.map((capability) => {
    const cells = [
      capability.name,
      expansionFormLabel(capability.form),
      expansionStatusLabel(capability.status),
      capability.value,
      capability.next.slice(0, 2).join(" / ") || "No additional work recorded"
    ].map((value) => escape(customerCopy(value)));
    return `<tr>${cells.map((cell) => `<td>${cell}</td>`).join("")}</tr>`;
  }).join("");
  const head = ["SONARA capability", "Product form", "Current state", "Customer value", "Next implementation boundary"]
    .map((label) => `<th>${escape(label)}</th>`).join("");
  return `<article class="card"><h2>SONARA-native expansion plan</h2><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></article>`;
}

function expansionStatusLabel(status) {
  const labels = {
    live_foundation: "Existing foundation",
    conditional_on_configured_provider: "Requires configured provider",
    implement_next: "Planned next",
    design_only: "Design only",
    research_only: "Research only",
    partner_integration: "Partner integration",
    do_not_rebuild: "Integrate; do not rebuild"
  };
  return labels[status] || String(status || "Review required").replace(/_/g, " ");
}

function expansionFormLabel(form) {
  const labels = {
    core_platform: "Shared platform",
    add_on: "Add-on",
    industry_pack: "Industry pack",
    standalone_sku: "Standalone packaging",
    distribution_channel: "Distribution",
    partner_integration: "Partner integration"
  };
  return labels[form] || String(form || "Capability").replace(/_/g, " ");
}

const CUSTOMER_TERM_REPLACEMENTS = Object.freeze([
  [/\bentitlements?\b/gi, "plan access"],
  [/\blifecycle\b/gi, "product stages"],
  [/\breadiness\b/gi, "setup status"],
  [/\bplan floor\b/gi, "lowest included plan"],
  [/\bexecution enabled\b/gi, "open"],
  [/\bexecution restricted\b/gi, "not open"],
  [/\bwebhooks?\b/gi, "signed updates"],
  [/\bendpoints?\b/gi, "connections"],
  [/\bschemas?\b/gi, "record structures"],
  [/\bmiddleware\b/gi, "request checks"],
  [/\bidempotent\b/gi, "safe to repeat"],
  [/\bservice[- ]roles?\b/gi, "private server access"],
  [/\brow level security\b/gi, "private record rules"],
  [/\bprovider gateways?\b/gi, "service connections"],
  [/\bopenapi\b/gi, "service contract"],
  [/\bpostgrest\b/gi, "database service"],
  [/\bsupabase\b/gi, "database"],
  [/\bpostgres\b/gi, "database"]
]);

function customerCopy(value) {
  return CUSTOMER_TERM_REPLACEMENTS.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    String(value == null ? "" : value)
  );
}

function customerReferencePurpose(record) {
  if (!record) return "Review record";
  if (["blocked", "needs_license_review", "needs_security_review"].includes(record.integrationStatus)) {
    return "Recorded for review; not offered or connected";
  }
  const source = record.useCase?.[0] || record.category?.[0] || "Product research reference";
  return customerCopy(source);
}

function customerReferenceName(record) {
  return customerCopy(displayName(record));
}

function customerReferenceBoundary(record) {
  if (!record) return "Unavailable until its identity is confirmed";
  if (record.integrationStatus === "blocked") return "Not offered; the full review records why";
  if (record.integrationStatus === "needs_license_review") return "A licence decision is required before any use";
  if (record.integrationStatus === "needs_security_review") return "A security review is required before any use";
  if (record.integrationStatus === "research_only") return "Research only; not connected to customer accounts";
  return "Human review is required before any use";
}

// One row per repository. The repo URL is rendered as text rather than a link:
// several entries are unresolved placeholders that the release gate reports as
// warnings, and a link to https://github.com/ is a dead link of exactly the
// kind this page exists to stop shipping.
function registerTable(tools, escape) {
  const rows = tools.map((tool) => {
    const cells = [
      escape(displayName(tool)),
      escape(riskLabel(tool.licenseRisk)),
      escape(tool.license),
      escape(commercialLabel(tool.commercialUseStatus)),
      escape(integrationLabel(tool.integrationStatus)),
      escape(placement(tool)),
      escape(tool.blockedUses.length ? tool.blockedUses.join(", ") : "None recorded")
    ];
    return `<tr>${cells.map((cell) => `<td>${cell}</td>`).join("")}</tr>`;
  }).join("");
  const head = ["Repository", "Licence risk", "Licence", "Commercial use", "Integration", "Where it lands", "Refused uses"]
    .map((label) => `<th>${escape(label)}</th>`).join("");
  return `<article class="card"><h2>The register</h2><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></article>`;
}

function placement(tool) {
  const fit = (tool.productFit || []).filter((entry) => entry && entry !== "None");
  if (fit.length) return fit.join(", ");
  if (tool.integrationStatus === "blocked") return "Nowhere -- refused";
  if (tool.integrationStatus === "needs_license_review") return "Nowhere yet -- licence unresolved";
  return "Build-time only -- helps write SONARA, reaches no customer";
}

function repositorySweepCounts(tools) {
  const hasCategory = (tool, category) => Array.isArray(tool.category) && tool.category.includes(category);
  return Object.freeze({
    snapshotDate: REPOSITORY_SWEEP_DATE,
    installableCandidates: tools.filter((tool) => hasCategory(tool, REPOSITORY_SWEEP_INSTALLABLE)).length,
    researchOnly: tools.filter((tool) => hasCategory(tool, REPOSITORY_SWEEP_RESEARCH)).length,
    runtimeDependenciesInstalled: 0,
    productionCapabilitiesActivated: 0
  });
}

function countBy(items, key) {
  return items.reduce((totals, item) => {
    const value = item[key] || "unknown";
    totals[value] = (totals[value] || 0) + 1;
    return totals;
  }, {});
}

function esc(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function card(title, body) { return `<article class="card"><h2>${esc(title)}</h2><p>${esc(body)}</p></article>`; }
function link(href, label) { return `<a class="action" href="${esc(href)}">${esc(label)}</a>`; }
function basicLayout(data) {
  return `<!doctype html><html><head><title>${esc(data.title)}</title></head><body><main><h1>${esc(data.heading)}</h1><p>${esc(data.body)}</p>${(data.sections || []).join("")}<nav>${(data.actions || []).join("")}</nav></main></body></html>`;
}

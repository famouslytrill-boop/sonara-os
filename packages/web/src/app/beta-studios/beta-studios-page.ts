import { createElement, createMetric } from "../../dom.ts";
import {
  betaDangerousCapabilityDefaults,
  betaSafetyRules,
  getBetaAuditPlaceholders,
  getBetaStudioShellByRoute,
  type BetaDangerousCapabilityFlag,
  type BetaSafetyRule,
  type BetaStudioId,
  type BetaStudioRoute
} from "../../lib/beta-studios/index.ts";

const blockedFlagLabels: Record<BetaDangerousCapabilityFlag, string> = {
  VIDEO_UPLOAD_PROCESSING_ENABLED: "Video upload processing",
  VOICE_CLONING_ENABLED: "Voice cloning",
  PUBLIC_VISUAL_GENERATION_ENABLED: "Public visual generation",
  LOCAL_VISUAL_MODELS_ENABLED: "Local visual models"
};

export function renderVideoIntelligencePage() {
  return renderBetaStudioShell("/admin/video-intelligence");
}

export function renderCreatorVideoReviewPage() {
  return renderBetaStudioShell("/creator-studio/video-review");
}

export function renderVoiceStudioPage() {
  return renderBetaStudioShell("/creator-studio/voice-studio");
}

export function renderVisualStudioPage() {
  return renderBetaStudioShell("/creator-studio/visual-studio");
}

export function renderCampaignVisualsPage() {
  return renderBetaStudioShell("/growth-studio/campaign-visuals");
}

export function renderVoiceSafetyPage() {
  return renderBetaSafetyPage({
    title: "Voice Safety",
    description:
      "Review consent, disclosure, and impersonation boundaries before any voice workflow moves beyond draft planning.",
    system: "voice_studio",
    focusedRules: ["voice-consent", "no-impersonation", "drafts-only"]
  });
}

export function renderVisualSafetyPage() {
  return renderBetaSafetyPage({
    title: "Visual Safety",
    description:
      "Review visual rights, fake-proof prevention, and public generation boundaries before visual outputs are used.",
    system: "visual_intelligence_studio",
    focusedRules: ["no-fake-proof", "drafts-only"]
  });
}

export function renderVideoSourceSafetyPage() {
  return renderBetaSafetyPage({
    title: "Video Source Safety",
    description:
      "Review source, consent, and private-video boundaries before any video intelligence processing is enabled.",
    system: "video_intelligence",
    focusedRules: ["private-video-blocked", "drafts-only"]
  });
}

function renderBetaStudioShell(route: BetaStudioRoute) {
  const shell = getBetaStudioShellByRoute(route);
  const page = createBetaShell({
    kicker: "Beta",
    title: shell.title,
    description: shell.description
  });
  page.append(
    renderBetaSafetyNote(),
    renderStatusCard({
      title: `${shell.title} Status`,
      description: "This route is a gated beta shell. No unrestricted processing is enabled.",
      metrics: [
        ["Feature flag", shell.enabledFlag],
        ["Risk", titleCase(shell.riskLevel)],
        ["Output status", "Draft until approved"]
      ],
      badge: "Beta"
    }),
    renderBlockedCapabilities(shell.blockedFlags),
    renderSafetyRuleGrid(betaSafetyRules),
    renderAuditPlaceholderGrid(shell.id)
  );
  return page;
}

function renderBetaSafetyPage({
  title,
  description,
  system,
  focusedRules
}: {
  title: string;
  description: string;
  system: BetaStudioId;
  focusedRules: readonly string[];
}) {
  const page = createBetaShell({
    kicker: "Security Center",
    title,
    description
  });
  const rules = betaSafetyRules.filter((rule) => focusedRules.includes(rule.id));
  page.append(
    renderBetaSafetyNote(),
    renderSafetyRuleGrid(rules),
    renderAuditPlaceholderGrid(system),
    renderStatusCard({
      title: "Launch Gate",
      description:
        "High-risk media workflows require human review. Public generation, cloning, and private-video processing stay disabled.",
      metrics: [
        ["Status", "Requires Review"],
        ["Human review", "Requires Review"],
        ["Auto publish", "Disabled"]
      ],
      badge: "Admin Only"
    })
  );
  return page;
}

function createBetaShell({
  kicker,
  title,
  description
}: {
  kicker: string;
  title: string;
  description: string;
}) {
  const page = createElement("section", { className: "work-screen sonara-shell record-page" });
  const header = createElement("header", { className: "shell-header" });
  header.append(
    createElement("p", { className: "shell-kicker", textContent: kicker }),
    createElement("h1", { textContent: title }),
    createElement("p", { className: "screen-copy", textContent: description })
  );
  page.append(header);
  return page;
}

function renderBetaSafetyNote() {
  return createElement("p", {
    className: "warning-copy",
    textContent:
      "Beta shell only. No unrestricted generation, cloning, upload processing, public visual generation, private video processing, or auto-publishing is enabled."
  });
}

function renderBlockedCapabilities(flags: readonly BetaDangerousCapabilityFlag[]) {
  const section = createElement("section", { className: "record-section" });
  const grid = createElement("div", { className: "planning-grid" });
  for (const flag of flags) {
    grid.append(
      renderStatusCard({
        title: blockedFlagLabels[flag],
        description: "Dangerous capability is default-off and requires explicit future review.",
        metrics: [
          ["Flag", flag],
          ["Enabled", betaDangerousCapabilityDefaults[flag] ? "Yes" : "No"],
          ["Release gate", "Requires Review"]
        ],
        badge: "Admin Only"
      })
    );
  }
  section.append(createElement("h2", { textContent: "Blocked Capabilities" }), grid);
  return section;
}

function renderSafetyRuleGrid(rules: readonly BetaSafetyRule[]) {
  const section = createElement("section", { className: "record-section" });
  const grid = createElement("div", { className: "planning-grid" });
  for (const rule of rules) {
    grid.append(
      renderStatusCard({
        title: rule.title,
        description: rule.description,
        metrics: [
          ["Risk", titleCase(rule.riskLevel)],
          ["Required", rule.required ? "Yes" : "No"]
        ],
        badge: rule.riskLevel === "critical" ? "Requires Review" : "Beta"
      })
    );
  }
  section.append(createElement("h2", { textContent: "Safety Warnings" }), grid);
  return section;
}

function renderAuditPlaceholderGrid(system: BetaStudioId) {
  const section = createElement("section", { className: "record-section" });
  const grid = createElement("div", { className: "planning-grid" });
  for (const item of getBetaAuditPlaceholders(system)) {
    grid.append(
      renderStatusCard({
        title: item.eventType,
        description: item.summary,
        metrics: [
          ["Status", item.status],
          ["Risk", titleCase(item.riskLevel)],
          ["Human review", item.humanReviewRequired ? "Requires Review" : "Beta"]
        ],
        badge: "Admin Only"
      })
    );
  }
  section.append(createElement("h2", { textContent: "Audit Placeholders" }), grid);
  return section;
}

function renderStatusCard({
  title,
  description,
  metrics,
  badge
}: {
  title: string;
  description: string;
  metrics: readonly (readonly [string, string])[];
  badge: string;
}) {
  const card = createElement("article", { className: "planning-card shell-card record-card" });
  const titleRow = createElement("div", { className: "shell-card__title-row" });
  titleRow.append(createElement("h3", { textContent: title }));
  titleRow.append(createElement("span", { className: "status-badge", textContent: badge }));
  card.append(
    titleRow,
    createElement("p", { className: "recommendation", textContent: description })
  );
  for (const [label, value] of metrics) {
    card.append(createMetric(label, value));
  }
  return card;
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

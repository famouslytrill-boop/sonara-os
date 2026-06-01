import { createElement, createMetric } from "../../../dom.ts";
import {
  blockedTunnelRoutes,
  buildTunnelCommand,
  devTunnelAuditPlaceholders,
  devTunnelProviders,
  devTunnelSafetyWarnings,
  devTunnelWebhookNotes,
  evaluateTunnelRouteSafety,
  tunnelPurposeLabels,
  type DevTunnelProvider,
  type DevTunnelPurpose
} from "../../../lib/dev-tunnel-tools/index.ts";

type FieldControl = HTMLInputElement | HTMLSelectElement;

const providerLabels: Record<DevTunnelProvider, string> = {
  pinggy: "Pinggy",
  ngrok: "ngrok",
  cloudflare_tunnel: "Cloudflare Tunnel",
  localhost_run: "localhost.run",
  localtunnel: "localtunnel"
};

export function renderDevTunnelToolsPage() {
  const page = createElement("section", { className: "work-screen sonara-shell record-page" });
  const header = createElement("header", { className: "shell-header" });
  header.append(
    createElement("p", { className: "shell-kicker", textContent: "Shared Admin" }),
    createElement("h1", { textContent: "Dev Tunnel Tools" }),
    createElement("p", {
      className: "screen-copy",
      textContent:
        "Build reviewed local tunnel command previews for local preview, mobile testing, and webhook testing."
    })
  );

  page.append(
    header,
    createElement("p", {
      className: "warning-copy",
      textContent:
        "Command preview only. This page does not start tunnels, deploy services, or expose production routes."
    }),
    renderCommandBuilder(),
    renderRouteSafetyChecker(),
    renderProviderDocs(),
    renderBlockedRouteChecklist(),
    renderWebhookNotes(),
    renderAuditPlaceholders()
  );
  return page;
}

function renderCommandBuilder() {
  const card = createElement("article", { className: "planning-card shell-card record-section" });
  const provider = createSelectField("Provider", providerLabels);
  const purpose = createSelectField("Purpose", tunnelPurposeLabels);
  const port = createNumberField("Local port", "3000", true);
  const output = createElement("pre", {
    className: "recommendation",
    textContent: "Generate a command preview before running anything manually."
  });
  const button = createElement("button", {
    className: "primary-action",
    type: "button",
    textContent: "Generate command preview"
  });

  button.addEventListener("click", () => {
    const result = buildTunnelCommand({
      provider: provider.control.value as DevTunnelProvider,
      purpose: purpose.control.value as DevTunnelPurpose,
      localPort: Number(port.control.value)
    });
    output.textContent = result.ok
      ? `${result.command}\n\nWarnings:\n${result.warnings.map((warning) => `- ${warning}`).join("\n")}`
      : `Error: ${result.error ?? "Unable to generate tunnel command."}`;
  });

  card.append(
    createElement("h2", { textContent: "Command Builder" }),
    createElement("p", {
      className: "recommendation",
      textContent:
        "Preview a provider command for local use. Commands are not executed by SONARA One."
    }),
    provider.wrapper,
    purpose.wrapper,
    port.wrapper,
    button,
    output
  );
  return card;
}

function renderRouteSafetyChecker() {
  const card = createElement("article", { className: "planning-card shell-card record-section" });
  const route = createTextField("Route to check", "/webhook/test", true);
  const output = createElement("p", {
    className: "status-copy",
    textContent: "Check a route before using it through a tunnel."
  });
  const button = createElement("button", {
    className: "secondary-action",
    type: "button",
    textContent: "Check route safety"
  });

  button.addEventListener("click", () => {
    const result = evaluateTunnelRouteSafety(route.control.value);
    output.textContent = result.allowed ? result.message : `Blocked: ${result.message}`;
  });

  card.append(
    createElement("h2", { textContent: "Tunnel Safety Gate" }),
    createElement("p", {
      className: "recommendation",
      textContent:
        "Check routes before sharing a tunnel URL. Unsafe routes stay blocked for public tunnel exposure."
    }),
    route.wrapper,
    button,
    output
  );
  return card;
}

function renderProviderDocs() {
  const section = createElement("section", { className: "record-section" });
  const grid = createElement("div", { className: "planning-grid" });
  for (const provider of devTunnelProviders) {
    const card = createElement("article", { className: "planning-card shell-card" });
    card.append(
      createElement("h3", { textContent: provider.name }),
      createElement("p", { className: "recommendation", textContent: provider.notes }),
      createMetric("Command style", provider.commandStyle)
    );
    grid.append(card);
  }
  section.append(createElement("h2", { textContent: "Providers" }), grid);
  return section;
}

function renderBlockedRouteChecklist() {
  const section = createElement("section", { className: "record-section" });
  const grid = createElement("div", { className: "planning-grid" });
  for (const route of blockedTunnelRoutes) {
    const card = createElement("article", { className: "planning-card shell-card" });
    card.append(
      createElement("h3", { textContent: route.pattern }),
      createElement("p", { className: "recommendation", textContent: route.description }),
      createMetric("Risk", route.risk),
      createMetric("Tunnel exposure", "Blocked")
    );
    grid.append(card);
  }
  section.append(createElement("h2", { textContent: "Blocked Route Checklist" }), grid);
  return section;
}

function renderWebhookNotes() {
  const section = createElement("section", { className: "record-section" });
  const list = createElement("ul", { className: "security-list" });
  for (const note of devTunnelWebhookNotes) {
    list.append(createElement("li", { textContent: note }));
  }
  section.append(createElement("h2", { textContent: "Webhook Test Notes" }), list);
  return section;
}

function renderAuditPlaceholders() {
  const section = createElement("section", { className: "record-section" });
  const grid = createElement("div", { className: "planning-grid" });
  for (const placeholder of devTunnelAuditPlaceholders) {
    const card = createElement("article", { className: "planning-card shell-card" });
    card.append(
      createElement("h3", { textContent: placeholder.eventType }),
      createElement("p", { className: "recommendation", textContent: placeholder.summary }),
      createMetric("Status", placeholder.status),
      createMetric("Human review", placeholder.humanReviewRequired ? "Required" : "Not required")
    );
    grid.append(card);
  }
  section.append(
    createElement("h2", { textContent: "Audit Placeholders" }),
    createSafetyWarnings(),
    grid
  );
  return section;
}

function createSafetyWarnings() {
  const list = createElement("ul", { className: "security-list" });
  for (const warning of devTunnelSafetyWarnings) {
    list.append(createElement("li", { textContent: warning }));
  }
  return list;
}

function createTextField(label: string, placeholder: string, required: boolean) {
  const input = createElement("input", { type: "text" });
  input.placeholder = placeholder;
  input.required = required;
  return createField(label, input);
}

function createNumberField(label: string, placeholder: string, required: boolean) {
  const input = createElement("input", { type: "number", value: placeholder });
  input.placeholder = placeholder;
  input.required = required;
  input.min = "1";
  input.max = "65535";
  input.inputMode = "numeric";
  return createField(label, input);
}

function createSelectField<T extends string>(label: string, options: Record<T, string>) {
  const select = createElement("select");
  for (const [value, text] of Object.entries(options)) {
    const option = createElement("option", { value, textContent: text as string });
    select.append(option);
  }
  return createField(label, select);
}

function createField<T extends FieldControl>(label: string, control: T) {
  const id = `dev-tunnel-field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Math.random()
    .toString(36)
    .slice(2)}`;
  const wrapper = createElement("label", { className: "record-field" });
  wrapper.htmlFor = id;
  control.id = id;
  wrapper.append(createElement("span", { textContent: label }), control);
  return { wrapper, control };
}

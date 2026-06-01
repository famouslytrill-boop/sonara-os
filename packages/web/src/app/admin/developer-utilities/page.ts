import { createElement } from "../../../dom.ts";
import {
  decodeBase64,
  decodeJwt,
  decodeUrl,
  encodeBase64,
  encodeUrl,
  formatJson,
  generateSlug,
  generateUuid,
  redactWebhookPayload,
  type UtilityResult
} from "../../../lib/developer-utilities/index.ts";

export function renderDeveloperUtilitiesPage() {
  const page = createElement("section", { className: "work-screen sonara-shell record-page" });
  const header = createElement("header", { className: "shell-header" });
  header.append(
    createElement("p", { className: "shell-kicker", textContent: "Shared Admin" }),
    createElement("h1", { textContent: "Developer Utility Center" }),
    createElement("p", {
      className: "screen-copy",
      textContent:
        "Internal local-only utilities for formatting, encoding, decoding, identifiers, slugs, and redacted webhook review."
    })
  );
  page.append(
    header,
    createElement("p", {
      className: "warning-copy",
      textContent:
        "Sensitive utility input is not saved by this UI. Webhook payloads are redacted before display."
    }),
    renderJsonFormatter(),
    renderEncodingTools(),
    renderGeneratorTools(),
    renderJwtDecoder(),
    renderWebhookViewer()
  );
  return page;
}

function renderJsonFormatter() {
  const card = createUtilityCard("JSON formatter", "Format JSON locally without saving input.");
  const input = createTextarea("Paste JSON");
  const output = createOutput();
  const button = createElement("button", {
    className: "primary-action",
    type: "button",
    textContent: "Format JSON"
  });
  button.addEventListener("click", () =>
    writeUtilityResult(output, formatJson(input.control.value))
  );
  card.append(input.wrapper, button, output);
  return card;
}

function renderEncodingTools() {
  const card = createUtilityCard("Encoding tools", "Base64 and URL encode/decode helpers.");
  const input = createTextarea("Enter text");
  const output = createOutput();
  const actions = createElement("div", { className: "trust-warning-list" });
  const buttons: readonly (readonly [string, () => UtilityResult])[] = [
    ["Base64 encode", () => encodeBase64(input.control.value)],
    ["Base64 decode", () => decodeBase64(input.control.value)],
    ["URL encode", () => encodeUrl(input.control.value)],
    ["URL decode", () => decodeUrl(input.control.value)]
  ];
  for (const [label, action] of buttons) {
    const button = createElement("button", {
      className: "secondary-action",
      type: "button",
      textContent: label
    });
    button.addEventListener("click", () => writeUtilityResult(output, action()));
    actions.append(button);
  }
  card.append(input.wrapper, actions, output);
  return card;
}

function renderGeneratorTools() {
  const card = createUtilityCard("Generators", "Create UUIDs and URL-safe slugs.");
  const slugInput = createTextInput("Slug source");
  const output = createOutput();
  const actions = createElement("div", { className: "trust-warning-list" });
  const uuidButton = createElement("button", {
    className: "secondary-action",
    type: "button",
    textContent: "Generate UUID"
  });
  const slugButton = createElement("button", {
    className: "secondary-action",
    type: "button",
    textContent: "Generate slug"
  });
  uuidButton.addEventListener("click", () => {
    output.textContent = generateUuid();
  });
  slugButton.addEventListener("click", () => {
    output.textContent = generateSlug(slugInput.control.value);
  });
  actions.append(uuidButton, slugButton);
  card.append(slugInput.wrapper, actions, output);
  return card;
}

function renderJwtDecoder() {
  const card = createUtilityCard(
    "JWT decode only",
    "Decode header and payload without verification."
  );
  const input = createTextarea("Paste JWT");
  const output = createOutput();
  const button = createElement("button", {
    className: "primary-action",
    type: "button",
    textContent: "Decode JWT"
  });
  button.addEventListener("click", () => {
    const result = decodeJwt(input.control.value);
    output.textContent = result.ok
      ? JSON.stringify(
          {
            warning: result.warning,
            signaturePresent: result.signaturePresent,
            header: result.header,
            payload: result.payload
          },
          null,
          2
        )
      : `Error: ${result.error ?? result.warning}`;
  });
  card.append(input.wrapper, button, output);
  return card;
}

function renderWebhookViewer() {
  const card = createUtilityCard(
    "Webhook payload viewer",
    "View webhook payloads with secret-like fields redacted before display."
  );
  const input = createTextarea("Paste webhook payload");
  const output = createOutput();
  const button = createElement("button", {
    className: "primary-action",
    type: "button",
    textContent: "Redact payload"
  });
  button.addEventListener("click", () => {
    const result = redactWebhookPayload(input.control.value);
    output.textContent = `${result.output}\n\nRedactions: ${result.redactionCount}`;
  });
  card.append(input.wrapper, button, output);
  return card;
}

function createUtilityCard(title: string, description: string) {
  const card = createElement("article", { className: "planning-card shell-card record-section" });
  card.append(
    createElement("h2", { textContent: title }),
    createElement("p", { className: "recommendation", textContent: description })
  );
  return card;
}

function createTextarea(label: string) {
  const wrapper = createElement("label", { className: "record-field" });
  const textarea = createElement("textarea");
  textarea.rows = 6;
  textarea.placeholder = label;
  wrapper.append(createElement("span", { textContent: label }), textarea);
  return { wrapper, control: textarea };
}

function createTextInput(label: string) {
  const wrapper = createElement("label", { className: "record-field" });
  const input = createElement("input", { type: "text" });
  input.placeholder = label;
  wrapper.append(createElement("span", { textContent: label }), input);
  return { wrapper, control: input };
}

function createOutput() {
  return createElement("pre", { className: "recommendation", textContent: "No output yet." });
}

function writeUtilityResult(output: HTMLElement, result: UtilityResult) {
  output.textContent = result.ok ? result.output : `Error: ${result.error ?? "Unable to process"}`;
}

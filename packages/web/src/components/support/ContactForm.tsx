import { createElement } from "../../dom.ts";

export function renderContactForm() {
  const form = createElement("form", { className: "planning-card shell-card" });
  form.setAttribute("method", "post");
  form.setAttribute("action", "/api/contact");
  form.setAttribute("aria-label", "Contact SONARA Industries");
  form.append(
    createElement("h2", { textContent: "Send a request" }),
    createField("email", "Email", "email", true),
    createCategoryField(),
    createMessageField(),
    createHoneypotField(),
    createConsentField()
  );
  form.append(
    createElement("button", {
      className: "primary-action",
      type: "submit",
      textContent: "Submit request"
    }),
    createElement("p", {
      className: "warning-copy",
      textContent:
        "Do not include passwords, card numbers, bank details, API keys, private keys, or sensitive customer data."
    })
  );
  return form;
}

function createField(name: string, labelText: string, type: string, required = false) {
  const label = createElement("label", { textContent: labelText });
  const input = createElement("input", { type });
  input.setAttribute("name", name);
  input.setAttribute("autocomplete", name === "email" ? "email" : "on");
  input.setAttribute("aria-label", labelText);
  if (required) {
    input.setAttribute("required", "true");
  }
  label.append(input);
  return label;
}

function createCategoryField() {
  const label = createElement("label", { textContent: "Request type" });
  const select = createElement("select");
  select.setAttribute("name", "category");
  select.setAttribute("aria-label", "Request type");
  select.setAttribute("required", "true");
  for (const [value, labelText] of [
    ["contact", "General contact"],
    ["support", "Support"],
    ["feedback", "Feedback"]
  ] as const) {
    const option = createElement("option", { textContent: labelText });
    option.setAttribute("value", value);
    select.append(option);
  }
  label.append(select);
  return label;
}

function createMessageField() {
  const label = createElement("label", { textContent: "Message" });
  const textarea = createElement("textarea");
  textarea.setAttribute("name", "message");
  textarea.setAttribute("aria-label", "Message");
  textarea.setAttribute("required", "true");
  textarea.setAttribute("maxlength", "4000");
  label.append(textarea);
  return label;
}

function createHoneypotField() {
  const label = createElement("label", { textContent: "Leave this field blank" });
  label.setAttribute(
    "style",
    "position:absolute;left:-10000px;top:auto;width:1px;height:1px;overflow:hidden;"
  );
  const input = createElement("input", { type: "text" });
  input.setAttribute("name", "company_website");
  input.setAttribute("tabindex", "-1");
  input.setAttribute("autocomplete", "off");
  label.append(input);
  return label;
}

function createConsentField() {
  const label = createElement("label", {
    textContent: "I consent to SONARA storing this request and contacting me about it."
  });
  const checkbox = createElement("input", { type: "checkbox", value: "yes" });
  checkbox.setAttribute("name", "consent");
  checkbox.setAttribute("required", "true");
  checkbox.setAttribute("aria-label", "Consent to store and respond");
  label.prepend(checkbox);
  return label;
}

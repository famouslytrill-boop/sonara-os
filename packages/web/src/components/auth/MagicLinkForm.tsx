import { createElement } from "../../dom.ts";

export function renderMagicLinkForm({ title = "Email magic link" }: { title?: string } = {}) {
  const form = createElement("form", { className: "planning-card shell-card" });
  form.setAttribute("aria-label", title);
  const label = createElement("label", { textContent: "Email" });
  const input = createElement("input", { type: "email" });
  input.setAttribute("name", "email");
  input.setAttribute("autocomplete", "email");
  input.setAttribute("inputmode", "email");
  input.setAttribute("aria-label", "Email address");
  label.append(input);
  const button = createElement("button", { type: "button", textContent: "Send link" });
  button.setAttribute("disabled", "true");
  form.append(
    createElement("h2", { textContent: title }),
    label,
    button,
    createElement("p", {
      className: "recommendation",
      textContent:
        "Magic links require Supabase email templates, redirect URLs, and outbound email provider review."
    })
  );
  return form;
}

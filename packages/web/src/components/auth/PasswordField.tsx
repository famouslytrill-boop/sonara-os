import { createElement } from "../../dom.ts";

export function renderPasswordField({
  id,
  label,
  autocomplete
}: {
  id: string;
  label: string;
  autocomplete: string;
}) {
  const wrapper = createElement("label", { textContent: label });
  const input = createElement("input", { type: "password" });
  input.setAttribute("id", id);
  input.setAttribute("name", id);
  input.setAttribute("autocomplete", autocomplete);
  input.setAttribute("aria-label", label);
  const toggle = createElement("button", { type: "button", textContent: "Show" });
  toggle.setAttribute("aria-label", `Show ${label.toLowerCase()}`);
  toggle.addEventListener("click", () => {
    const visible = input.getAttribute("type") === "text";
    input.setAttribute("type", visible ? "password" : "text");
    toggle.textContent = visible ? "Show" : "Hide";
    toggle.setAttribute("aria-label", `${visible ? "Show" : "Hide"} ${label.toLowerCase()}`);
  });
  wrapper.append(input, toggle);
  return wrapper;
}

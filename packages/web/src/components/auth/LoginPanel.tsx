import { createElement } from "../../dom.ts";
import { renderLoginForm } from "./LoginForm.tsx";

export function renderLoginPanel() {
  const panel = createElement("section", { className: "auth-panel" });
  panel.append(renderLoginForm());
  return panel;
}

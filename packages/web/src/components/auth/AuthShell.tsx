import { createElement } from "../../dom.ts";
import { renderPublicShell } from "../../ui/shared-components.ts";

export function renderAuthShell({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: readonly HTMLElement[];
}) {
  const page = renderPublicShell("auth-page");
  const links = createElement("p", { className: "recommendation" });
  links.append(
    createElement("a", { href: "/terms", textContent: "Terms" }),
    document.createTextNode(" · "),
    createElement("a", { href: "/privacy", textContent: "Privacy" }),
    document.createTextNode(" · "),
    createElement("a", { href: "/support", textContent: "Support" })
  );
  page.append(
    createElement("p", { className: "shell-kicker", textContent: "SONARA Industries" }),
    createElement("h1", { textContent: title }),
    createElement("p", { className: "screen-copy", textContent: description }),
    ...children,
    links
  );
  return page;
}

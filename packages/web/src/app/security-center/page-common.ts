import { createElement } from "../../dom.ts";

export function createSecuritySubPage({
  kicker,
  title,
  description
}: {
  kicker: string;
  title: string;
  description: string;
}) {
  const page = createElement("section", { className: "work-screen sonara-shell security-page" });
  const header = createElement("header", { className: "shell-header" });
  header.append(
    createElement("p", { className: "shell-kicker", textContent: kicker }),
    createElement("h1", { textContent: title }),
    createElement("p", { className: "screen-copy", textContent: description }),
    createElement("a", {
      className: "ghost-action security-back-link",
      href: "/security-center",
      textContent: "Back to Security Center"
    })
  );
  page.append(header);
  return page;
}

export function createSecurityList(items: readonly string[]) {
  const list = createElement("ul", { className: "security-list" });
  for (const item of items) {
    list.append(createElement("li", { textContent: item }));
  }
  return list;
}

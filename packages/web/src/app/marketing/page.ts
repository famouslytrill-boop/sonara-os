import { createElement } from "../../dom.ts";
import { renderSignalOrb } from "../../signalOrb.ts";

export function renderMarketingPage() {
  const page = createElement("section", { className: "work-screen overview-screen" });
  page.append(
    renderSignalOrb(),
    createElement("h1", { textContent: "Creator Studio" }),
    createElement("p", {
      className: "screen-copy",
      textContent:
        "A governed creative workflow for music creation, optimization, release, and catalog scaling."
    }),
    createElement("a", {
      className: "primary-action",
      href: "/create",
      textContent: "Start creating"
    })
  );
  return page;
}

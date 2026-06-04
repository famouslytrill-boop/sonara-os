import { createElement, createMetric } from "../../dom.ts";

export function renderNotFoundPage(pathname = "") {
  const page = createElement("section", {
    className: "work-screen sonara-shell protected-route-card"
  });
  page.setAttribute("role", "status");
  page.append(
    createElement("p", { className: "shell-kicker", textContent: "Not found" }),
    createElement("h1", { textContent: "That page is not available." }),
    createElement("p", {
      className: "screen-copy",
      textContent:
        "The route was not found. Use the navigation to return to an available SONARA Industries page."
    }),
    createMetric("Route", pathname || "Unknown route"),
    createElement("a", {
      className: "secondary-action security-back-link",
      href: "/",
      textContent: "Back home"
    })
  );
  return page;
}

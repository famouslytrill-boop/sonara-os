import { createElement, createMetric } from "../../dom.ts";

export function renderAccountPage() {
  const page = createElement("section", { className: "work-screen" });
  page.append(
    createElement("h1", { textContent: "Account" }),
    createElement("p", {
      className: "screen-copy",
      textContent:
        "Auth-ready account surface. Local MVP access remains open until Supabase SSR is configured."
    }),
    createMetric("Auth Boundary", "prepared"),
    createMetric("Supabase SSR", "configuration pending"),
    createMetric("Local MVP", "available")
  );
  return page;
}

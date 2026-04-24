import { clearElement, createElement } from "./dom.ts";
import { renderAnalyzePage } from "./pages/analyzePage.ts";
import { renderCreatePage } from "./pages/createPage.ts";
import { renderExportPage } from "./pages/exportPage.ts";
import { renderMutationPage } from "./pages/mutationPage.ts";

export type AppRoute = "/create" | "/analyze" | "/compose" | "/mutation" | "/export";

export function normalizeRoute(pathname: string): AppRoute {
  if (pathname === "/analyze") {
    return "/analyze";
  }
  if (pathname === "/compose") {
    return "/compose";
  }
  if (pathname === "/mutation") {
    return "/mutation";
  }
  if (pathname === "/export") {
    return "/export";
  }
  return "/create";
}

export function createApp(root: HTMLElement) {
  function routeTo(path: string) {
    window.history.pushState({}, "", path);
    render();
  }

  function render() {
    const route = normalizeRoute(window.location.pathname);
    clearElement(root);
    root.append(createNavigation(route));

    if (route === "/analyze") {
      root.append(renderAnalyzePage());
      return;
    }
    if (route === "/mutation") {
      root.append(renderMutationPage());
      return;
    }
    if (route === "/export") {
      root.append(renderExportPage());
      return;
    }
    if (route === "/compose") {
      root.append(renderComposePlaceholder());
      return;
    }
    root.append(renderCreatePage(routeTo));
  }

  window.addEventListener("popstate", render);
  root.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const link = target.closest("a");
    const href = link?.getAttribute("href");
    if (!href?.startsWith("/")) {
      return;
    }
    event.preventDefault();
    routeTo(href);
  });

  render();
  return Object.freeze({ render, routeTo });
}

function createNavigation(activeRoute: AppRoute) {
  const nav = createElement("nav", { className: "app-nav" });
  for (const [href, label] of [
    ["/create", "Create"],
    ["/analyze", "Analyze"],
    ["/compose", "Compose"],
    ["/mutation", "Mutation"],
    ["/export", "Export"]
  ] as const) {
    const link = createElement("a", { href, textContent: label });
    if (href === activeRoute) {
      link.setAttribute("aria-current", "page");
    }
    nav.append(link);
  }
  return nav;
}

function renderComposePlaceholder() {
  const page = createElement("section", { className: "work-screen" });
  page.append(
    createElement("h1", { textContent: "Compose" }),
    createElement("p", {
      className: "screen-copy",
      textContent: "Mock workflow state is preserved for composition review."
    })
  );
  return page;
}

if (typeof document !== "undefined") {
  const root = document.getElementById("app");
  if (root) {
    createApp(root);
  }
}

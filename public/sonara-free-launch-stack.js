// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

(() => {
  const root = document.querySelector("[data-launch-stack]");
  if (!root) return;

  const cards = [...root.querySelectorAll("[data-launch-stack-card]")];
  const filters = [...root.querySelectorAll("[data-launch-stack-filter]")];
  const search = root.querySelector("[data-launch-stack-search]");
  const empty = root.querySelector("[data-launch-stack-empty]");
  let category = "all";

  function update() {
    const query = String(search?.value || "").trim().toLowerCase();
    let visible = 0;
    for (const card of cards) {
      const categoryMatch = category === "all" || card.dataset.category === category;
      const searchMatch = !query || String(card.dataset.search || "").includes(query);
      const show = categoryMatch && searchMatch;
      card.hidden = !show;
      if (show) visible += 1;
    }
    if (empty) empty.hidden = visible !== 0;
  }

  for (const filter of filters) {
    filter.addEventListener("click", () => {
      category = filter.dataset.launchStackFilter || "all";
      for (const entry of filters) entry.setAttribute("aria-pressed", String(entry === filter));
      update();
    });
  }
  if (search) search.addEventListener("input", update);
})();

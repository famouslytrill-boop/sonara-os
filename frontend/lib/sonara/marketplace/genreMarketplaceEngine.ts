import type { GenreMarketplacePlan } from "./genreMarketplaceTypes";

export function getGenreMarketplacePlan(): GenreMarketplacePlan {
  return {
    launchStatus: "delayed",
    allowedNow: ["metadata templates", "personal exports", "store readiness checks", "rights classification"],
    blockedUntilLater: ["user-to-user kit sales", "public third-party sound commerce", "marketplace commission", "resale of third-party downloaded sounds"],
  };
}

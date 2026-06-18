import { getSignalEnv } from "../env.ts";

export type RestaurantModule = Readonly<{
  id: string;
  title: string;
  route: string;
  enabled: boolean;
  features: readonly string[];
  blocked: readonly string[];
}>;

export function getRestaurantGrowthModules(): readonly RestaurantModule[] {
  const env = getSignalEnv();
  return Object.freeze([
    module(
      "restaurant_pack",
      "Restaurant Growth Pack",
      "/business-builder/restaurant-pack",
      env.enableRestaurantPack === true,
      [
        "Missed call tracking placeholder",
        "Catering/private event lead capture placeholder",
        "Reservation handoff checklist",
        "Data ownership messaging"
      ]
    ),
    module(
      "restaurant_ai_receptionist",
      "Restaurant AI Receptionist",
      "/business-builder/restaurant-ai-receptionist",
      env.enableRestaurantAiReceptionist === true,
      [
        "Reservation inquiry script builder",
        "Event inquiry script builder",
        "Guest FAQ script builder",
        "Hours/location script builder",
        "Menu question script builder",
        "Human review before activating scripts"
      ]
    )
  ]);
}

function module(
  id: string,
  title: string,
  route: string,
  enabled: boolean,
  features: readonly string[]
): RestaurantModule {
  return Object.freeze({
    id,
    title,
    route,
    enabled,
    features: Object.freeze([...features]),
    blocked: Object.freeze([
      "live phone answering",
      "outbound calling",
      "ringless voicemail",
      "voice provider dependency",
      "24/7 answering claims",
      "full reservation platform"
    ])
  });
}

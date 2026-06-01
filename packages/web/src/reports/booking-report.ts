import { featureFlags } from "../lib/shared/feature-flags.ts";
import type { SonaraReport } from "./types.ts";

export function createBookingReport(): SonaraReport {
  return {
    ok: true,
    system: "Booking Page",
    publicNames: ["Booking Page"],
    internalEngines: ["BookingInfrastructure"],
    enabled: featureFlags.BOOKING_APPOINTMENTS_ENABLED,
    safetyRules: ["Feature flag required", "Human review required", "Placeholder status disclosed"],
    nextActions: ["Keep implementation scoped to approved launch sequence."]
  };
}

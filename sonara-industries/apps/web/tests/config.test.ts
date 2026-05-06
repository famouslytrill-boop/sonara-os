import { describe, expect, it } from "vitest";
import { getAuthScope } from "../lib/auth";
import { divisions } from "../lib/divisions";
import { pricing } from "../lib/pricing";

describe("company route and pricing config", () => {
  it("keeps product apps separated", () => {
    expect(divisions.music.name).toBe("SoundOS");
    expect(divisions.tableops.name).toBe("TableOS");
    expect(divisions.civic.name).toBe("AlertOS");
    expect(getAuthScope("soundos").sessionCookie).toBe("soundos_session");
    expect(getAuthScope("tableos").sessionCookie).toBe("tableos_session");
    expect(getAuthScope("alertos").sessionCookie).toBe("alertos_session");
  });

  it("has distinct pricing groups", () => {
    expect(pricing.soundos.length).toBeGreaterThan(0);
    expect(pricing.tableos.length).toBeGreaterThan(0);
    expect(pricing.alertos.length).toBeGreaterThan(0);
  });
});

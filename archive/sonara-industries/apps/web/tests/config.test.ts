import { describe, expect, it } from "vitest";
import { getAuthScope } from "../lib/auth";
import { divisions } from "../lib/divisions";
import { pricing } from "../lib/pricing";

describe("company route and pricing config", () => {
  it("keeps product apps separated", () => {
    expect(divisions.music.name).toBe("TrackFoundry");
    expect(divisions.tableops.name).toBe("LineReady");
    expect(divisions.civic.name).toBe("NoticeGrid");
    expect(getAuthScope("trackfoundry").sessionCookie).toBe("trackfoundry_session");
    expect(getAuthScope("lineready").sessionCookie).toBe("lineready_session");
    expect(getAuthScope("noticegrid").sessionCookie).toBe("noticegrid_session");
  });

  it("has distinct pricing groups", () => {
    expect(pricing.trackfoundry.length).toBeGreaterThan(0);
    expect(pricing.lineready.length).toBeGreaterThan(0);
    expect(pricing.noticegrid.length).toBeGreaterThan(0);
  });
});

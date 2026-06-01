import { describe, expect, it } from "vitest";
import { evaluateApiProvider, getBlockedApiProviders } from "./index.ts";

describe("API provider registry", () => {
  it("blocks scraping and unofficial messaging providers", () => {
    expect(getBlockedApiProviders().map((provider) => provider.providerId)).toEqual(
      expect.arrayContaining([
        "direct_google_scraping",
        "unofficial_whatsapp_automation",
        "pentestagent_reference"
      ])
    );
  });

  it("keeps new research providers server-side and review-gated", () => {
    expect(evaluateApiProvider("github")).toMatchObject({
      status: "needs_terms_review",
      frontendSecretsAllowed: false
    });
    expect(evaluateApiProvider("longlive_reference").status).toBe("needs_terms_review");
    expect(evaluateApiProvider("nasa_worldview_reference").rules.join(" ")).toContain(
      "No NASA endorsement"
    );
  });

  it("defaults unknown providers to review", () => {
    expect(evaluateApiProvider("unknown").status).toBe("needs_terms_review");
    expect(evaluateApiProvider("unknown").frontendSecretsAllowed).toBe(false);
  });
});

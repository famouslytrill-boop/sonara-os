import { describe, expect, it, vi } from "vitest";
import { createProviderGateway } from "./providerGateway.ts";

describe("Provider Gateway music-style safety", () => {
  it("passes safe music-style requests through to the provider", async () => {
    const complete = vi.fn(async (request) => ({
      prompt: request.prompt,
      musicStyle: request.musicStyle
    }));
    const gateway = createProviderGateway({
      provider: {
        name: "test-provider",
        complete
      }
    });

    const result = await gateway.complete({
      prompt: "Make a spacious evolving pad",
      musicStyle: "ambient"
    });

    expect(result).toMatchObject({ ok: true, blocked: false, provider: "test-provider" });
    expect(complete).toHaveBeenCalledOnce();
  });

  it("blocks artist imitation and does not call the provider", async () => {
    const complete = vi.fn(async () => ({}));
    const onSafetyDecision = vi.fn();
    const gateway = createProviderGateway({
      provider: {
        name: "test-provider",
        complete
      },
      onSafetyDecision
    });

    const result = await gateway.complete({
      prompt: "Make it exactly like a named artist",
      musicStyle: "ambient"
    });

    expect(result.blocked).toBe(true);
    expect(result.reasons).toContain("Prompt asks for artist imitation or direct style copying.");
    expect(complete).not.toHaveBeenCalled();
    expect(onSafetyDecision).toHaveBeenCalledOnce();
  });
});

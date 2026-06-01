import { describe, expect, it } from "vitest";
import { checkAudioDeviceSupport, listAudioInputDevices } from "./media/audio-device-check.ts";
import { checkVideoDeviceSupport, listVideoInputDevices } from "./media/video-device-check.ts";

describe("media readiness helpers", () => {
  it("does not crash during SSR audio checks", async () => {
    expect(checkAudioDeviceSupport().status).toBeTruthy();
    await expect(listAudioInputDevices()).resolves.toEqual([]);
  });

  it("does not crash during SSR video checks", async () => {
    expect(checkVideoDeviceSupport().status).toBeTruthy();
    await expect(listVideoInputDevices()).resolves.toEqual([]);
  });
});

// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
(function (root) {
  "use strict";
  const TILE_PIXELS = 262144;
  function imageBudget({ width, height, inputBytes, deviceMemory } = {}) {
    const maxPixels = Number(deviceMemory) > 0 && Number(deviceMemory) <= 2 ? 4194304 : 16777216;
    if (![width, height, inputBytes].every((value) => Number.isSafeInteger(value) && value > 0) ||
        inputBytes > 20 * 1024 * 1024 || width > 8192 || height > 8192 || width * height > maxPixels) {
      return { ok: false, maxPixels, code: "image_budget_exceeded" };
    }
    const tileRows = Math.max(1, Math.floor(TILE_PIXELS / width));
    return { ok: true, maxPixels, tileRows, pixels: width * height,
      estimatedWorkingBytes: width * height * 16 + TILE_PIXELS * 4 * 5 };
  }
  function scalePixels(bytes, percent) {
    if (!(bytes instanceof Uint8ClampedArray) || bytes.length % 4 || bytes.length > TILE_PIXELS * 4 ||
        !Number.isInteger(percent) || percent < 0 || percent > 200) throw new TypeError("Invalid image tile or brightness");
    const result = new Uint8ClampedArray(bytes.length);
    for (let i = 0; i < bytes.length; i += 4) {
      for (let channel = 0; channel < 3; channel++) result[i + channel] = Math.min(255, Math.floor((bytes[i + channel] * percent + 50) / 100));
      result[i + 3] = bytes[i + 3];
    }
    return result;
  }
  const api = Object.freeze({ imageBudget, scalePixels, TILE_PIXELS });
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SonaraImageCore = api;
}(typeof self !== "undefined" ? self : globalThis));

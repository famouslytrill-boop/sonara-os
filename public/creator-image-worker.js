// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
self.importScripts("/creator-image-core.js");
self.onmessage = function (event) {
  const { id, pixels, percent } = event.data || {};
  try {
    const result = self.SonaraImageCore.scalePixels(new Uint8ClampedArray(pixels), percent);
    self.postMessage({ id, pixels: result.buffer }, [result.buffer]);
  } catch { self.postMessage({ id, error: "invalid_image_tile" }); }
};

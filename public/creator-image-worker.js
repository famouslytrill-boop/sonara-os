// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
self.importScripts("/creator-image-core.js");
self.onmessage = function (event) {
  // Dedicated-worker MessagePort deliveries use an empty origin. Any supplied
  // non-empty origin must still match this same-origin worker's location.
  if (event.origin !== "" && event.origin !== self.location.origin) return;
  const { id, pixels, percent } = event.data || {};
  try {
    const result = self.SonaraImageCore.scalePixels(new Uint8ClampedArray(pixels), percent);
    self.postMessage({ id, pixels: result.buffer }, [result.buffer]);
  } catch { self.postMessage({ id, error: "invalid_image_tile" }); }
};

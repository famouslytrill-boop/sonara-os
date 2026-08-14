"use strict";

// A value that is actually a number, as opposed to one Number() will turn into
// zero. `Number(null)`, `Number("")` and `Number(false)` are all 0 and all
// finite, so a `Number.isFinite` guard accepts a missing value and counts it as
// nothing -- which is how a total over rows with a blank amount reads as
// complete while being short by however many were blank. Found by a recipe with
// one uncosted ingredient reporting a confident cost per portion; the same
// guard was already totalling invoice lines and purchase orders.
function finiteNumber(value) {
  if (value === null || value === undefined || value === "" || typeof value === "boolean") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

module.exports = { finiteNumber };

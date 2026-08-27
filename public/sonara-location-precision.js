/* How precisely a check-in records where somebody was.
 *
 * Shared between the browser that captures the position and the server that
 * stores it, for the reason every shared file here is shared: two answers to
 * "what does approximate mean" is a person told one thing and recorded another.
 *
 * ## Rounding happens on the device, and that is the whole point
 *
 * `location_events.privacy_mode` has allowed precise, approximate, masked and
 * manual since migration 015, and nothing has ever set it to anything but the
 * default. /staff/location renders it. So the column has been telling everybody
 * "precise" for as long as it has existed, chosen by a database default rather
 * than by the person it describes.
 *
 * Rounding on the server would not fix that. By the time a coordinate reaches
 * the server it has already left the phone, crossed the network, and been read
 * by an application -- "approximate" would describe the storage and not the
 * disclosure. So the browser rounds before it posts, and the server never sees
 * the precise value at all. That is why this file is shared rather than a
 * server-side helper: the rounding a person chose has to run on their device.
 *
 * The server still applies the same function. Not as a second line of defence
 * -- it cannot recover precision that was never sent -- but so a payload that
 * arrives finer than its own declared mode is stored at the coarseness it
 * claims, rather than being trusted because it said the right word.
 *
 * ## Why accuracy is widened along with the coordinates
 *
 * A masked point rounded to a ~1.1km grid still carries the device's own
 * accuracy figure, which might be 8 metres. Anything drawing a circle from that
 * draws a tight one around a place the person was not. So the stored accuracy
 * is the larger of the device's and the grid's -- the honest bound on where
 * they actually were, rather than a precise-looking number about a coordinate
 * that is deliberately wrong.
 *
 * ## manual records no coordinates at all
 *
 * Not rounded to nothing: absent. It is the option for somebody who wants a
 * check-in on the record and does not want to say where from, and it has to be
 * genuinely empty for that to be true.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SonaraLocationPrecision = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Metres per degree of latitude, near enough anywhere. Longitude degrees are
  // narrower away from the equator, so a grid stated in these terms is a worst
  // case for how far a rounded point can be from the true one -- which is the
  // direction an accuracy figure should err in.
  const METRES_PER_DEGREE = 111320;

  // The four modes, in the order a person reads them: most precise first.
  // `decimals: null` means no coordinates are sent at all.
  //
  // Grid sizes come from the decimal places rather than being written twice:
  // 3 decimals is a ~111m cell, 2 decimals is a ~1.1km cell. Stating one and
  // computing the other is how the two come to disagree.
  const MODES = [
    {
      value: "precise",
      label: "Exactly where I am",
      decimals: null,
      exact: true,
      note: "Your position is recorded as your device reports it."
    },
    {
      value: "approximate",
      label: "Roughly where I am",
      decimals: 3,
      exact: false,
      note: "Rounded on your device to about 100 metres before it is sent."
    },
    {
      value: "masked",
      label: "The general area",
      decimals: 2,
      exact: false,
      note: "Rounded on your device to about a kilometre before it is sent."
    },
    {
      value: "manual",
      label: "Just that I checked in",
      decimals: null,
      exact: false,
      note: "No position is sent at all — only that you checked in, and when."
    }
  ];

  const BY_VALUE = {};
  for (let i = 0; i < MODES.length; i += 1) BY_VALUE[MODES[i].value] = MODES[i];

  const DEFAULT_MODE = "approximate";

  function modeFor(value) {
    // An unknown mode falls back to `approximate` rather than to `precise`.
    // Both are defensible readings of "we could not tell what they chose" and
    // only one of them is safe: the failure mode of a typo must not be a more
    // exact record of somebody's location than they asked for.
    return BY_VALUE[String(value || "")] || BY_VALUE[DEFAULT_MODE];
  }

  function isFiniteNumber(value) {
    return typeof value === "number" ? Number.isFinite(value) : value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
  }

  function round(value, decimals) {
    const factor = Math.pow(10, decimals);
    return Math.round(Number(value) * factor) / factor;
  }

  /** How far, in metres, a coordinate rounded to this many decimals can be out. */
  function gridMetres(decimals) {
    if (decimals === null || decimals === undefined) return 0;
    // Half a cell, because rounding moves a point to the nearest grid line
    // rather than to the corner of the cell it fell in.
    return (METRES_PER_DEGREE * Math.pow(10, -decimals)) / 2;
  }

  /**
   * A reading from the device, reduced to what the chosen mode permits.
   *
   * Returns `{ mode, latitude, longitude, accuracyMeters }` with the
   * coordinates `null` whenever the mode sends none. Speed and heading are
   * deliberately not carried through here: both describe movement rather than
   * position, and a check-in is a moment.
   */
  function reduce(reading, requestedMode) {
    const mode = modeFor(requestedMode);
    const hasPosition = reading && isFiniteNumber(reading.latitude) && isFiniteNumber(reading.longitude);

    if (mode.value === "manual" || !hasPosition) {
      return {
        // A mode that asked for coordinates and got none is recorded as manual
        // rather than as itself. "Approximate, with no position" would be a row
        // claiming a precision it does not have.
        mode: "manual",
        latitude: null,
        longitude: null,
        accuracyMeters: null
      };
    }

    const deviceAccuracy = isFiniteNumber(reading.accuracyMeters) ? Number(reading.accuracyMeters) : null;

    if (mode.exact) {
      return {
        mode: mode.value,
        latitude: Number(reading.latitude),
        longitude: Number(reading.longitude),
        accuracyMeters: deviceAccuracy
      };
    }

    const grid = gridMetres(mode.decimals);
    return {
      mode: mode.value,
      latitude: round(reading.latitude, mode.decimals),
      longitude: round(reading.longitude, mode.decimals),
      // Widened, never narrowed. See the header: a rounded point carrying the
      // device's own accuracy claims to be somewhere it is not.
      accuracyMeters: Math.round(Math.max(grid, deviceAccuracy === null ? 0 : deviceAccuracy))
    };
  }

  return { MODES, DEFAULT_MODE, METRES_PER_DEGREE, modeFor, gridMetres, reduce };
});

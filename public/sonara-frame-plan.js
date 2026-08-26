/* How many frames to pull out of a video, and from where.
 *
 * Shared between the browser that does the pulling and the server that
 * validates what came back, for the usual reason: two answers to "which frame
 * is frame 40" is a scroll site that plays back wrong and nothing that says so.
 *
 * ## The decisions here, and why they are decisions
 *
 * **Frame count is derived from length, not fixed.** A one-second clip does not
 * need 240 frames and a twenty-second one is unwatchable at 60. The target is
 * a scrub that feels continuous under a thumb, which is roughly 24 frames per
 * second of source, clamped at both ends.
 *
 * **The ceiling is about bytes, not taste.** Every frame is downloaded by every
 * visitor. At 1280 wide a JPEG is on the order of 80KB, so 300 frames is around
 * 24MB of page weight -- already a lot, and the point past which a scroll site
 * stops being a web page. The cap is stated in those terms in `estimateBytes`
 * so the editor can show it rather than just enforce it.
 *
 * **Long videos are refused, not silently truncated.** Taking the first eight
 * seconds of somebody's ninety-second film and saying nothing produces a site
 * that is confidently wrong about its own content.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SonaraFramePlan = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const FRAMES_PER_SECOND = 24;
  const MIN_FRAMES = 12;
  const MAX_FRAMES = 300;
  const MAX_SECONDS = 20;
  // Long edge. 1280 is the width at which a full-bleed background still looks
  // sharp on a laptop and a frame is still tens of kilobytes rather than
  // hundreds.
  const MAX_EDGE = 1280;
  const JPEG_QUALITY = 0.82;
  // Roughly what a 1280-wide photographic JPEG costs at that quality. Used only
  // to warn somebody before they build something enormous, so it is deliberately
  // a round number rather than a false precision.
  const TYPICAL_FRAME_BYTES = 80 * 1024;

  function finite(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  /**
   * Work out the plan, or say why there is not one.
   *
   * Returns { ok: true, ... } or { ok: false, code, detail }. Never throws and
   * never returns a partial plan: a caller holding a plan can rely on every
   * field being there.
   */
  function planFor(source) {
    const duration = finite(source && source.duration);
    const width = finite(source && source.width);
    const height = finite(source && source.height);

    // `Number.isFinite` rather than a truthiness check, because a WebM produced
    // by MediaRecorder reports `duration` as `Infinity` until it has been
    // seeked -- a real and well-known quirk, and one that would otherwise
    // produce `Infinity * 24` frames.
    if (duration === null || duration <= 0) {
      return { ok: false, code: "no_duration", detail: "This file does not say how long it is, so there is no way to know where the frames are." };
    }
    if (duration > MAX_SECONDS) {
      return {
        ok: false,
        code: "too_long",
        // The number, so somebody can go and trim it rather than guess.
        detail: `This clip is ${duration.toFixed(1)} seconds and the limit is ${MAX_SECONDS}. Trim it and try again — a scroll site reads better with a few seconds than with a whole film.`
      };
    }
    if (!width || !height || width < 2 || height < 2) {
      return { ok: false, code: "no_picture", detail: "This file has no picture in it, so there are no frames to take." };
    }

    const count = Math.max(MIN_FRAMES, Math.min(MAX_FRAMES, Math.round(duration * FRAMES_PER_SECOND)));

    // Scaled to fit the long edge, and never scaled *up*: enlarging a 480p clip
    // to 1280 makes the download four times bigger and the picture no better.
    const longest = Math.max(width, height);
    const scale = longest > MAX_EDGE ? MAX_EDGE / longest : 1;
    const outWidth = Math.max(2, Math.round(width * scale / 2) * 2);
    const outHeight = Math.max(2, Math.round(height * scale / 2) * 2);

    // Evenly spaced, first frame at 0 and last just inside the end. Seeking to
    // exactly `duration` lands past the final sample in most decoders and gives
    // back either the previous frame or nothing at all.
    const last = Math.max(0, duration - Math.min(0.04, duration / (count * 2)));
    const timestamps = [];
    for (let index = 0; index < count; index += 1) {
      timestamps.push(count === 1 ? 0 : (index / (count - 1)) * last);
    }

    return {
      ok: true,
      count,
      timestamps,
      width: outWidth,
      height: outHeight,
      quality: JPEG_QUALITY,
      duration,
      estimatedBytes: count * TYPICAL_FRAME_BYTES
    };
  }

  // The name a frame is written under, inside the export folder. The same
  // padding the renderer's `%d` pattern expands to, kept here so the two cannot
  // disagree about whether frame 7 is `0007` or `007`.
  function frameName(index) {
    let text = String(index);
    while (text.length < 4) text = "0" + text;
    return "frames/" + text + ".jpg";
  }

  function describeSize(bytes) {
    const mb = bytes / (1024 * 1024);
    return mb >= 1 ? `${mb.toFixed(1)}MB` : `${Math.round(bytes / 1024)}KB`;
  }

  return {
    planFor,
    frameName,
    describeSize,
    FRAMES_PER_SECOND, MIN_FRAMES, MAX_FRAMES, MAX_SECONDS, MAX_EDGE, JPEG_QUALITY, TYPICAL_FRAME_BYTES
  };
});

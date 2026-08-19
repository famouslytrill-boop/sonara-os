"use strict";

// What a piece of media has to be, per place it is going.
//
// Sprint 09 was "media", and it was held back because everything media-shaped in
// this product costs money per use -- generation runs through a provider and a
// provider sends a bill. **This is the half that does not.** Deciding whether a
// 1920x1080 video can become a 1080x1920 vertical without cutting the subject's
// head off is geometry, and geometry is free.
//
// Same terms as the other science modules here: no model call, no provider, no
// network, no cost per use, same inputs always the same answer. Nothing in this
// file transcodes anything; it says what the target is and what fitting the
// source to it costs.
//
// ## The numbers are dated, and that is not a disclaimer
//
// Platform requirements change without notice, and a specification table is the
// kind of thing that is quietly wrong for a year. Every entry carries the date
// it was recorded, the page renders that date, and
// docs/media/PLATFORM-SPECS.md carries a review date the stale-claim gate
// enforces. A customer who can see when a figure was checked can decide whether
// to trust it; one who cannot, cannot.

const RECORDED_ON = "2026-08-19";

// Loudness targets are published normalisation levels, in LUFS. A track mastered
// louder than the target is turned DOWN by the platform on playback, so mastering
// hot buys nothing and costs dynamic range -- which is the single most useful
// fact in this file and the one most often got wrong.
const LOUDNESS_TARGETS = Object.freeze([
  { platform: "Spotify", lufs: -14, note: "Turns louder masters down. Quieter masters are not turned up unless the listener has normalisation off." },
  { platform: "Apple Music", lufs: -16, note: "Sound Check normalises to this. Mastering louder than it gains nothing on playback." },
  { platform: "YouTube", lufs: -14, note: "Normalises loud uploads down; the original file is kept." },
  { platform: "Amazon Music", lufs: -14, note: "Normalises on playback." },
  { platform: "Broadcast (EBU R128)", lufs: -23, note: "The European broadcast standard. Much quieter than streaming, and a stream master handed to broadcast will be rejected or crushed." }
]);

// width:height, the duration a platform will accept, and what the placement is
// for. Ratios are stored as numbers so the arithmetic below is arithmetic rather
// than string comparison.
const PLACEMENTS = Object.freeze([
  { key: "vertical_reel", label: "Vertical short video", where: "TikTok, Reels, Shorts", width: 1080, height: 1920, maxSeconds: 180, note: "The safe area is smaller than the frame -- interface controls sit over roughly the top 12% and bottom 20%." },
  { key: "vertical_story", label: "Story", where: "Instagram and Facebook stories", width: 1080, height: 1920, maxSeconds: 60, note: "Splits into 60-second parts beyond the limit." },
  { key: "square_feed", label: "Square feed post", where: "Instagram, Facebook, LinkedIn", width: 1080, height: 1080, maxSeconds: 600, note: "Still the safest single crop when one file has to work in several places." },
  { key: "portrait_feed", label: "Portrait feed post", where: "Instagram feed", width: 1080, height: 1350, maxSeconds: 600, note: "Takes more vertical space in a feed than square, which is why it performs better for the same content." },
  { key: "landscape_video", label: "Landscape video", where: "YouTube, websites, presentations", width: 1920, height: 1080, maxSeconds: null, note: "The only shape that does not need cropping from a standard camera file." },
  { key: "youtube_thumbnail", label: "Video thumbnail", where: "YouTube", width: 1280, height: 720, maxSeconds: null, note: "Read at about 210 pixels wide in a sidebar, so anything smaller than a face is decoration." },
  { key: "podcast_cover", label: "Podcast cover", where: "Apple Podcasts, Spotify", width: 3000, height: 3000, maxSeconds: null, note: "Square, and shown as small as 55 pixels in a list." },
  { key: "release_cover", label: "Music release cover", where: "Streaming distributors", width: 3000, height: 3000, maxSeconds: null, note: "Distributors reject covers carrying URLs, social handles, or anything the artist does not own." }
]);

function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}

// "1920x1080" is a size; "16:9" is what somebody recognises. Reduced by the
// greatest common divisor so 1080x1350 reads as 4:5 rather than 1080:1350.
function ratioLabel(width, height) {
  const divisor = gcd(Math.round(width), Math.round(height)) || 1;
  return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`;
}

/**
 * What fitting a source into a placement costs.
 *
 * Two ways to fit, and they are not equivalent:
 *   * **cover** -- fill the frame and lose what falls outside it. Nothing is
 *     added and something is thrown away.
 *   * **contain** -- fit the whole picture and pad the rest. Nothing is lost and
 *     bars appear.
 *
 * Both are reported, because which one is acceptable depends on what is in the
 * frame and this cannot see the frame.
 */
function fitCost(sourceWidth, sourceHeight, targetWidth, targetHeight) {
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = targetWidth / targetHeight;

  // Cover: scale so both dimensions reach the target, crop the overflow.
  const coverScale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const coveredWidth = sourceWidth * coverScale;
  const coveredHeight = sourceHeight * coverScale;
  const keptArea = (targetWidth * targetHeight) / (coveredWidth * coveredHeight);
  const croppedAway = 1 - keptArea;

  // Contain: scale so the whole picture fits, pad the rest.
  const containScale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const fittedWidth = sourceWidth * containScale;
  const fittedHeight = sourceHeight * containScale;
  const paddedArea = 1 - (fittedWidth * fittedHeight) / (targetWidth * targetHeight);

  // Whether the target asks for more pixels than the source has. Upscaling is
  // possible and is not free -- it is the difference between a sharp small file
  // and a soft large one, and a platform will not tell anybody it happened.
  const upscaleFactor = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);

  return {
    sourceRatio,
    targetRatio,
    sameShape: Math.abs(sourceRatio - targetRatio) < 0.005,
    croppedAway,
    croppedFrom: coveredWidth > targetWidth + 0.5 ? "sides" : coveredHeight > targetHeight + 0.5 ? "top and bottom" : "nothing",
    paddedArea,
    paddedWith: fittedWidth < targetWidth - 0.5 ? "bars at the sides" : fittedHeight < targetHeight - 0.5 ? "bars above and below" : "nothing",
    needsUpscale: upscaleFactor > 1.0001,
    upscaleFactor
  };
}

const MAX_UPSCALE_WORTH_DOING = 2;

/**
 * Plan every placement for one source file.
 * @param {{width: number|string, height: number|string, seconds?: number|string}} source
 */
function mediaPlan(source = {}) {
  const width = finiteNumber(source.width);
  const height = finiteNumber(source.height);
  const seconds = finiteNumber(source.seconds);

  if (width === null || height === null) {
    return { ok: false, code: "size_required", message: "The width and height of what you have are both needed before any of this can be worked out." };
  }
  if (width <= 0 || height <= 0) {
    return { ok: false, code: "size_impossible", message: "A width and a height are both bigger than zero." };
  }

  const placements = PLACEMENTS.map((placement) => {
    const fit = fitCost(width, height, placement.width, placement.height);
    const tooLong = placement.maxSeconds !== null && seconds !== null && seconds > placement.maxSeconds;
    return {
      ...placement,
      ratio: ratioLabel(placement.width, placement.height),
      ...fit,
      tooLong,
      // Stated rather than left for somebody to work out from a percentage. The
      // decision a person is making is "can I use this here", and the honest
      // answers are yes, yes-with-a-cost, and no.
      verdict: fit.sameShape
        ? "fits exactly"
        : fit.needsUpscale && fit.upscaleFactor > MAX_UPSCALE_WORTH_DOING
          ? "too small -- it would be stretched more than twice and will look soft"
          : fit.croppedAway > 0.4
            ? "loses a lot -- more than 40% of the picture goes"
            : "usable, with a crop or bars"
    };
  });

  return {
    ok: true,
    source: { width, height, seconds, ratio: ratioLabel(width, height) },
    placements,
    exact: placements.filter((entry) => entry.sameShape).length,
    tooLong: placements.filter((entry) => entry.tooLong).map((entry) => entry.label),
    recordedOn: RECORDED_ON,
    basis: "the shape and size of the file only. It has not seen the picture, so it cannot tell you whether the part being cropped is the part that matters."
  };
}

module.exports = {
  LOUDNESS_TARGETS,
  MAX_UPSCALE_WORTH_DOING,
  PLACEMENTS,
  RECORDED_ON,
  fitCost,
  finiteNumber,
  mediaPlan,
  ratioLabel
};

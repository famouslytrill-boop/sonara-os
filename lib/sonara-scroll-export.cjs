"use strict";

// The site as a folder somebody can host anywhere.
//
// The promise the export makes is narrow and absolute: unzip it, put it on any
// static host, and it is the page you were looking at. No build step, no
// install, no server, no account with anybody.
//
// Everything here follows from that.
//
// **The same renderer.** `index.html` comes from `renderSite` -- the function
// that also draws the preview and the published page. An export written by a
// second renderer would drift, and the drift would only ever be discovered by a
// customer whose downloaded site did not match what they signed off.
//
// **Nothing fetched at run time.** `standalone: true` drops the Google Fonts
// link, so the folder does not quietly depend on a third party being reachable.
// The stack falls back to the system serif or sans, which is a slightly
// different page and an honest one; a page that renders in Times when the CDN
// is blocked, having looked like Playfair in the preview, is the export
// breaking its own promise.
//
// **A README that is true.** Written from the site being exported rather than
// from a fixed string, so it names what is actually in the folder -- including
// the frames and the audio when there are any, and saying plainly when there
// are not.

const { renderSite } = require("./sonara-scroll-render.cjs");
const { createZip } = require("./sonara-zip.cjs");

const RUNTIME_FILENAME = "scroll.js";

function readme(site, { frameCount, audioIncluded }) {
  const lines = [
    `# ${site.title}`,
    "",
    "A static site. Put these files on any web host and it works.",
    "",
    "## What is here",
    "",
    "- `index.html` — the page. Everything about how it looks is inside it.",
    `- \`${RUNTIME_FILENAME}\` — scroll behaviour. The page reads without it; it will not look as good.`
  ];

  if (frameCount > 0) {
    lines.push(`- \`frames/\` — ${frameCount} images, played through as you scroll.`);
  }
  if (audioIncluded) {
    lines.push("- `audio/` — the soundtrack. It only plays when a visitor presses the button.");
  }

  lines.push(
    "",
    "## Putting it somewhere",
    "",
    "Anything that serves files will do — Netlify, Cloudflare Pages, GitHub Pages,",
    "S3, or a folder on a server you already have. Drop the whole folder in. There",
    "is no build step and nothing to configure.",
    "",
    "## Two things worth knowing",
    "",
    "The scroll animation uses a CSS feature that Chrome, Edge and Safari support",
    "and Firefox currently does not. Where it is missing the page simply appears",
    "finished rather than animating in, so nobody sees a blank screen — but it is",
    "worth looking at your site in Firefox once so the difference is not a surprise.",
    "",
    "Fonts are the ones already on the visitor's machine. The version you edited",
    "online loads webfonts; this one deliberately does not, so the folder does not",
    "stop working when somebody else's font server does."
  );

  if (site.problems.length) {
    lines.push(
      "",
      "## Noted at the time this was exported",
      ""
    );
    for (const problem of site.problems) lines.push(`- ${problem.detail}`);
  }

  return lines.join("\n") + "\n";
}

/**
 * Build the export.
 *
 *   site       a site from buildSite()
 *   runtime    the contents of public/sonara-scroll.js, read by the caller
 *   frames     [{ index, bytes }] -- optional, and see below
 *   audio      { filename, bytes } -- optional
 *
 * Frames and audio are passed in as bytes rather than fetched here, because
 * this module has no business making network calls and a caller that already
 * holds the files should not have them re-read.
 *
 * Returns { zip, manifest } where the manifest lists every path written. The
 * manifest is what the tests assert against: "the zip has 312 entries" is
 * checkable, and "the export worked" is not.
 */
/**
 * The text files an export contains, without zipping anything.
 *
 * Pulled out of `buildExport` for the browser path: when somebody brings their
 * own video, the frames are extracted and zipped on their machine, and only
 * these come from the server. It is the same function either way, so the page
 * inside a browser-built folder is byte for byte the page inside a
 * server-built one -- which is the whole reason the browser asks rather than
 * rendering its own.
 *
 *   frameCount  how many frames the *caller* will add. The page is written to
 *               scrub through exactly that many, so a caller that says 240 and
 *               writes 200 produces a site whose last forty frames are 404s.
 */
function exportFiles({ site, runtime, frameCount = 0, audioFilename = null }) {
  if (typeof runtime !== "string" || !runtime.trim()) {
    throw new TypeError("exportFiles needs the runtime script; without it the exported page loads a file that is not there");
  }

  const exported = {
    ...site,
    frames: frameCount >= 2
      ? { ...site.frames, count: frameCount, pattern: "frames/%d.jpg" }
      : { count: 0, pattern: "", width: 0, height: 0 },
    audio: audioFilename && site.audio.enabled
      ? { ...site.audio, url: `audio/${audioFilename}` }
      : { ...site.audio, url: "", enabled: false }
  };

  return [
    { name: "index.html", contents: renderSite(exported, { standalone: true, scriptHref: `./${RUNTIME_FILENAME}`, footer: "" }) },
    { name: RUNTIME_FILENAME, contents: runtime },
    { name: "README.md", contents: readme(site, { frameCount, audioIncluded: Boolean(audioFilename && site.audio.enabled) }) }
  ];
}

function buildExport({ site, runtime, frames = [], audio = null }) {
  if (!site || !Array.isArray(site.sections)) {
    throw new TypeError("buildExport needs a site from buildSite()");
  }
  if (typeof runtime !== "string" || !runtime.trim()) {
    // Refused rather than skipped. A ZIP whose index.html loads a scroll.js
    // that is not in the folder is a 404 on every visit, and the page would
    // still look nearly right to whoever tested it -- which is the worst kind
    // of broken to ship.
    throw new TypeError("buildExport needs the runtime script; without it the exported page loads a file that is not there");
  }

  const entries = [];
  const manifest = [];

  const push = (name, data) => {
    entries.push({ name, data });
    manifest.push(name);
  };

  // Frames first, so the index can be written knowing what actually landed.
  const written = new Set();
  for (const frame of frames) {
    const index = Number(frame?.index);
    if (!Number.isInteger(index) || index < 1) continue;
    if (!frame?.bytes || !frame.bytes.length) continue;
    if (written.has(index)) continue;
    written.add(index);
    push(`frames/${String(index).padStart(4, "0")}.jpg`, frame.bytes);
  }

  // The site is re-pointed at the folder's own paths by `exportFiles`. The
  // saved document names wherever the frames are hosted now; inside the ZIP
  // they are `frames/`, and an index.html still pointing at the hosted copies
  // would be a folder that only works while this application is up -- the
  // opposite of the point.
  const includesAudio = Boolean(audio && site.audio.enabled && audio.bytes?.length);
  for (const file of exportFiles({
    site,
    runtime,
    frameCount: written.size,
    audioFilename: includesAudio ? audio.filename : null
  })) {
    push(file.name, file.contents);
  }

  if (includesAudio) push(`audio/${audio.filename}`, audio.bytes);

  return { zip: createZip(entries), manifest, frameCount: written.size };
}

// The filename a customer's browser saves it as. Sanitised because it is built
// from a title somebody typed and ends up in a Content-Disposition header.
function exportFilename(site) {
  // Deliberately not defaulting to a word here: `String(title || "site")`
  // would make `base` non-empty and the fallback below unreachable, which is a
  // dead branch that reads as a considered default.
  const base = String(site?.title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "scroll-site"}.zip`;
}

module.exports = { buildExport, exportFiles, exportFilename, readme, RUNTIME_FILENAME };

"use strict";

// What a cinematic scroll site is, and what it is allowed to say.
//
// A saved site is a row in `scroll_sites` carrying a JSON document, and this is
// the only thing that decides whether that document is one. Everything
// downstream -- the editor, the preview, the published page, the exported ZIP --
// reads the value this returns rather than the raw column, so a site that is
// wrong is wrong in one place instead of four.
//
// ## Normalising rather than trusting
//
// The document comes from a form, and forms are edited by people and by
// whatever else can post to the endpoint. So this does not validate in place and
// hand the original back: it **builds a new object out of known keys**, and
// anything not on the list simply does not survive.
//
// That is stricter than the manifest reader in `tools/serverless-cli/`, which
// refuses an unknown key by name. The difference is who is typing. A person
// hand-writing YAML benefits from "did you mean memory?"; a form post benefits
// from nothing at all reaching the renderer that the renderer did not expect.
//
// ## Colour is not decoration here
//
// A scroll site is mostly a background and text on it. If a customer picks a
// pale grey on white, the page they publish is unreadable and nothing tells
// them -- so contrast is computed, and a pairing below the readable threshold is
// reported as a problem on the site rather than silently published.
// `lib/sonara-contrast.cjs` already does the arithmetic for the design system;
// this uses the same module so the two cannot disagree about what 4.5:1 means.

const { contrastRatio } = require("./sonara-contrast.cjs");

const MAX_SECTIONS = 12;
const MAX_TITLE = 90;
const MAX_HEADING = 120;
const MAX_BODY = 600;
const MAX_LABEL = 40;

// Section kinds, and what each one is for. Adding a kind means adding a
// renderer for it in `lib/sonara-scroll-render.cjs`, and a test asserts the two
// lists match -- a kind with no renderer would save, appear in the editor, and
// render as nothing at all.
const SECTION_KINDS = Object.freeze(["cover", "statement", "detail", "gallery", "quote", "close"]);

// How a section arrives as you scroll to it. Named after what somebody sees
// rather than after the transform, because the editor shows these words.
const MOTIONS = Object.freeze(["fade", "rise", "hold", "zoom"]);

const FONT_SETS = Object.freeze(["editorial", "grotesk", "mono", "humanist"]);

// The palette a site is built from. Six named roles rather than free-form CSS:
// a site whose author can set any property is a site this cannot render into a
// static export and cannot check for readability.
const COLOUR_KEYS = Object.freeze(["background", "text", "accent", "muted", "surface", "surfaceText"]);

const DEFAULT_COLOURS = Object.freeze({
  background: "#0b0d12",
  text: "#f2f4f8",
  accent: "#7cc4ff",
  muted: "#9aa3b2",
  surface: "#151922",
  surfaceText: "#f2f4f8"
});

// Which colour pairs a reader actually has to read, and the ratio each needs.
// Body text is 4.5:1; a large display heading is allowed 3:1 by WCAG, and the
// covers below are display type at 4rem and above.
const READABLE_PAIRS = Object.freeze([
  { foreground: "text", background: "background", minimum: 4.5, what: "your body text on the page background" },
  { foreground: "muted", background: "background", minimum: 4.5, what: "your small print on the page background" },
  { foreground: "surfaceText", background: "surface", minimum: 4.5, what: "text on a card" },
  { foreground: "accent", background: "background", minimum: 3, what: "your accent colour on the page background" }
]);

const HEX = /^#[0-9a-fA-F]{6}$/;

function text(value, limit) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim().slice(0, limit);
}

// A multi-line field keeps its line breaks; only runs of blank lines collapse.
function paragraph(value, limit) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trimEnd())
    .join("\n")
    .trim()
    .slice(0, limit);
}

function oneOf(value, allowed, fallback) {
  const candidate = String(value || "").trim();
  return allowed.includes(candidate) ? candidate : fallback;
}

function colour(value, fallback) {
  const candidate = String(value || "").trim();
  return HEX.test(candidate) ? candidate.toLowerCase() : fallback;
}

/**
 * A slug somebody could type, or null.
 *
 * Returns null rather than a generated slug when the input is unusable. A
 * generated one would publish a site at an address its author never chose and
 * cannot guess, which is worse than refusing.
 */
function slugify(value) {
  const candidate = String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return /^[a-z0-9][a-z0-9-]{1,47}$/.test(candidate) ? candidate : null;
}

function normaliseSection(raw, index) {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    // Stable across saves, so a reorder does not look like a delete and an add.
    id: text(source.id, 40) || `s${index + 1}`,
    kind: oneOf(source.kind, SECTION_KINDS, "statement"),
    motion: oneOf(source.motion, MOTIONS, "fade"),
    eyebrow: text(source.eyebrow, MAX_LABEL),
    heading: text(source.heading, MAX_HEADING),
    body: paragraph(source.body, MAX_BODY),
    // An image is referenced, never embedded here: the document is a database
    // column and a base64 image in it would be read on every page load.
    imageUrl: text(source.imageUrl, 500),
    imageAlt: text(source.imageAlt, 200)
  };
}

/**
 * Build a site from whatever was saved or submitted.
 *
 * Always returns a complete, renderable site -- never throws, never returns a
 * half-built one. Anything unusable falls back to a default, and `problems`
 * carries what a person should be told about. A site that cannot render is not
 * a state the editor, the preview or the export should have to handle.
 */
function buildSite(raw = {}) {
  const source = raw && typeof raw === "object" ? raw : {};
  const problems = [];

  const colours = {};
  for (const key of COLOUR_KEYS) {
    colours[key] = colour(source.colours?.[key], DEFAULT_COLOURS[key]);
  }

  const sectionsIn = Array.isArray(source.sections) ? source.sections : [];
  const sections = sectionsIn.slice(0, MAX_SECTIONS).map(normaliseSection);
  if (sectionsIn.length > MAX_SECTIONS) {
    problems.push({
      code: "too_many_sections",
      // Said as a number rather than as "some": the author can count what is on
      // their own screen and see which ones did not survive.
      detail: `A site can have ${MAX_SECTIONS} sections and this had ${sectionsIn.length}. The last ${sectionsIn.length - MAX_SECTIONS} were not kept.`
    });
  }
  if (!sections.length) {
    problems.push({ code: "no_sections", detail: "This site has no sections yet, so there is nothing to scroll through." });
  }

  // A section with nothing written in it renders as blank space somebody
  // scrolls past wondering whether the page is broken.
  sections.forEach((section, index) => {
    if (!section.heading && !section.body && !section.imageUrl) {
      problems.push({
        code: "empty_section",
        detail: `Section ${index + 1} has no heading, no words and no image, so it will look like a gap.`
      });
    }
  });

  // Readability, computed rather than assumed. Reported as a problem and not
  // as a refusal: it is the author's site, and a warning they can see beats a
  // save they cannot complete.
  for (const pair of READABLE_PAIRS) {
    const ratio = contrastRatio(colours[pair.foreground], colours[pair.background]);
    if (ratio === null) continue;
    if (ratio < pair.minimum) {
      problems.push({
        code: "hard_to_read",
        detail: `At the moment ${pair.what} is ${ratio.toFixed(2)} to 1, and it needs ${pair.minimum} to 1 to be readable. Darken one or lighten the other.`
      });
    }
  }

  const audioUrl = text(source.audio?.url, 500);
  return {
    title: text(source.title, MAX_TITLE) || "Untitled site",
    // Never generated. See slugify.
    slug: slugify(source.slug),
    template: text(source.template, 60),
    fontSet: oneOf(source.fontSet, FONT_SETS, "editorial"),
    colours,
    sections,
    audio: {
      url: audioUrl,
      // Off unless somebody turned it on. AGENTS.md: sounds must be off or
      // explicitly user-controlled by default, and a site that starts playing
      // music at a stranger is the exact thing that rule is about. Autoplay is
      // deliberately not an option at all rather than an option defaulting off.
      enabled: audioUrl ? source.audio?.enabled === true : false,
      label: text(source.audio?.label, MAX_LABEL) || "Soundtrack"
    },
    frames: normaliseFrames(source.frames),
    problems
  };
}

// A frame sequence, when the author brought their own video.
//
// The frames themselves never live in this document -- they are files, and a
// few hundred of them. What is recorded is how many there are and where they
// sit, so the renderer can write the markup that scrubs through them.
function normaliseFrames(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const count = Number(source.count);
  if (!Number.isInteger(count) || count < 2 || count > 600) {
    return { count: 0, pattern: "", width: 0, height: 0 };
  }
  return {
    count,
    // A printf-style pattern rather than a list of 300 URLs in a database
    // column. `%d` is replaced with the zero-padded index.
    pattern: text(source.pattern, 300),
    width: Number.isInteger(Number(source.width)) ? Number(source.width) : 0,
    height: Number.isInteger(Number(source.height)) ? Number(source.height) : 0
  };
}

// The path a single frame sits at. Kept here rather than in the renderer so the
// export writer and the page agree by construction.
function framePath(pattern, index, { pad = 4 } = {}) {
  const padded = String(index).padStart(pad, "0");
  return String(pattern || "").replace("%d", padded);
}

module.exports = {
  buildSite,
  slugify,
  framePath,
  normaliseSection,
  SECTION_KINDS,
  MOTIONS,
  FONT_SETS,
  COLOUR_KEYS,
  DEFAULT_COLOURS,
  READABLE_PAIRS,
  MAX_SECTIONS
};

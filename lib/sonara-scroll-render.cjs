"use strict";

// A site, as a page.
//
// One renderer, three callers: the editor's preview, the published page at
// `/s/:slug`, and the `index.html` inside the exported ZIP. They must not
// disagree, because the whole promise of the export is "what you saw is what
// you are hosting" -- and two renderers is two chances for one to drift.
//
// The export is the strictest of the three: it has to work as a folder of files
// on any host, with no server, no build step and no network. So this produces a
// **self-contained document** -- CSS inline in a `<style>`, no framework, no
// external stylesheet -- and the same document is served for the other two.
// Making the export a special case would mean the thing customers download is
// the one nobody looks at.
//
// ## The finished state is the default, and the animation is layered on
//
// CSS scroll-driven animations (`animation-timeline: view()`) are supported in
// Chrome, Edge and Safari 18, and in Firefox only behind a flag as of Firefox
// 152 in June 2026 -- roughly 84% of browsers. So they are not the mechanism;
// they are the enhancement.
//
// Every section is written **visible, in its final position**, and the
// animation is declared inside `@supports (animation-timeline: view())`. A
// browser without support ignores the block entirely and shows a finished page.
// Doing it the other way round -- animate in from `opacity: 0` and hope -- gives
// 16% of visitors a blank page that scrolls, and the author would never see it,
// because they are looking at Chrome. That is this codebase's recurring defect
// in visual form: it reports success and is not true.
//
// `prefers-reduced-motion` gets the same finished page for the same reason.

const { framePath } = require("./sonara-scroll-site.cjs");
const { COMMON_FONTS } = require("./sonara-scroll-templates.cjs");

function escapeHtml(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// A URL that may go in an attribute.
//
// `javascript:` in an image or audio source is script execution, and this
// document is rendered from a database column somebody typed into. Only http,
// https and same-document relative paths survive; anything else becomes empty,
// which renders as a missing image rather than as an exploit.
function safeUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  // A relative path, which is what the export uses. No scheme, no protocol
  // relative `//host`, no backslashes.
  //
  // `%` is in the set for two reasons, and leaving it out was a real bug: the
  // frame pattern is `frames/%d.jpg`, so an exported page shipped
  // `data-pattern=""` and never loaded a single frame. It also appears in any
  // percent-encoded filename. It cannot introduce a scheme -- the check above
  // has already rejected anything with a colon in front of a slash-slash.
  if (/^[A-Za-z0-9._~%\-/]+$/.test(raw) && !raw.startsWith("//")) return raw;
  return "";
}

// Body copy keeps its paragraph breaks and nothing else. Rendering it as HTML
// would let a saved site inject markup into its own published page.
function paragraphs(body) {
  const text = String(body || "").trim();
  if (!text) return "";
  return text.split(/\n{2,}/).map((block) =>
    `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`).join("");
}

function fontsFor(site) {
  return COMMON_FONTS[site.fontSet] || COMMON_FONTS.editorial;
}

// The Google Fonts families a font set needs, as one stylesheet link. Only
// reached by the published page and the preview; the export is told not to
// include it, because a folder somebody hosts offline should not depend on a
// third party being up.
const FONT_QUERY = Object.freeze({
  editorial: "family=Playfair+Display:wght@500;700&family=Source+Sans+3:wght@400;600",
  grotesk: "family=Space+Grotesk:wght@500;700&family=Inter:wght@400;600",
  mono: "family=JetBrains+Mono:wght@500;700&family=Inter:wght@400;600",
  humanist: "family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Public+Sans:wght@400;600"
});

function styleSheet(site) {
  const { display, body } = fontsFor(site);
  const c = site.colours;
  return `
:root{
  --bg:${c.background};--fg:${c.text};--accent:${c.accent};
  --muted:${c.muted};--surface:${c.surface};--surface-fg:${c.surfaceText};
  --display:${display};--body:${body};
}
*,*::before,*::after{box-sizing:border-box}
html{scroll-behavior:smooth}
body{
  margin:0;background:var(--bg);color:var(--fg);
  font-family:var(--body);font-size:clamp(1rem,0.55vw + 0.9rem,1.15rem);
  line-height:1.65;-webkit-font-smoothing:antialiased;
}
main{width:100%}
.scene{
  min-height:100svh;display:grid;place-items:center;
  padding:clamp(2rem,6vw,6rem) clamp(1.25rem,5vw,4rem);
  position:relative;
}
.scene__inner{width:min(64ch,100%);}
.scene--cover .scene__inner,.scene--close .scene__inner{text-align:center}
.eyebrow{
  font-family:var(--body);font-size:0.78rem;letter-spacing:0.14em;
  text-transform:uppercase;color:var(--accent);margin:0 0 1rem;
}
h1,h2{
  font-family:var(--display);line-height:1.05;text-wrap:balance;
  margin:0 0 1rem;font-weight:700;
}
h1{font-size:clamp(2.6rem,7vw,5.5rem)}
h2{font-size:clamp(1.9rem,4.2vw,3.2rem)}
p{margin:0 0 1rem;color:var(--fg)}
.scene--detail p,.scene--quote p{color:var(--muted)}
.scene--quote .scene__inner{
  background:var(--surface);color:var(--surface-fg);
  padding:clamp(1.5rem,4vw,3rem);border-radius:14px;
}
.scene--quote h2{font-size:clamp(1.4rem,3vw,2.2rem);font-weight:500}
.scene__figure{margin:2rem 0 0}
.scene__figure img{width:100%;height:auto;display:block;border-radius:10px}
.scene--gallery .scene__inner{width:min(96ch,100%)}
.progress{
  position:fixed;inset:0 0 auto 0;height:3px;background:var(--accent);
  transform-origin:0 50%;transform:scaleX(0);z-index:20;
}
/* The soundtrack control. Always a control, never an autoplay: a page that
   starts making noise at a stranger is the thing AGENTS.md forbids. */
.audio{
  position:fixed;right:1rem;bottom:1rem;z-index:20;
  display:inline-flex;align-items:center;gap:0.5rem;
  background:var(--surface);color:var(--surface-fg);
  border:1px solid color-mix(in srgb,var(--surface-fg) 22%,transparent);
  border-radius:999px;padding:0.55rem 1rem;font:inherit;font-size:0.85rem;
  cursor:pointer;
}
.audio:focus-visible,a:focus-visible{outline:3px solid var(--accent);outline-offset:3px}
.frames{position:sticky;top:0;height:100svh;width:100%;overflow:hidden}
.frames canvas,.frames img{width:100%;height:100%;object-fit:cover;display:block}
.frames__track{height:400svh}
.frames__over{
  position:absolute;inset:auto 0 0 0;padding:clamp(1.5rem,5vw,4rem);
  background:linear-gradient(to top,color-mix(in srgb,var(--bg) 88%,transparent),transparent);
}
footer{padding:4rem 1.5rem;text-align:center;color:var(--muted);font-size:0.85rem}
footer a{color:var(--accent)}

/* Every scene above is written in its finished state. What follows is the
   enhancement, and a browser that does not understand it simply skips it and
   shows the page. */
@supports (animation-timeline: view()) {
  @media (prefers-reduced-motion: no-preference) {
    @keyframes scene-fade{from{opacity:0}to{opacity:1}}
    @keyframes scene-rise{from{opacity:0;transform:translateY(3rem)}to{opacity:1;transform:none}}
    @keyframes scene-zoom{from{opacity:0;transform:scale(1.06)}to{opacity:1;transform:none}}
    @keyframes bar{to{transform:scaleX(1)}}
    .scene[data-motion="fade"] .scene__inner{animation:scene-fade linear both;animation-timeline:view();animation-range:entry 10% cover 32%}
    .scene[data-motion="rise"] .scene__inner{animation:scene-rise linear both;animation-timeline:view();animation-range:entry 8% cover 34%}
    .scene[data-motion="zoom"] .scene__inner{animation:scene-zoom linear both;animation-timeline:view();animation-range:entry 5% cover 38%}
    /* "hold" is deliberately no animation at all: some scenes should simply be
       there when you arrive, and a template that moves everything is a template
       where nothing reads as deliberate. */
    .progress{animation:bar linear both;animation-timeline:scroll(root block)}
  }
}
`.trim();
}

function sceneHtml(section) {
  const image = safeUrl(section.imageUrl);
  const figure = image
    ? `<figure class="scene__figure"><img src="${escapeHtml(image)}" alt="${escapeHtml(section.imageAlt)}" loading="lazy" decoding="async"></figure>`
    : "";
  // The cover is the page's one h1. Everything after it is an h2, so the
  // document has a heading order a screen reader can move through.
  const headingTag = section.kind === "cover" ? "h1" : "h2";
  const heading = section.heading
    ? `<${headingTag}>${escapeHtml(section.heading)}</${headingTag}>`
    : "";
  const eyebrow = section.eyebrow ? `<p class="eyebrow">${escapeHtml(section.eyebrow)}</p>` : "";

  return `<section class="scene scene--${escapeHtml(section.kind)}" data-motion="${escapeHtml(section.motion)}" id="${escapeHtml(section.id)}">
  <div class="scene__inner">${eyebrow}${heading}${paragraphs(section.body)}${figure}</div>
</section>`;
}

// The frame sequence, when there is one.
//
// A tall track with a sticky canvas inside it: the canvas stays on screen while
// the track scrolls past, and the runtime picks which frame to draw from how far
// through the track you are. The first frame is written as an `<img>` inside a
// `<noscript>` so a visitor with no JavaScript sees the footage rather than a
// blank sticky box.
function framesHtml(site) {
  if (!site.frames.count || !site.frames.pattern) return "";
  const first = escapeHtml(safeUrl(framePath(site.frames.pattern, 1)));
  const width = site.frames.width || 1280;
  const height = site.frames.height || 720;
  return `<div class="frames__track" data-frames="${site.frames.count}" data-pattern="${escapeHtml(safeUrl(site.frames.pattern))}" data-width="${width}" data-height="${height}">
  <div class="frames">
    <canvas width="${width}" height="${height}" aria-label="Footage that moves as you scroll"></canvas>
    <noscript><img src="${first}" alt="The first frame of the footage on this page" width="${width}" height="${height}"></noscript>
  </div>
</div>`;
}

function audioHtml(site) {
  const url = safeUrl(site.audio.url);
  if (!url || !site.audio.enabled) return "";
  // `preload="none"`: the file is not fetched until somebody presses play, so a
  // visitor who never wants the sound never pays for it either.
  return `<button class="audio" type="button" data-audio hidden>Play ${escapeHtml(site.audio.label)}</button>
<audio data-audio-source src="${escapeHtml(url)}" preload="none" loop></audio>`;
}

/**
 * Render a site to one self-contained HTML document.
 *
 *   standalone  true for the export: no font CDN, no absolute links back here
 *   scriptHref  where the runtime lives; the export writes its own copy
 *   footer      what to say at the bottom, if anything
 */
function renderSite(site, { standalone = false, scriptHref = "/sonara-scroll.js", footer = "" } = {}) {
  const scenes = site.sections.map(sceneHtml).join("\n");
  const frames = framesHtml(site);

  // Fonts are linked for the hosted page and never for the export. A downloaded
  // folder that silently needs fonts.googleapis.com is a folder that renders
  // differently offline than it did in the preview, which is exactly the
  // promise the export makes.
  const fontLink = standalone || !FONT_QUERY[site.fontSet]
    ? ""
    : `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?${FONT_QUERY[site.fontSet]}&display=swap">`;

  const footerHtml = footer ? `<footer>${footer}</footer>` : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(site.title)}</title>
<meta name="color-scheme" content="dark light">
${fontLink}
<style>
${styleSheet(site)}
</style>
</head>
<body>
<div class="progress" aria-hidden="true"></div>
<main>
${frames}
${scenes}
</main>
${audioHtml(site)}
${footerHtml}
<script src="${escapeHtml(scriptHref)}" defer></script>
</body>
</html>
`;
}

module.exports = { renderSite, styleSheet, sceneHtml, framesHtml, audioHtml, escapeHtml, safeUrl, paragraphs, FONT_QUERY };

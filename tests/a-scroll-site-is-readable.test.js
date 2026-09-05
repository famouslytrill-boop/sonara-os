"use strict";

// A cinematic scroll site, and the three ways it could look finished and not be.
//
// **It could be blank.** The animation that makes it cinematic is a CSS feature
// roughly 84% of browsers have. Written the obvious way -- start at opacity 0
// and animate in -- the other 16% get a page that scrolls through nothing, and
// the author never sees it because they are looking at Chrome.
//
// **It could be unreadable.** A customer picks their own colours. Pale grey on
// white publishes perfectly happily.
//
// **The download could differ from the preview.** The export is the only
// artifact nobody checks before a customer hosts it.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { buildSite, slugify, framePath, SECTION_KINDS, MOTIONS, MAX_SECTIONS } = require("../lib/sonara-scroll-site.cjs");
const { TEMPLATES, siteFromTemplate, templateByKey } = require("../lib/sonara-scroll-templates.cjs");
const { renderSite, styleSheet, safeUrl } = require("../lib/sonara-scroll-render.cjs");
const { buildExport, exportFilename } = require("../lib/sonara-scroll-export.cjs");
const { contrastRatio } = require("../lib/sonara-contrast.cjs");
const { extractZip } = require("./helpers/system-zip.cjs");

const RUNTIME = fs.readFileSync(path.join(__dirname, "..", "public", "sonara-scroll.js"), "utf8");

// Build the export, unpack it with `unzip`, and hand back what is actually in
// the folder. Reading the archive rather than re-rendering is the whole point:
// the export is the one artifact nobody looks at before hosting it.
function unpacked(site, { frames = [], audio = null } = {}) {
  const { zip, manifest } = buildExport({ site, runtime: RUNTIME, frames, audio });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sonara-export-"));
  try {
    const zipPath = path.join(dir, "site.zip");
    fs.writeFileSync(zipPath, zip);
    extractZip(zipPath, path.join(dir, "out"));
    const read = (name) => fs.readFileSync(path.join(dir, "out", name), "utf8");
    return { manifest, indexHtml: read("index.html"), runtime: read("scroll.js"), readme: read("README.md"), dir: path.join(dir, "out") };
  } finally {
    // The files are read before this runs, so the caller gets strings rather
    // than paths into a directory that is about to disappear.
    setTimeout(() => fs.rmSync(dir, { recursive: true, force: true }), 0).unref?.();
  }
}

function siteWith(overrides = {}) {
  return buildSite({ ...siteFromTemplate("midnight-launch"), ...overrides });
}

describe("a scroll site is readable", () => {
  describe("the templates somebody starts from", () => {
    it("has templates to check, so nothing below passes on an empty list", () => {
      assert.ok(TEMPLATES.length >= 4, `only ${TEMPLATES.length} templates; this suite is checking almost nothing`);
    });

    for (const template of TEMPLATES) {
      it(`"${template.name}" starts with no problems on it`, () => {
        const site = buildSite(siteFromTemplate(template.key));
        assert.deepEqual(
          site.problems, [],
          `this template is offered as a starting point and starts with: ${site.problems.map((p) => p.detail).join(" ")}`
        );
      });

      it(`"${template.name}" has readable colours, checked rather than eyeballed`, () => {
        const ratio = contrastRatio(template.colours.text, template.colours.background);
        assert.ok(ratio !== null, "a colour in this template could not be parsed");
        assert.ok(ratio >= 4.5, `body text on the background is ${ratio.toFixed(2)}:1, below the 4.5:1 somebody needs to read it`);
      });

      it(`"${template.name}" says something in every section`, () => {
        for (const [index, section] of template.sections.entries()) {
          assert.ok(
            section.heading || section.body,
            `section ${index + 1} is empty, so it renders as a gap somebody scrolls past`
          );
        }
      });
    }

    it("gives each new site its own copy, not the template itself", () => {
      const first = siteFromTemplate("midnight-launch");
      first.sections[0].heading = "Changed by one customer";
      const second = siteFromTemplate("midnight-launch");
      assert.notEqual(
        second.sections[0].heading, "Changed by one customer",
        "one customer's edit reached the template every later customer starts from"
      );
      assert.notEqual(templateByKey("midnight-launch").sections[0].heading, "Changed by one customer");
    });

    it("returns nothing for a template that does not exist", () => {
      assert.equal(siteFromTemplate("no-such-template"), null);
    });
  });

  describe("what a saved document is allowed to contain", () => {
    it("keeps the words and the colours somebody chose", () => {
      const site = buildSite({
        title: "My site",
        colours: { background: "#101010", text: "#FAFAFA" },
        sections: [{ kind: "cover", heading: "Hello", body: "First line.\n\nSecond." }]
      });
      assert.equal(site.title, "My site");
      assert.equal(site.colours.background, "#101010");
      assert.equal(site.colours.text, "#fafafa", "a hex colour was not normalised to one case");
      assert.equal(site.sections[0].body, "First line.\n\nSecond.", "paragraph breaks were lost");
    });

    it("drops a key nothing renders rather than carrying it through", () => {
      const site = buildSite({
        title: "x",
        sections: [{ kind: "cover", heading: "Hi", onclick: "alert(1)", style: "position:fixed" }]
      });
      assert.ok(!("onclick" in site.sections[0]), "an unknown key survived into the render");
      assert.ok(!("style" in site.sections[0]));
    });

    it("falls back rather than accepting a section kind nothing can draw", () => {
      const site = buildSite({ sections: [{ kind: "carousel", heading: "Hi" }] });
      assert.ok(SECTION_KINDS.includes(site.sections[0].kind), "an unrenderable kind was saved and would draw as nothing");
    });

    it("refuses a colour that is not one, instead of writing it into the CSS", () => {
      const site = buildSite({ colours: { background: "red; } body { display:none" } });
      assert.match(site.colours.background, /^#[0-9a-f]{6}$/, "a non-hex colour reached the stylesheet");
    });

    it("says the site is empty rather than rendering nothing quietly", () => {
      const site = buildSite({ sections: [] });
      assert.ok(site.problems.some((problem) => problem.code === "no_sections"));
    });

    it("names a section that would render as a gap", () => {
      const site = buildSite({ sections: [{ kind: "statement" }] });
      const problem = site.problems.find((entry) => entry.code === "empty_section");
      assert.ok(problem, "a section with nothing in it was accepted silently");
      assert.match(problem.detail, /Section 1/, "the problem does not say which section");
    });

    it("counts what it dropped when there are too many sections", () => {
      const many = Array.from({ length: MAX_SECTIONS + 3 }, (_, i) => ({ kind: "statement", heading: `S${i}` }));
      const site = buildSite({ sections: many });
      assert.equal(site.sections.length, MAX_SECTIONS);
      const problem = site.problems.find((entry) => entry.code === "too_many_sections");
      assert.ok(problem, "three sections vanished with nothing said");
      assert.match(problem.detail, /last 3 were not kept/);
    });

    it("warns about colours somebody could not read, with the actual number", () => {
      const site = buildSite({
        colours: { background: "#ffffff", text: "#e8e8e8" },
        sections: [{ kind: "cover", heading: "Invisible" }]
      });
      const problem = site.problems.find((entry) => entry.code === "hard_to_read");
      assert.ok(problem, "grey on white was published with nothing said about it");
      assert.match(problem.detail, /to 1/, "the warning does not give the ratio, so nobody can tell how far off they are");
    });

    it("does not warn about a palette that is fine", () => {
      const site = buildSite(siteFromTemplate("paper-and-ink"));
      assert.ok(
        !site.problems.some((entry) => entry.code === "hard_to_read"),
        "a readable palette was flagged, which teaches people to ignore the warning"
      );
    });
  });

  describe("the soundtrack", () => {
    it("is off unless somebody turned it on", () => {
      assert.equal(buildSite({ audio: { url: "https://example.com/a.mp3" } }).audio.enabled, false);
      assert.equal(buildSite({ audio: { url: "https://example.com/a.mp3", enabled: true } }).audio.enabled, true);
    });

    it("cannot be enabled with nothing to play", () => {
      assert.equal(buildSite({ audio: { enabled: true } }).audio.enabled, false);
    });

    it("renders as a button and never as autoplay", () => {
      const html = renderSite(buildSite({
        ...siteFromTemplate("midnight-launch"),
        audio: { url: "https://example.com/a.mp3", enabled: true, label: "Score" }
      }));
      assert.match(html, /<button class="audio"/, "there is no way to start the sound");
      // The attribute, not the word: the stylesheet carries a comment explaining
      // why there is no autoplay, and a test that cannot tell a comment from an
      // attribute would fail on the explanation.
      const audioTag = html.slice(html.indexOf("<audio"), html.indexOf(">", html.indexOf("<audio")) + 1);
      assert.ok(audioTag.startsWith("<audio"), "there is no audio element to check");
      assert.ok(!/\bautoplay\b/.test(audioTag), "the page starts making noise at a stranger");
      assert.match(html, /preload="none"/, "the audio file is fetched for visitors who never play it");
    });
  });

  describe("the page it renders", () => {
    it("writes every section's words into the document", () => {
      const site = siteWith();
      const html = renderSite(site);
      for (const section of site.sections) {
        if (section.heading) assert.ok(html.includes(section.heading.replace(/&/g, "&amp;")), `"${section.heading}" is missing from the page`);
      }
    });

    it("escapes what somebody typed rather than running it", () => {
      const html = renderSite(buildSite({
        title: "</title><script>alert(1)</script>",
        sections: [{ kind: "cover", heading: "<img src=x onerror=alert(1)>", body: "a & b" }]
      }));
      assert.ok(!/<script>alert\(1\)<\/script>/.test(html), "a title closed the tag it was inside and ran");
      // The escaped text `&lt;img ... onerror=...&gt;` is *supposed* to be in the
      // document -- that is the heading, rendered as words. What must not exist
      // is a real tag carrying the handler.
      assert.ok(!/<img[^>]*onerror/i.test(html), "an attribute injected through a heading became a real tag");
      assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/, "the heading was not rendered as text at all");
      assert.match(html, /a &amp; b/);
    });

    it("refuses a javascript: url in an image or a soundtrack", () => {
      assert.equal(safeUrl("javascript:alert(1)"), "");
      assert.equal(safeUrl("JaVaScRiPt:alert(1)"), "");
      assert.equal(safeUrl("data:text/html,<script>"), "");
      assert.equal(safeUrl("//evil.example.com/x.mp3"), "", "a protocol-relative URL points at somebody else's host");
      assert.equal(safeUrl("https://example.com/a.jpg"), "https://example.com/a.jpg");
      assert.equal(safeUrl("frames/0001.jpg"), "frames/0001.jpg");
    });

    // The heart of it. Written the obvious way, 16% of visitors get a blank page.
    it("shows a finished page where the scroll animation is not supported", () => {
      const css = styleSheet(siteWith());
      const guarded = css.slice(css.indexOf("@supports (animation-timeline: view())"));
      assert.ok(guarded.length > 0, "there is no @supports guard, so the animation is not optional");

      // Nothing may hide content outside the guard. `opacity:0` before the
      // @supports block is exactly the blank page this is about.
      const unguarded = css.slice(0, css.indexOf("@supports (animation-timeline: view())"));
      assert.ok(
        !/opacity\s*:\s*0\b/.test(unguarded),
        "content starts invisible outside the @supports guard, so a browser without scroll animations shows a blank page"
      );
      assert.ok(
        !/visibility\s*:\s*hidden/.test(unguarded),
        "content starts hidden outside the @supports guard"
      );
    });

    it("keeps every keyframe that starts invisible inside the guard", () => {
      const css = styleSheet(siteWith());
      const guardIndex = css.indexOf("@supports (animation-timeline: view())");
      for (const name of ["scene-fade", "scene-rise", "scene-zoom"]) {
        assert.ok(css.indexOf(`@keyframes ${name}`) > guardIndex, `${name} is declared outside the @supports guard`);
      }
    });

    it("respects a reader who asked for less motion", () => {
      assert.match(styleSheet(siteWith()), /prefers-reduced-motion: no-preference/,
        "the animation runs for somebody who asked their system for less motion");
    });

    it("gives the page one h1 and everything else an h2", () => {
      const html = renderSite(siteWith());
      assert.equal((html.match(/<h1>/g) || []).length, 1, "a page with no single h1, or several, is one a screen reader cannot navigate");
    });

    it("draws no frame track when there is no footage", () => {
      assert.ok(!renderSite(siteWith()).includes("data-frames"));
    });

    it("draws a frame track, and a first frame for somebody with no JavaScript", () => {
      const html = renderSite(buildSite({
        ...siteFromTemplate("frame-by-frame"),
        frames: { count: 120, pattern: "frames/%d.jpg", width: 1280, height: 720 }
      }));
      assert.match(html, /data-frames="120"/);
      assert.match(html, /<noscript><img src="frames\/0001\.jpg"/,
        "with JavaScript off the footage is an empty sticky box");
    });

    it("numbers frames the way the exporter writes them", () => {
      assert.equal(framePath("frames/%d.jpg", 1), "frames/0001.jpg");
      assert.equal(framePath("frames/%d.jpg", 240), "frames/0240.jpg");
    });

    it("links webfonts for the hosted page and never for the export", () => {
      assert.match(renderSite(siteWith()), /fonts\.googleapis\.com/);
      assert.ok(
        !/fonts\.googleapis\.com/.test(renderSite(siteWith(), { standalone: true })),
        "the downloaded folder quietly needs a font server to be up"
      );
    });
  });

  describe("the folder somebody downloads", () => {
    it("is built by the same renderer as the page they were looking at", () => {
      const site = siteWith();
      const { manifest } = buildExport({ site, runtime: RUNTIME });
      assert.ok(manifest.includes("index.html"));

      // Read out of the archive, not rebuilt here. The first version of this
      // called renderSite() itself and asserted on *that* -- so it was checking
      // a page the test had built, and a probe that broke the exporter left it
      // green. The zip is deflated; the only honest way in is to unpack it.
      const index = unpacked(site).indexHtml;
      for (const section of site.sections) {
        if (!section.heading) continue;
        assert.ok(index.includes(section.heading), `"${section.heading}" is not in the exported page`);
      }
    });

    it("ships the runtime it asks for", () => {
      const { manifest } = buildExport({ site: siteWith(), runtime: RUNTIME });
      assert.ok(manifest.includes("scroll.js"), "index.html loads a script the folder does not contain");
    });

    it("refuses to build without the runtime rather than shipping a 404", () => {
      assert.throws(
        () => buildExport({ site: siteWith(), runtime: "" }),
        /runtime/,
        "an export was produced whose page loads a file that is not there, and it would look nearly right to whoever tested it"
      );
    });

    it("repoints the frames at the folder's own copies", () => {
      const site = buildSite({
        ...siteFromTemplate("frame-by-frame"),
        frames: { count: 3, pattern: "https://cdn.example.com/hosted/%d.jpg", width: 1280, height: 720 }
      });
      const frames = [1, 2, 3].map((index) => ({ index, bytes: Buffer.from(`frame ${index}`) }));
      const { manifest } = buildExport({ site, runtime: RUNTIME, frames });

      assert.ok(manifest.includes("frames/0001.jpg"));
      assert.ok(manifest.includes("frames/0003.jpg"));

      const index = unpacked(site, { frames }).indexHtml;
      assert.ok(
        !index.includes("cdn.example.com"),
        "the exported page still points at the hosted frames, so the folder only works while this application is up"
      );
      assert.match(index, /data-pattern="frames\/%d\.jpg"/,
        "the exported page does not point at the frames sitting beside it in the folder");
    });

    it("turns the frame sequence off rather than shipping a broken one", () => {
      // One frame is not a sequence. Writing `count: 1` into the page would
      // give a canvas that never changes and a track four screens tall.
      const site = buildSite({
        ...siteFromTemplate("frame-by-frame"),
        frames: { count: 40, pattern: "https://cdn.example.com/%d.jpg", width: 800, height: 600 }
      });
      const single = [{ index: 1, bytes: Buffer.from("one") }];
      const { manifest } = buildExport({ site, runtime: RUNTIME, frames: single });
      assert.ok(!manifest.some((name) => name.startsWith("frames/0002")));
      assert.ok(
        !unpacked(site, { frames: single }).indexHtml.includes("data-frames"),
        "a one-frame sequence rendered as a scrubbing track four screens tall"
      );
    });

    it("includes the audio only when it is switched on", () => {
      const off = buildExport({
        site: buildSite({ ...siteFromTemplate("midnight-launch"), audio: { url: "https://x/a.mp3", enabled: false } }),
        runtime: RUNTIME,
        audio: { filename: "track.mp3", bytes: Buffer.from("id3") }
      });
      assert.ok(!off.manifest.some((name) => name.startsWith("audio/")), "a soundtrack nobody enabled was shipped anyway");

      const on = buildExport({
        site: buildSite({ ...siteFromTemplate("midnight-launch"), audio: { url: "https://x/a.mp3", enabled: true } }),
        runtime: RUNTIME,
        audio: { filename: "track.mp3", bytes: Buffer.from("id3") }
      });
      assert.ok(on.manifest.includes("audio/track.mp3"));
    });

    it("writes a README naming what is actually in the folder", () => {
      const { zip } = buildExport({ site: siteWith(), runtime: RUNTIME });
      assert.ok(zip.length > 0);
      const { readme } = require("../lib/sonara-scroll-export.cjs");
      const text = readme(siteWith(), { frameCount: 0, audioIncluded: false });
      assert.ok(!/frames\//.test(text), "the README describes frames the folder does not contain");
      assert.match(text, /no build step/);
      assert.match(text, /Firefox/, "the README does not mention the browser where this looks different");
    });

    it("carries the site's own problems into the README rather than exporting quietly", () => {
      const site = buildSite({
        colours: { background: "#ffffff", text: "#eeeeee" },
        sections: [{ kind: "cover", heading: "Hard to read" }]
      });
      const { readme } = require("../lib/sonara-scroll-export.cjs");
      assert.match(readme(site, { frameCount: 0, audioIncluded: false }), /Noted at the time this was exported/);
    });

    it("names the download from the title, safely", () => {
      assert.equal(exportFilename({ title: "My Cinematic Site" }), "my-cinematic-site.zip");
      assert.equal(exportFilename({ title: "../../etc/passwd" }), "etc-passwd.zip");
      assert.equal(exportFilename({ title: "" }), "scroll-site.zip");
    });
  });

  describe("the address a site is published at", () => {
    it("accepts something somebody would type", () => {
      assert.equal(slugify("My Cinematic Site"), "my-cinematic-site");
      assert.equal(slugify("  Spaces  and---dashes "), "spaces-and-dashes");
    });

    it("returns nothing rather than inventing an address", () => {
      // A generated slug publishes a site at an address its author never chose
      // and cannot guess.
      assert.equal(slugify(""), null);
      assert.equal(slugify("!!!"), null);
      assert.equal(slugify("a"), null, "a one-character address is too easy to collide with");
    });

    it("cannot escape its own path segment", () => {
      assert.equal(slugify("../admin"), "admin");
      assert.equal(slugify("a/b"), "a-b");
    });
  });

  describe("the motion vocabulary", () => {
    it("has a rule for every motion the editor offers", () => {
      const css = styleSheet(siteWith());
      for (const motion of MOTIONS) {
        if (motion === "hold") continue; // deliberately no animation; see the stylesheet
        assert.ok(
          css.includes(`[data-motion="${motion}"]`),
          `"${motion}" is offered in the editor and has no rule, so it renders as no motion at all`
        );
      }
    });

    it("has a renderable section kind for every kind the model accepts", () => {
      // A kind that saves and draws as nothing is the defect this pairing is
      // written to prevent.
      for (const kind of SECTION_KINDS) {
        const html = renderSite(buildSite({ sections: [{ kind, heading: `A ${kind}` }] }));
        assert.ok(html.includes(`scene--${kind}`), `"${kind}" has no class, so it renders unstyled`);
        assert.ok(html.includes(`A ${kind}`), `"${kind}" rendered without its heading`);
      }
    });
  });
});

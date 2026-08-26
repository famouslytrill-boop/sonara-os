"use strict";

// The templates somebody starts from.
//
// Each one is a complete site: a palette, a typeface pairing, and sections with
// real words in them. Not placeholders -- `Lorem ipsum` in a template is a
// template nobody can judge, because the whole question a person is asking
// while they browse these is "what will mine look like".
//
// The words are deliberately about a made-up subject rather than a plausible
// real business. A template that reads like a genuine company's site is a
// template somebody publishes without changing, and then there is a page on the
// internet making claims about a business that does not exist.
//
// ## Every template is checked, not just written
//
// `tests/a-scroll-site-is-readable.test.js` runs every template through
// `buildSite` and asserts it comes back with **no problems** -- so a template
// whose palette fails contrast, or that has an empty section, fails the build
// rather than being offered to a customer as a starting point. A starting point
// that starts with a warning on it is worse than one fewer template.

const COMMON_FONTS = Object.freeze({
  editorial: { display: "\"Playfair Display\", Georgia, serif", body: "\"Source Sans 3\", system-ui, sans-serif" },
  grotesk: { display: "\"Space Grotesk\", system-ui, sans-serif", body: "\"Inter\", system-ui, sans-serif" },
  mono: { display: "\"JetBrains Mono\", ui-monospace, monospace", body: "\"Inter\", system-ui, sans-serif" },
  humanist: { display: "\"Fraunces\", Georgia, serif", body: "\"Public Sans\", system-ui, sans-serif" }
});

const TEMPLATES = Object.freeze([
  Object.freeze({
    key: "midnight-launch",
    name: "Midnight launch",
    what: "A dark product reveal. Big type, one idea per screen, an accent that only appears where you want somebody to look.",
    bestFor: "Launching one thing.",
    fontSet: "grotesk",
    colours: Object.freeze({
      background: "#0b0d12", text: "#f2f4f8", accent: "#7cc4ff",
      muted: "#a8b0be", surface: "#161b25", surfaceText: "#f2f4f8"
    }),
    sections: Object.freeze([
      Object.freeze({ id: "s1", kind: "cover", motion: "zoom", eyebrow: "Arriving in spring", heading: "The quiet one.", body: "Nothing new to learn. Nothing to configure. It is simply already doing it." }),
      Object.freeze({ id: "s2", kind: "statement", motion: "rise", eyebrow: "The idea", heading: "You should not have to think about this at all.", body: "Every version of this before now asked you to make a decision first. That is the part we removed." }),
      Object.freeze({ id: "s3", kind: "detail", motion: "fade", eyebrow: "How it works", heading: "It watches, and then it stops asking.", body: "The first week it learns what you actually do.\n\nAfter that it does the same thing without being told, and tells you what it did rather than asking whether it should." }),
      Object.freeze({ id: "s4", kind: "quote", motion: "fade", eyebrow: "From an early group", heading: "“I forgot it was running, which I think is the review.”", body: "An early tester, three weeks in." }),
      Object.freeze({ id: "s5", kind: "close", motion: "rise", eyebrow: "Spring", heading: "Be there when it opens.", body: "No launch email chain. One message, on the day, and nothing else." })
    ])
  }),

  Object.freeze({
    key: "paper-and-ink",
    name: "Paper and ink",
    what: "Light, editorial and quiet. Serif display type on warm white, with plenty of room between ideas.",
    bestFor: "Writing that wants to be read slowly.",
    fontSet: "editorial",
    colours: Object.freeze({
      background: "#faf7f2", text: "#1c1a17", accent: "#8c4a2f",
      muted: "#5c564d", surface: "#f0ebe2", surfaceText: "#1c1a17"
    }),
    sections: Object.freeze([
      Object.freeze({ id: "s1", kind: "cover", motion: "fade", eyebrow: "An essay", heading: "The long way round", body: "On why the slower route is usually the one that arrives." }),
      Object.freeze({ id: "s2", kind: "statement", motion: "rise", eyebrow: "One", heading: "Speed is a way of avoiding the question.", body: "It feels like progress because something is moving. Whether it is moving towards anything is a separate matter, and a harder one to look at." }),
      Object.freeze({ id: "s3", kind: "detail", motion: "fade", eyebrow: "Two", heading: "What the detour is actually for", body: "You are not going around the obstacle. You are going around your first idea about the obstacle, which is usually the thing in the way." }),
      Object.freeze({ id: "s4", kind: "gallery", motion: "hold", eyebrow: "Three", heading: "Notes from the margin", body: "The things that did not fit anywhere and turned out to matter most." }),
      Object.freeze({ id: "s5", kind: "close", motion: "fade", eyebrow: "End", heading: "Thank you for reading to here.", body: "There is a version of this with footnotes. Ask and it is yours." })
    ])
  }),

  Object.freeze({
    key: "gallery-wall",
    name: "Gallery wall",
    what: "Built around pictures. The words step back and let each image hold the screen on its own.",
    bestFor: "Photography, a portfolio, a look book.",
    fontSet: "mono",
    colours: Object.freeze({
      background: "#111111", text: "#f5f5f5", accent: "#d8ff5e",
      muted: "#a5a5a5", surface: "#1c1c1c", surfaceText: "#f5f5f5"
    }),
    sections: Object.freeze([
      Object.freeze({ id: "s1", kind: "cover", motion: "hold", eyebrow: "Selected work", heading: "Nine rooms", body: "Photographed over two winters, in places that were empty for a reason." }),
      Object.freeze({ id: "s2", kind: "gallery", motion: "fade", eyebrow: "01", heading: "The reading room", body: "Late afternoon, before the lights came on." }),
      Object.freeze({ id: "s3", kind: "gallery", motion: "fade", eyebrow: "02", heading: "The corridor", body: "Nobody walked through it while I was there." }),
      Object.freeze({ id: "s4", kind: "statement", motion: "rise", eyebrow: "On the work", heading: "Empty is not the same as abandoned.", body: "Every one of these rooms is still in use. I simply waited until it was not." }),
      Object.freeze({ id: "s5", kind: "close", motion: "fade", eyebrow: "Prints", heading: "Available in two sizes.", body: "Editions of thirty. Get in touch and I will send the list." })
    ])
  }),

  Object.freeze({
    key: "field-notes",
    name: "Field notes",
    what: "Warm and plain, closer to a letter than a landing page. Good when the writing matters more than the design.",
    bestFor: "A personal update, a project log, a change of direction.",
    fontSet: "humanist",
    colours: Object.freeze({
      background: "#f4f1ea", text: "#23201b", accent: "#3f6b4f",
      muted: "#57524a", surface: "#e8e3d8", surfaceText: "#23201b"
    }),
    sections: Object.freeze([
      Object.freeze({ id: "s1", kind: "cover", motion: "rise", eyebrow: "Year two", heading: "What changed, and what did not", body: "A short account of the last twelve months, written mostly for the people who asked." }),
      Object.freeze({ id: "s2", kind: "statement", motion: "fade", eyebrow: "The short version", heading: "It works now. It did not last year.", body: "The difference was not effort. It was giving up on the part that was never going to work and admitting it out loud." }),
      Object.freeze({ id: "s3", kind: "detail", motion: "rise", eyebrow: "In detail", heading: "Three things worth writing down", body: "The first was obvious in hindsight and invisible at the time.\n\nThe second cost a season.\n\nThe third is the only one I would tell somebody starting out." }),
      Object.freeze({ id: "s4", kind: "close", motion: "fade", eyebrow: "Next", heading: "Same again, slower.", body: "If you want the monthly note, reply to this and say so." })
    ])
  }),

  Object.freeze({
    key: "frame-by-frame",
    name: "Frame by frame",
    what: "Built for a video you bring. The footage scrubs as you scroll, and the words sit over it.",
    bestFor: "A product turning, a place walked through, anything that moves.",
    fontSet: "grotesk",
    // Deliberately high contrast: text sits over frames whose brightness nobody
    // can predict, so the palette assumes the worst rather than the average.
    colours: Object.freeze({
      background: "#000000", text: "#ffffff", accent: "#ff7a45",
      muted: "#c9c9c9", surface: "#0f0f0f", surfaceText: "#ffffff"
    }),
    sections: Object.freeze([
      Object.freeze({ id: "s1", kind: "cover", motion: "hold", eyebrow: "Scroll to move", heading: "Every angle, in order.", body: "The footage follows your scroll. Stop anywhere and it stops with you." }),
      Object.freeze({ id: "s2", kind: "statement", motion: "fade", eyebrow: "Why", heading: "A video plays at you. This one waits.", body: "Nobody watches a thirty second clip to the end. Everybody scrolls." }),
      Object.freeze({ id: "s3", kind: "detail", motion: "rise", eyebrow: "What you need", heading: "One clip, a few seconds long.", body: "Bring it in and the frames are pulled out on your own machine. Shorter is better: five seconds is plenty." }),
      Object.freeze({ id: "s4", kind: "close", motion: "fade", eyebrow: "Yours", heading: "Put your own footage in.", body: "Replace these words, drop your clip in, and the whole thing is yours." })
    ])
  })
]);

function templateByKey(key) {
  return TEMPLATES.find((template) => template.key === String(key || "")) || null;
}

/**
 * The document a new site starts from.
 *
 * Deep-copied out of the frozen template, because the caller is about to hand
 * this to a form and a save. Returning the frozen original would either throw
 * on the first edit or -- worse, with a shallow copy -- let one customer's edit
 * reach into the template every later customer starts from.
 */
function siteFromTemplate(key, { title = "" } = {}) {
  const template = templateByKey(key);
  if (!template) return null;
  return {
    title: String(title || template.name),
    template: template.key,
    fontSet: template.fontSet,
    colours: { ...template.colours },
    sections: template.sections.map((section) => ({ ...section })),
    audio: { url: "", enabled: false, label: "Soundtrack" },
    frames: { count: 0, pattern: "", width: 0, height: 0 }
  };
}

module.exports = { TEMPLATES, COMMON_FONTS, templateByKey, siteFromTemplate };

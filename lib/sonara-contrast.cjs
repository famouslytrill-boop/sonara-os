"use strict";

// Whether two colours can be read against each other.
//
// This was inside `scripts/verify-colour-contrast.mjs`, which is the release
// check over the design system's own tokens. It moved here when a second caller
// appeared: a customer building a scroll site picks their own colours, and a
// pale grey on white publishes as an unreadable page with nothing to say so.
//
// It lives in `lib/` rather than `scripts/` for a reason that is easy to miss --
// `vercel.json` bundles `{public/**,routes/**,lib/**}`, so a module a route
// needs cannot sit in `scripts/`. It would work in every test on this machine
// and be absent in production.
//
// One implementation, two callers, so the release check and the customer-facing
// warning cannot disagree about what 4.5 to 1 means.

// #abc and #aabbcc, to three channels. Returns null rather than a guess: a
// colour this cannot read is not a colour whose contrast is known, and
// answering with black would produce a ratio somebody might act on.
function toRgb(hex) {
  const raw = String(hex).replace("#", "").trim();
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw.slice(0, 6);
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

// The 0.03928 threshold and the 2.4 exponent are the sRGB transfer function as
// WCAG 2.1 states it. Copied from the specification rather than approximated,
// because an eyeballed gamma curve produces ratios that look plausible and are
// wrong by enough to pass a failing pair.
function relativeLuminance(rgb) {
  const [r, g, b] = rgb.map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * The WCAG contrast ratio between two colours, or null if either is unreadable.
 *
 * Null is the important return. A caller that treats "could not parse" as a
 * ratio of zero reports every unparseable colour as a contrast failure, and a
 * caller that treats it as 21 reports every one as fine. Both are worse than
 * the caller knowing it does not know.
 */
function contrastRatio(foreground, background) {
  const a = toRgb(foreground);
  const b = toRgb(background);
  if (!a || !b) return null;
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  const [lighter, darker] = first > second ? [first, second] : [second, first];
  return (lighter + 0.05) / (darker + 0.05);
}

// WCAG's own thresholds, named rather than spelled as numbers at call sites.
// Large text is 18.66px bold or 24px regular and above.
const MINIMUM = Object.freeze({
  bodyText: 4.5,
  largeText: 3,
  nonText: 3
});

module.exports = { contrastRatio, relativeLuminance, toRgb, MINIMUM };

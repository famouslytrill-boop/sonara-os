"use strict";

// The logos and the palette have to be the same colours.
//
// They were not, and had never been. public/sonara-design-system.css declared
// --sonara-build: #5ec8a8, a mint green, while business-builder-mark-v3.svg was
// a blue-to-cyan gradient of #2563EB and #06B6D4. Creator Studio's token was a
// lilac and its mark ran blue through violet to pink. Growth Studio's token was
// amber and its mark was teal through green to lime. Every product mark
// disagreed with the colour the product is named by everywhere else in the
// interface.
//
// Nothing caught it because the two live in different formats. The stylesheet
// says a design token is declared in exactly one place -- and it is, for CSS.
// An SVG served as <img src> gets no CSS custom properties from the page that
// embeds it, so the hex has to be written into the file, and a hex written into
// a file is a copy. This checks the copies.
//
// What it does not check is whether the palette is any good. That is a judgement
// somebody makes on a screen. This only refuses the state where the mark and the
// interface around it are different colours.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const brandDirectory = path.join(root, "public", "brand");
const stylesheet = fs.readFileSync(path.join(root, "public", "sonara-design-system.css"), "utf8");

// Every hex the design system declares, from the :root block only -- the light
// overrides are the same roles in different values and a mark is not repainted
// per theme.
function paletteHexes() {
  const rootBlock = stylesheet.split(/@media|:root\[data-theme/)[0];
  const hexes = new Set();
  for (const match of rootBlock.matchAll(/--sonara-[a-z0-9-]+:\s*(#[0-9A-Fa-f]{6})\b/g)) {
    hexes.add(match[1].toUpperCase());
  }
  return hexes;
}

function brandFiles() {
  const found = [];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".svg")) found.push(full);
    }
  };
  if (fs.existsSync(brandDirectory)) walk(brandDirectory);
  return found;
}

describe("brand marks and the design system agree", () => {
  const palette = paletteHexes();
  const files = brandFiles();

  it("reads a palette and some marks", () => {
    // Both halves of every check below are satisfied by an empty set.
    assert.ok(palette.size >= 10, `expected the design system to declare a palette; found ${palette.size} colours`);
    assert.ok(files.length >= 10, `expected brand marks to check; found ${files.length}`);
  });

  it("draws every gradient stop from the palette", () => {
    const strays = [];
    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      for (const match of source.matchAll(/stop-color="(#[0-9A-Fa-f]{6})"/g)) {
        const hex = match[1].toUpperCase();
        if (!palette.has(hex)) strays.push(`${path.basename(file)}: ${match[1]}`);
      }
    }
    assert.deepEqual(
      [...new Set(strays)],
      [],
      "these gradient stops are colours the design system does not declare, so the mark and the interface around it will drift apart"
    );
  });

  it("finds gradient stops to check", () => {
    // If the marks stop using gradients the check above passes over nothing.
    let stops = 0;
    for (const file of files) {
      stops += (fs.readFileSync(file, "utf8").match(/stop-color="#[0-9A-Fa-f]{6}"/g) || []).length;
    }
    assert.ok(stops > 20, `expected the marks to still carry gradient stops; found ${stops}`);
  });

  it("keeps the browser chrome the same colour as the page", () => {
    // theme-color paints the mobile address bar. It was #FAF8F4, a warm
    // off-white, while the light surface is #F6F7FC, a cool one -- and #0C1122
    // against a #04050B dark page. Neither was wrong enough to look broken and
    // both showed as a seam above the page on a phone.
    const engine = fs.readFileSync(path.join(root, "public", "sonara-interface-engine.js"), "utf8");
    const frame = fs.readFileSync(path.join(root, "lib", "sonara-page-frame.cjs"), "utf8");

    const darkBackground = stylesheet.match(/:root\s*\{[\s\S]*?--sonara-bg:\s*(#[0-9A-Fa-f]{6})/)?.[1];
    const lightBackground = stylesheet.match(/:root\[data-theme="light"\][\s\S]*?--sonara-bg:\s*(#[0-9A-Fa-f]{6})/)?.[1];
    assert.ok(darkBackground && lightBackground, "could not read both background tokens; this check has gone blind");

    assert.ok(
      engine.includes(lightBackground) && engine.includes(darkBackground),
      `sonara-interface-engine.js must set theme-color to ${lightBackground} in light and ${darkBackground} in dark`
    );
    assert.ok(
      frame.includes(darkBackground),
      `the page frame must render theme-color as ${darkBackground}, matching the dark background it serves`
    );
  });

  it("gives each product mark its own product colour", () => {
    // The point of a per-product colour is that the three products look
    // different from each other. A rebrand that paints them all the signature
    // violet is tidier and tells a customer nothing about which workspace they
    // are in.
    const expectations = [
      ["business-builder-mark-v3.svg", "--sonara-build"],
      ["creator-studio-mark-v3.svg", "--sonara-create"],
      ["growth-studio-mark-v3.svg", "--sonara-grow"]
    ];
    for (const [fileName, token] of expectations) {
      const file = files.find((candidate) => path.basename(candidate) === fileName);
      assert.ok(file, `${fileName} is missing`);
      const expected = stylesheet.match(new RegExp(`${token}:\\s*(#[0-9A-Fa-f]{6})`))?.[1]?.toUpperCase();
      assert.ok(expected, `${token} is not declared in the design system`);
      const source = fs.readFileSync(file, "utf8").toUpperCase();
      assert.ok(
        source.includes(expected),
        `${fileName} does not use ${token} (${expected}), so the mark and the workspace it stands for are different colours`
      );
    }
  });
});

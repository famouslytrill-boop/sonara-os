"use strict";

// A page must not tell anyone else that you opened it.
//
// Every page used to load fonts from fonts.googleapis.com and
// fonts.gstatic.com. That is a request to Google, carrying the visitor's IP
// address and user-agent, on public marketing pages, before sign-in and before
// any consent interaction. It was the only third party in the document and the
// only external request it made -- and no legal page mentioned Google at all
// until docs/legal/COUNSEL_REVIEW_BRIEF.md recorded it as finding F-1.
//
// Disclosing it was the interim step; removing it is the fix. The fonts are
// served from this origin now, so there is nothing to disclose and nothing to
// obtain consent for.
//
// This renders the real pages and looks at what the document would actually
// fetch, because that is the only version of the question that matters. A
// stylesheet, a preconnect, a script, an image, or an iframe pointing anywhere
// but this origin all fail here.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const request = require("supertest");
const app = require("../server");

const root = path.join(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

// Pages a visitor can reach without signing in -- the ones where a third-party
// request happens before the person has agreed to anything.
const PUBLIC_PAGES = ["/", "/about", "/pricing", "/security", "/contact", "/products", "/free-tools", "/service-catalog", "/legal/privacy", "/business-builder", "/login", "/signup"];

// Hosts that are ours. Everything else is a third party by definition.
const OWN_HOSTS = /^(?:www\.)?sonaraindustries\.com$/i;

// Attributes that cause the browser to make a request on its own.
const FETCHING_ATTRIBUTES = /\b(?:src|href|action|poster|data-src|srcset)\s*=\s*["']([^"']+)["']/gi;

// Strip comments before looking for a host name. The first version of these
// checks failed on the comments explaining why the hosts were removed -- the
// prose named fonts.googleapis.com, cyrillic, and Source Serif, and the checks
// read it as the code doing so. A check that cannot tell an explanation from an
// implementation is a check that has to be switched off.
function withoutComments(source) {
  return source
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/[^\n]*$/gm, " ");
}

function externalHosts(html) {
  const found = new Set();
  for (const match of String(html).matchAll(FETCHING_ATTRIBUTES)) {
    const value = match[1].trim();
    if (!/^https?:\/\//i.test(value)) continue; // relative, anchor, mailto, data:
    let host;
    try {
      host = new URL(value).host;
    } catch {
      continue;
    }
    if (!OWN_HOSTS.test(host)) found.add(host);
  }
  return [...found];
}

describe("pages make no third-party requests", () => {
  it("checks enough pages for this to mean something", () => {
    assert.ok(PUBLIC_PAGES.length >= 10);
  });

  for (const route of PUBLIC_PAGES) {
    it(`${route} fetches from this origin only`, async function renderPage() {
      this.timeout(20000);
      const response = await request(app).get(route).set("accept", "text/html");
      assert.equal(response.status, 200, `${route} returned ${response.status}`);
      const hosts = externalHosts(response.text);
      assert.deepEqual(
        hosts,
        [],
        `${route} makes the visitor's browser contact:\n  ${hosts.join("\n  ")}\n\n` +
          "A page load must not tell a third party that somebody opened it. If an asset is genuinely needed, serve it from this origin."
      );
    });
  }

  it("names no font CDN in the page frame", () => {
    // Belt and braces: the render check above would catch a link tag, but a
    // preconnect or dns-prefetch carries no fetching attribute value worth
    // resolving and is still a request.
    const frame = withoutComments(read("lib/sonara-page-frame.cjs"));
    for (const host of ["fonts.googleapis.com", "fonts.gstatic.com", "cdn.jsdelivr.net", "unpkg.com", "cdnjs.cloudflare.com"]) {
      assert.ok(!frame.includes(host), `the page frame still references ${host}`);
    }
    assert.doesNotMatch(frame, /rel="(?:preconnect|dns-prefetch)"[^>]*https:\/\//, "the frame preconnects to an external host");
  });
});

describe("the self-hosted fonts are actually there", () => {
  const stylesheet = read("public/sonara-fonts.css");
  const rules = withoutComments(stylesheet);

  it("serves every file the stylesheet asks for", async function serveFonts() {
    this.timeout(20000);
    const referenced = [...stylesheet.matchAll(/url\('([^']+)'\)/g)].map((match) => match[1]);
    assert.ok(referenced.length >= 4, `only ${referenced.length} font files referenced; this check has gone blind`);
    for (const file of [...new Set(referenced)]) {
      assert.ok(file.startsWith("/fonts/"), `${file} is not served from this origin`);
      const response = await request(app).get(file);
      assert.equal(response.status, 200, `${file} is referenced but not served`);
      assert.match(response.headers["content-type"] || "", /font\/woff2/);
    }
  });

  it("ships the licence the font requires", () => {
    // Geist and Geist Mono are OFL 1.1, which requires the licence to travel
    // with the files.
    const licence = read("public/fonts/OFL.txt");
    assert.match(licence, /SIL OPEN FONT LICENSE/i);
    assert.match(licence, /Vercel/i);
  });

  it("keeps the subsets it needs and none it does not", () => {
    // The interface offers English, Spanish, French, German and Portuguese.
    // latin and latin-ext cover all five; cyrillic, greek and vietnamese would
    // be weight nobody on this product renders.
    assert.match(rules, /latin-ext/);
    for (const unused of ["cyrillic", "greek", "vietnamese"]) {
      assert.ok(!rules.includes(unused), `the ${unused} subset is shipped but no interface language needs it`);
    }
  });

  it("does not ship a family nothing renders with", () => {
    // Source Serif 4 was loaded on every page and used by no rule and no
    // markup. If a serif is wanted later, the token resolves to the system
    // stack until something actually uses it.
    const styles = read("public/sonara-design-system.css");
    assert.ok(!rules.includes("Source Serif"), "Source Serif is shipped again; check something actually uses it");
    assert.match(styles, /--sonara-font-serif: ui-serif/);
  });

  it("caches the fonts in the service worker", () => {
    const worker = read("public/sw.js");
    assert.match(worker, /\/sonara-fonts\.css\?v=/);
    assert.match(worker, /\/fonts\/geist-latin\.woff2\?v=/);
    assert.match(worker, /woff2\)\$\//, "the static pattern does not match font files, so they are never cached");
  });
});

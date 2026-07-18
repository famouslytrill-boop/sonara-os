const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const request = require("supertest");
const app = require("../server");

function executeExperience(pathname, { secure = true, hostname = "sonaraindustries.com" } = {}) {
  const source = fs.readFileSync(path.join(__dirname, "..", "public", "sonara-experience.js"), "utf8");
  let registrations = 0;
  const registration = {
    installing: null,
    waiting: null,
    update: () => Promise.resolve(),
    addEventListener: () => undefined
  };
  const window = {
    isSecureContext: secure,
    location: { pathname, search: "", hostname },
    matchMedia: () => ({ matches: true }),
    requestIdleCallback: (callback) => callback(),
    addEventListener: (event, callback) => {
      if (event === "load") callback();
    },
    setTimeout: (callback) => callback()
  };
  const context = {
    URLSearchParams,
    window,
    navigator: {
      serviceWorker: {
        controller: null,
        register: () => {
          registrations += 1;
          return Promise.resolve(registration);
        }
      }
    },
    document: {
      body: { appendChild: () => undefined },
      createElement: () => ({
        className: "",
        style: {},
        setAttribute: () => undefined,
        remove: () => undefined
      }),
      documentElement: { classList: { add: () => undefined } },
      querySelectorAll: () => []
    },
    history: { replaceState: () => undefined }
  };

  vm.runInNewContext(source, context);
  return registrations;
}

describe("canonical PWA contract", () => {
  it("serves one canonical install manifest and redirects the legacy path", async function() {
    const canonical = await request(app).get("/site.webmanifest");
    assert.equal(canonical.status, 200);
    const manifest = JSON.parse(canonical.text);
    assert.equal(manifest.name, "SONARA Industries");
    assert.equal(manifest.id, "/");
    assert.equal(manifest.start_url, "/");
    assert.equal(manifest.scope, "/");
    assert.equal(manifest.display, "standalone");
    assert.equal(manifest.prefer_related_applications, false);
    assert.ok(manifest.icons.length >= 3);

    for (const icon of manifest.icons) {
      const iconResponse = await request(app).get(icon.src);
      assert.equal(iconResponse.status, 200, `${icon.src} should exist`);
    }

    const legacy = await request(app).get("/manifest.webmanifest");
    assert.equal(legacy.status, 308);
    assert.equal(legacy.headers.location, "/site.webmanifest");
  });

  it("links the canonical manifest from rendered pages", async function() {
    const res = await request(app).get("/").set("Accept", "text/html");
    assert.equal(res.status, 200);
    assert.match(res.text, /<link rel="manifest" href="\/site\.webmanifest">/);
  });

  it("registers the service worker from public pages but not private application routes", function() {
    assert.equal(executeExperience("/"), 1);
    assert.equal(executeExperience("/pricing"), 1);
    assert.equal(executeExperience("/legal/privacy"), 1);
    assert.equal(executeExperience("/dashboard"), 0);
    assert.equal(executeExperience("/admin"), 0);
    assert.equal(executeExperience("/account"), 0);
  });

  it("requires a secure context outside local development", function() {
    assert.equal(executeExperience("/", { secure: false }), 0);
    assert.equal(executeExperience("/", { secure: false, hostname: "localhost" }), 1);
  });

  it("keeps authenticated navigation outside the service-worker response path", function() {
    const worker = fs.readFileSync(path.join(__dirname, "..", "public", "sw.js"), "utf8");
    assert.match(worker, /sonara-public-/);
    assert.match(worker, /PUBLIC_NAVIGATION_PATHS/);
    assert.match(worker, /if \(!isPublicNavigation\(url\.pathname\)\) return;/);
    assert.match(worker, /cache: "no-store"/);
    assert.match(worker, /private\|no-store/);
    assert.match(worker, /set-cookie/);
    assert.match(worker, /url\.pathname === "\/sw\.js"/);
    assert.match(worker, /keys\.filter|\.filter\(\(key\) => key\.startsWith\(CACHE_PREFIX\)/);
  });
});

"use strict";

// A link a customer can click should go to a page, not to raw JSON.
//
// Fourteen action links on customer-facing screens pointed at /api/ endpoints,
// two of them labelled "...JSON" outright. Clicking one gave a wall of JSON --
// the same failure the plain-language work removed from /account when it was
// offering a "Readiness JSON" link.
//
// Five now point at real pages. The rest are left deliberately and this test
// records why, so the next person does not "finish the job" by deleting them:
//
//   /api/growth/metrics          /growth-studio/analytics is behind a paid plan
//   /api/growth/provider-jobs    /growth-studio/provider-jobs redirects
//
// /api/creator/generation/jobs was the third, kept because removing the link
// would have taken away the only access to the data -- the hollow-page problem
// in reverse. That exception is gone now that /creator-studio/generation/jobs
// renders the work itself.
//
// The prompt-library links were on this list until the workspace prompt pages
// started rendering saved templates and collections themselves. The final test
// below is what forced that cleanup: an exception with no live link behind it is
// stale, and a list of stale exceptions slowly becomes permission to link
// anywhere.

const assert = require("node:assert/strict");
const request = require("supertest");
const plainLanguage = require("../lib/sonara-plain-language.cjs");

const app = require("../server");

// Known-good exceptions, each with the reason it cannot point at a page yet.
const ALLOWED_API_LINKS = new Map([
  ["/api/growth/metrics", "the analytics page is behind a paid plan"],
  ["/api/growth/provider-jobs", "the provider-jobs page redirects"]
]);

// One row, shaped to satisfy whichever renderer receives it. Renderers read
// different fields, so this carries the common ones rather than a per-table
// fixture: the check only needs a row to exist so row-level markup renders.
function sampleRow() {
  return {
    id: "00000000-0000-0000-0000-0000000000aa",
    organization_id: "00000000-0000-0000-0000-0000000000bb",
    user_id: "00000000-0000-0000-0000-000000000001",
    job_id: "00000000-0000-0000-0000-0000000000aa",
    title: "Sample",
    name: "Sample",
    label: "Sample",
    slug: "sample",
    status: "completed",
    state: "active",
    capability: "text_to_music",
    provider_key: "sonara",
    media_type: "audio",
    asset_role: "output",
    bucket_id: "creator-assets",
    object_path: "org/user/job/file.mp3",
    byte_size: 2048,
    progress_percent: 100,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z"
  };
}

function customerPages() {
  return app._router.stack
    .filter((layer) => layer.route && layer.route.methods.get)
    .map((layer) => layer.route.path)
    .filter((path) => !path.includes(":") && !path.startsWith("/api") && !plainLanguage.isTechnicalRoute(path));
}

describe("customer links point at pages, not JSON", () => {
  let found;
  let renderedCount;
  let restore;

  before(async function scanEveryPage() {
    this.timeout(90000);
    const saved = {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
    };
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    const originalFetch = global.fetch;
    // Returning [] for every read made this scan blind to the links that only
    // exist once there is data: a table renders no rows, so a row linking to
    // raw JSON is invisible to the check. The generation job table linked every
    // row at /api/creator/generation/jobs/<id> for exactly as long as this mock
    // returned nothing. One representative row is enough to make those render.
    global.fetch = async (url) =>
      String(url).includes("/auth/v1/user")
        ? { ok: true, json: async () => ({ id: "00000000-0000-0000-0000-000000000001" }) }
        : { ok: true, headers: { get: () => null }, json: async () => [sampleRow()] };

    found = [];
    renderedCount = 0;
    for (const page of customerPages()) {
      const response = await request(app).get(page).set("accept", "text/html").set({ Authorization: "Bearer session" });
      if (response.status !== 200 || !/html/.test(response.headers["content-type"] || "")) continue;
      renderedCount += 1;
      for (const match of String(response.text).matchAll(/<a[^>]+href="(\/api\/[^"?]*)[^"]*"[^>]*>([^<]*)<\/a>/g)) {
        found.push({ page, href: match[1], label: match[2] });
      }
    }

    restore = () => {
      global.fetch = originalFetch;
      for (const [key, value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    };
  });

  after(() => restore && restore());

  it("renders enough pages for the check to mean something", () => {
    assert.ok(renderedCount >= 100, `only ${renderedCount} pages rendered; the scan is not covering the app`);
  });

  it("links to no API endpoint that has a page instead", () => {
    const offenders = found
      .filter((link) => !ALLOWED_API_LINKS.has(link.href))
      .map((link) => `${link.page} -> ${link.href} ("${link.label}")`);
    assert.deepEqual(
      offenders,
      [],
      `These customer pages send somebody to raw JSON:\n  ${offenders.join("\n  ")}\n\n` +
        "Point the link at the page that shows this data. If there is genuinely no such page, add it to ALLOWED_API_LINKS with the reason."
    );
  });

  it("never says JSON to a customer", () => {
    // "Readiness JSON", "Support status JSON", "My collections JSON" -- the
    // label is the tell that a link goes somewhere a customer should not be
    // sent.
    const shouting = found.filter((link) => /json/i.test(link.label)).map((link) => `${link.page}: "${link.label}"`);
    assert.deepEqual(shouting, [], `These labels name a data format at a customer:\n  ${shouting.join("\n  ")}`);
  });

  it("keeps every exception honest about why it is one", () => {
    // An exception with no live link behind it is stale and should be removed,
    // otherwise this list slowly becomes permission to link anywhere.
    const linked = new Set(found.map((link) => link.href));
    const stale = [...ALLOWED_API_LINKS.keys()].filter((href) => !linked.has(href));
    assert.deepEqual(stale, [], `These exceptions are no longer used and should be deleted:\n  ${stale.join("\n  ")}`);
  });
});

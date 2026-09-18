"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const RUNTIME_PATHS = [
  "server.js",
  "lib",
  "routes"
];

const RETIRED = [
  "starter_monthly",
  "core_monthly",
  "pro_monthly",
  "STRIPE_PRICE_STARTER_MONTHLY",
  "STRIPE_PRICE_CORE_MONTHLY",
  "STRIPE_PRICE_PRO_MONTHLY",
  "STRIPE_PRICE_ID_BUSINESS_BUILDER_MONTHLY",
  "STRIPE_PRICE_ID_CREATOR_STUDIO_MONTHLY",
  "STRIPE_PRICE_ID_GROWTH_STUDIO_MONTHLY",
  "STRIPE_PRICE_BUSINESS_BUILDER_STARTER_MONTHLY",
  "STRIPE_PRICE_BUSINESS_BUILDER_CORE_MONTHLY",
  "STRIPE_PRICE_BUSINESS_BUILDER_PRO_MONTHLY",
  "STRIPE_PRICE_CREATOR_STUDIO_CORE_MONTHLY",
  "STRIPE_PRICE_CREATOR_STUDIO_PRO_MONTHLY",
  "STRIPE_PRICE_GROWTH_STUDIO_CORE_MONTHLY",
  "STRIPE_PRICE_GROWTH_STUDIO_PRO_MONTHLY",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REDIRECT_URI"
];

function runtimeFiles(entry) {
  const absolute = path.join(ROOT, entry);
  const stat = fs.statSync(absolute);
  if (stat.isFile()) return [absolute];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((item) => {
    const relative = path.join(entry, item.name);
    if (item.isDirectory()) return runtimeFiles(relative);
    return /\.(?:c?js|mjs)$/.test(item.name) ? [path.join(ROOT, relative)] : [];
  });
}

describe("retired commercial and Google compatibility is absent from runtime", () => {
  const files = RUNTIME_PATHS.flatMap(runtimeFiles);
  assert.ok(files.length > 40, `only ${files.length} runtime files found; legacy scan has gone blind`);

  for (const retired of RETIRED) {
    it(`does not recognize retired identifier ${retired}`, () => {
      const hits = files
        .filter((file) => fs.readFileSync(file, "utf8").includes(retired))
        .map((file) => path.relative(ROOT, file));
      assert.deepEqual(hits, [], `${retired} is still recognized by executable runtime: ${hits.join(", ")}`);
    });
  }

  it("has no deferred Google OAuth runtime state", () => {
    const offenders = files.filter((file) => {
      const source = fs.readFileSync(file, "utf8");
      return /google(?:OAuth|SignIn)[\s\S]{0,80}deferred|Google OAuth is deferred|OAuth deferred/i.test(source);
    }).map((file) => path.relative(ROOT, file));
    assert.deepEqual(offenders, [], `Google OAuth is still deferred in runtime: ${offenders.join(", ")}`);
  });
});

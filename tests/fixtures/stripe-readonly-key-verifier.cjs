// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.

"use strict";

const path = require("node:path");
const { pathToFileURL } = require("node:url");

globalThis.fetch = async (url, init) => {
  if (!String(url).startsWith("https://api.stripe.com/v1/prices/")) {
    throw new Error("unexpected provider URL");
  }
  if (init?.headers?.authorization !== "Bearer rk_live_notarealkey") {
    throw new Error("restricted key was not forwarded");
  }
  return new Response(JSON.stringify({ error: { message: "Rejected test credential" } }), { status: 401 });
};

const entry = pathToFileURL(path.join(__dirname, "..", "..", "scripts", "verify-stripe-env.mjs")).href;
import(entry).catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});

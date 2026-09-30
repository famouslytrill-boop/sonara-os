#!/usr/bin/env node
// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// An /api path a library declares, and the running application does not serve.
//
// This is the third instance of one shape in this repository. The fourteen
// Creator Studio row controls were declared on their pages and had no handler.
// Three media rules were written and could never win the cascade. And
// lib/creator-music-system-config.cjs declared sixteen paths of which eleven
// were registered nowhere at all, while /creator-studio/music-system/new told
// the customer to save records through them. Each time, the declaration was the
// thing that made the capability look present.
//
// ## Why this asks the application rather than reading the source
//
// The first version of this scanned server.js and routes/ for
// `app.get("/literal"` and compared the two sets of strings. It reported
// seventy-four unserved paths, of which about seventy were false: the Business
// Builder record pages are registered in a loop -- `app.post(page.api, ...)` --
// so the path never appears as a literal next to a verb. A scan that reads
// literals measures the routes somebody typed out, and reports it as the routes
// the application answers. Those are different populations, and the difference
// was fifty-three wrong findings.
//
// So the served set is taken from the Express router stack of the real app. It
// is the same walk tests/every-path-a-button-calls-exists.test.js uses, and it
// cannot disagree with what runs.
//
// ## Why parameter names are normalised
//
// Four more of those seventy-four were real routes under a different parameter
// name: lib/sonara-owner-record-pages.cjs declares
// `/api/business/quotes/:id/invoice` and server registers
// `/api/business/quotes/:quoteId/invoice`. Express matches on position, not on
// the name, so those are one route. `:anything` therefore compares as `:`. That
// is a deliberate loosening and it is the only one: two paths that differ
// anywhere but in a parameter's name are two paths.
//
// ## Why comments are stripped
//
// `/api/thing` is an example inside a comment in
// lib/sonara-form-reachability.cjs, and `/api/...` is prose in
// lib/sonara-route-surface.cjs. Neither is a declaration. Comment stripping uses
// lib/sonara-comment-stripping.cjs rather than a fresh regular expression, which
// is a rule the release chain enforces on scripts in this directory.

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const { withoutComments } = require(path.join(root, "lib/sonara-comment-stripping.cjs"));

// Measured 29 September 2026, by running this script and reading its own first
// line: 767 registered route paths, 81 distinct /api paths declared across 15
// files in lib/. The floors sit far enough below those that
// ordinary work does not trip them, and far enough above zero that a broken walk
// or a broken scan cannot pass by measuring nothing.
const MINIMUM_SERVED = 500;
const MINIMUM_DECLARED = 50;
const MINIMUM_DECLARING_FILES = 5;

// Two-sided. A declared path that nothing serves and is not here fails. An entry
// here that has started being served, or that no library declares any more,
// fails as well -- a stale reason is what the next person reads instead of
// checking, and this repository has shipped one.
//
// Each reason says what was opened to confirm it.
const DELIBERATELY_NOT_SERVED = [
  {
    path: "/api/",
    reason:
      "Not a route. lib/sonara-async-route-safety.cjs line 141 and " +
      "lib/sonara-form-reachability.cjs line 138 both test this as a prefix: " +
      'String(req.path).startsWith("/api/").'
  },
  {
    path: "/api/business/time-entries",
    reason:
      "The time clock is started and stopped by /api/business/time-entries/start " +
      "and /stop, both registered. This value is the page's resource key -- " +
      "pageForApi() in lib/sonara-owner-record-pages.cjs and RESOURCE_MAP in " +
      "routes/sonara-last9-routes.cjs look pages up by it -- and the page sets " +
      "form.action, which formCard() prefers, so no rendered form posts here."
  },
  {
    path: "/api/chat/completions",
    reason: "Open WebUI's own endpoint, called outward by lib/sonara-open-webui-adapter.cjs."
  },
  {
    path: "/api/generate",
    reason: "Ollama's own endpoint, called outward by lib/sonara-ollama-adapter.cjs."
  },
  {
    path: "/api/models",
    reason: "A probe path on an upstream service, in lib/sonara-ai-integration-registry.cjs."
  },
  {
    path: "/api/tags",
    reason: "A probe path on an upstream Ollama service, in lib/sonara-ai-integration-registry.cjs."
  },
  {
    path: "/api/models/BAAI/bge-small-en-v1.5",
    reason:
      "A Hugging Face URL built in lib/sonara-huggingface-catalog.cjs line 455 " +
      "against the upstream host, not a path this application answers."
  },
  {
    path: "/api/v1/retrieval",
    reason: "RAGFlow's own endpoint, called outward by lib/sonara-ragflow-adapter.cjs."
  }
];

// `:anything` -> `:`. Express matches a parameter by position; the name it is
// bound to is the handler's business and not part of the address.
function normalise(routePath) {
  return String(routePath)
    .split("/")
    .map((segment) => (segment.startsWith(":") ? ":" : segment))
    .join("/")
    .replace(/\/+$/, "") || "/";
}

function servedPaths(app) {
  const stack = app._router ? app._router.stack : app.router?.stack;
  if (!stack) throw new Error("the Express app exposes no router stack; this check cannot measure what is served");
  const served = new Set();
  (function walk(layers) {
    for (const layer of layers) {
      if (layer.route?.path) served.add(normalise(layer.route.path));
      else if (layer.handle?.stack) walk(layer.handle.stack);
    }
  })(stack);
  return served;
}

function declaredPaths() {
  const declared = new Map();
  const files = readdirSync(path.join(root, "lib")).filter((name) => name.endsWith(".cjs")).sort();
  for (const name of files) {
    const source = withoutComments(readFileSync(path.join(root, "lib", name), "utf8"));
    for (const match of source.matchAll(/["'`](\/api\/[A-Za-z0-9/_:.-]*)["'`]/g)) {
      const key = normalise(match[1]);
      if (!declared.has(key)) declared.set(key, new Set());
      declared.get(key).add(`lib/${name}`);
    }
  }
  return declared;
}

async function main() {
  const imported = await import(path.join(root, "server.js"));
  const app = imported.default ?? imported;
  const served = servedPaths(app);
  const declared = declaredPaths();
  const declaringFiles = new Set([...declared.values()].flatMap((files) => [...files]));

  // Shape 1: a check satisfied by an empty list. Either walk breaking silently
  // would leave nothing to compare and print a pass.
  const blind = [];
  if (served.size < MINIMUM_SERVED) {
    blind.push(`only ${served.size} served route paths found (floor ${MINIMUM_SERVED}); the router walk has gone blind`);
  }
  if (declared.size < MINIMUM_DECLARED) {
    blind.push(`only ${declared.size} declared /api paths found (floor ${MINIMUM_DECLARED}); the library scan has gone blind`);
  }
  if (declaringFiles.size < MINIMUM_DECLARING_FILES) {
    blind.push(
      `only ${declaringFiles.size} files in lib/ declare an /api path (floor ${MINIMUM_DECLARING_FILES}); ` +
        "the directory read has gone blind"
    );
  }
  if (blind.length) {
    for (const line of blind) console.error(`BLIND: ${line}`);
    console.error("Fix the measurement before trusting this check. It is not reporting a pass.");
    process.exitCode = 1;
    return;
  }

  const exempt = new Map(DELIBERATELY_NOT_SERVED.map((entry) => [normalise(entry.path), entry.reason]));
  const unaccounted = [];
  for (const [declaredPath, files] of [...declared.entries()].sort()) {
    if (served.has(declaredPath)) continue;
    if (exempt.has(declaredPath)) continue;
    unaccounted.push({ path: declaredPath, files: [...files].sort() });
  }

  const staleNowServed = [];
  const staleNotDeclared = [];
  for (const [exemptPath] of exempt) {
    if (served.has(exemptPath)) staleNowServed.push(exemptPath);
    else if (!declared.has(exemptPath)) staleNotDeclared.push(exemptPath);
  }

  console.log(
    `${served.size} route paths served by the application, ${declared.size} distinct /api paths declared across ` +
      `${declaringFiles.size} files in lib/. ${exempt.size} recorded as deliberately not served.`
  );

  let failed = false;

  if (unaccounted.length) {
    failed = true;
    console.error(`\n${unaccounted.length} declared /api path(s) the application does not serve:`);
    for (const entry of unaccounted) console.error(`  ${entry.path}\n      declared in ${entry.files.join(", ")}`);
    console.error(
      "\nEither register the route, remove the declaration, or add it to DELIBERATELY_NOT_SERVED in this file " +
        "with a reason you verified. A path declared and never served is what makes a capability look present."
    );
  }

  if (staleNowServed.length) {
    failed = true;
    console.error(`\n${staleNowServed.length} exemption(s) name a path that is now served:`);
    for (const entry of staleNowServed) console.error(`  ${entry}`);
    console.error("\nRemove the entry. Its reason no longer describes anything, and a wrong reason is worse than none.");
  }

  if (staleNotDeclared.length) {
    failed = true;
    console.error(`\n${staleNotDeclared.length} exemption(s) name a path no library declares any more:`);
    for (const entry of staleNotDeclared) console.error(`  ${entry}`);
    console.error("\nRemove the entry. Nothing declares this, so the exemption is covering a path that does not exist.");
  }

  if (failed) {
    process.exitCode = 1;
    return;
  }

  console.log("Every declared /api path is either served or recorded, with a reason, as deliberately not served.");
}

main().then(() => {
  // server.js opens handles (timers, an Express listener in some modes) and the
  // process would otherwise sit here after the report. The exit code set above
  // is what the release chain reads.
  process.exit(process.exitCode || 0);
}).catch((error) => {
  console.error(`report-declared-api-paths-nothing-serves failed: ${error?.message || error}`);
  process.exit(1);
});

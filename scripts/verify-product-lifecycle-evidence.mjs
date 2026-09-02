#!/usr/bin/env node
"use strict";

// What "active" is allowed to mean on a catalog card.
//
// The catalog carries a lifecycleStatus per product, and lib/sonara-plain-
// language.cjs renders `beta` to a customer as "Early access -- usable now,
// still being refined." That is a promise about the state of the product, and
// until this file existed it was a word typed into a table. Nothing derived it,
// nothing checked it, and nothing failed when it was wrong.
//
// It was wrong in both directions at once. On 2 September 2026, of 42 products:
//
//   * All 19 marked beta had a live route, and 16 of them met every bar below.
//     They were held back by nothing anybody had written down.
//   * The label correlated with no quality signal in the repository. Test
//     coverage ran slightly the other way.
//
// So this is not a check that the labels are correct. It is the thing that
// makes the label mean something: four facts a machine can establish about a
// product, and the rule that `active` requires all four.
//
// The bar is deliberately about the product being REACHABLE AND EXERCISED, not
// about it being good. A page can pass all four and still be thin. What it
// cannot do is pass while being a card pointing at nothing, which is the
// failure mode a catalog has.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

process.env.NODE_ENV = process.env.NODE_ENV || "test";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const { RECOMMENDED_PRODUCT_CATALOG, EXECUTABLE_LIFECYCLE_STATUSES } = require(
  path.join(root, "lib", "sonara-recommended-product-catalog.cjs")
);
const { ROUTE_REGISTRY } = require(path.join(root, "lib", "sonara-route-registry.cjs"));
const { PLANNER_TOOLS } = require(path.join(root, "lib", "sonara-planner-tools.cjs"));
const { MARKET_TOOLS } = require(path.join(root, "lib", "sonara-market-tools.cjs"));

// Beta products held back for a reason no check here can see -- awaiting a real
// customer cohort, a provider contract, an owner decision. Two-sided: an entry
// naming a product that is no longer beta fails, because a stale reason is what
// the next person reads instead of checking.
//
// Empty on 2 September 2026. Every product that was beta either met the bar and
// was promoted, or had its gap closed first. An empty register is the honest
// state, not an omission.
const HELD_BACK = Object.freeze({});

function fail(lines) {
  process.stderr.write(`${lines.join("\n")}\n`);
  process.exit(1);
}

// Every test file, read once. The corpus, not a sample: a product exercised by
// a suite in a subdirectory is exercised.
function testCorpus() {
  const directory = path.join(root, "tests");
  if (!fs.existsSync(directory)) {
    fail(["tests/ does not exist, so nothing can be shown to be exercised. This check cannot run."]);
  }
  const files = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const next = path.join(current, entry.name);
      if (entry.isDirectory()) walk(next);
      else files.push(next);
    }
  };
  walk(directory);
  return { count: files.length, text: files.map((file) => fs.readFileSync(file, "utf8")).join("\n") };
}

// The GET paths Express will actually answer, read off the app rather than off a
// list of what it is meant to serve.
function registeredGets(app) {
  const found = new Set();
  for (const layer of app._router.stack) {
    if (!layer.route) continue;
    const paths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
    for (const method of Object.keys(layer.route.methods)) {
      if (method !== "get") continue;
      for (const route of paths) found.add(route);
    }
  }
  return found;
}

async function main() {
  const app = require(path.join(root, "server.js"));
  const request = require("supertest");

  const catalog = RECOMMENDED_PRODUCT_CATALOG;
  const gets = registeredGets(app);
  const corpus = testCorpus();
  const registryRoutes = new Map(ROUTE_REGISTRY.map((record) => [record.route, record]));
  const toolByPath = new Map([...PLANNER_TOOLS, ...MARKET_TOOLS].map((tool) => [tool.path, tool]));

  // Blindness guards. Every rule below is satisfied by an empty catalog, an
  // empty route table or an empty test corpus, so each population is asserted
  // before anything is concluded from it.
  const blind = [];
  if (catalog.length < 40) blind.push(`the catalog has ${catalog.length} products; this check has gone blind`);
  if (gets.size < 100) blind.push(`Express answers ${gets.size} GET routes; this check has gone blind`);
  if (corpus.count < 100) blind.push(`only ${corpus.count} test files were read; this check has gone blind`);
  if (registryRoutes.size < 100) blind.push(`the route registry holds ${registryRoutes.size} routes; this check has gone blind`);
  if (toolByPath.size < 20) blind.push(`only ${toolByPath.size} tool descriptors were indexed, so tool-backed products would read as unexercised`);
  if (blind.length) fail(["Product lifecycle evidence check cannot run:", ...blind.map((line) => `  ${line}`)]);

  const problems = [];
  const evidence = new Map();
  let exercisedCount = 0;

  for (const item of catalog) {
    const route = item.route;
    const tool = toolByPath.get(route);
    const names = [route, item.serviceKey];
    if (tool?.build?.name) names.push(tool.build.name);
    const exercised = names.some((name) => corpus.text.includes(name));
    if (exercised) exercisedCount += 1;

    const registered = gets.has(route);
    const record = registryRoutes.get(route);
    const tracked = Boolean(record && record.title && record.description);

    // A live request. 200 is a page; a redirect to a login surface is a page
    // behind a guard, which is a working answer and not a missing one. Anything
    // else -- a 404, a 500, a redirect somewhere unrelated -- is a card in a
    // catalog pointing at nothing.
    let answers = false;
    let observed = "not requested";
    if (registered) {
      const response = await request(app).get(route).set("Accept", "text/html");
      const location = response.headers.location || "";
      observed = `${response.status}${location ? ` -> ${location}` : ""}`;
      answers = response.status === 200 || (response.status >= 300 && response.status < 400 && /login/.test(location));
    }

    evidence.set(item.serviceKey, { registered, answers, tracked, exercised, observed, item });
  }

  if (exercisedCount === 0) {
    fail([
      "No product in the catalog is named by any test file.",
      "That is not credible, so the matcher has stopped working rather than the tests having gone.",
      "Check how service keys, routes and tool build functions are named before trusting this check again."
    ]);
  }

  const MISSING = {
    registered: (record) => `Express serves no GET ${record.item.route}`,
    answers: (record) => `GET ${record.item.route} answered ${record.observed}, which is neither a page nor a redirect to sign in`,
    tracked: (record) => `${record.item.route} is not in the route registry with a title and description`,
    exercised: (record) => `no test names ${record.item.serviceKey}, ${record.item.route}, or the function behind it`
  };

  for (const [key, record] of evidence) {
    const gaps = Object.keys(MISSING).filter((fact) => !record[fact]);
    const status = record.item.lifecycleStatus;

    if (status === "active" && gaps.length) {
      problems.push(
        `${key} is sold as active with ${gaps.length} thing(s) unestablished:\n` +
          gaps.map((fact) => `      - ${MISSING[fact](record)}`).join("\n")
      );
      continue;
    }

    if (status === "beta" && !gaps.length && !HELD_BACK[key]) {
      problems.push(
        `${key} meets every bar and is still labelled beta, which a customer reads as "still being refined".\n` +
          "      Either set its lifecycleStatus to active, or record in HELD_BACK what is actually holding it back."
      );
    }
  }

  // The other side of the register: a reason that no longer describes anything.
  for (const [key, reason] of Object.entries(HELD_BACK)) {
    const record = evidence.get(key);
    if (!record) {
      problems.push(`HELD_BACK names ${key}, which is not in the catalog. Remove it.`);
      continue;
    }
    if (record.item.lifecycleStatus !== "beta") {
      problems.push(
        `HELD_BACK says ${key} is held back -- "${reason}" -- but it is now ${record.item.lifecycleStatus}. ` +
          "A stale reason is what the next reader believes instead of checking."
      );
    }
  }

  if (problems.length) {
    fail([
      "Product lifecycle evidence check failed.",
      "",
      ...problems.map((problem) => `  ${problem}`),
      "",
      `Checked ${catalog.length} products against ${gets.size} served GET routes, ${registryRoutes.size} registry records and ${corpus.count} test files.`
    ]);
  }

  const counts = catalog.reduce((tally, item) => {
    tally[item.lifecycleStatus] = (tally[item.lifecycleStatus] || 0) + 1;
    return tally;
  }, {});
  const shown = Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([status, count]) => `${count} ${status}`)
    .join(", ");

  process.stdout.write(
    `Product lifecycle evidence verified: ${catalog.length} products (${shown}), each with a served route, ` +
      `a live answer, a registry record and a test that names it. ` +
      `${Object.keys(HELD_BACK).length} held back by a recorded reason. ` +
      `Executable statuses: ${EXECUTABLE_LIFECYCLE_STATUSES.join(", ")}. ` +
      `Read from ${gets.size} served GET routes, ${registryRoutes.size} registry records, ` +
      `${toolByPath.size} tool descriptors and ${corpus.count} test files.\n`
  );
  process.exit(0);
}

main().catch((error) => {
  fail([`Product lifecycle evidence check threw: ${error && error.stack ? error.stack : error}`]);
});

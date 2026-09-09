"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { CREATOR_GENERATION_PROVIDERS } = require("../lib/creator-generation-provider-registry.cjs");

const root = path.join(__dirname, "..");
const ROUTES = fs.readFileSync(path.join(root, "routes", "creator-generation-routes.cjs"), "utf8");
const DOC = fs.readFileSync(path.join(root, "docs", "owner", "MEDIA-WORKER-INSTALL.md"), "utf8");

// docs/owner/MEDIA-WORKER-INSTALL.md tells somebody how to build a service this
// application will talk to. It is a wire protocol written down, and a wire
// protocol written down is a second copy of a fact.
//
// Two documents in this repository drifted this way on one day.
// INSTALL-ALL-KEYS.md named the wrong ten required variables and survived
// because a count matched while the names did not, and two tests asserted the
// price ladder as literals that outlived the ladder. Somebody following a wrong
// version of THIS file builds a worker that never completes a job and has no way
// to find out why -- there is no running system to contradict it.
//
// So the contract is pulled out of the route code and checked against the prose.
describe("the media worker contract is what the code sends", () => {
  const dispatch = ROUTES.slice(ROUTES.indexOf("async function dispatchWorker"), ROUTES.indexOf("async function refreshJob"));
  const refresh = ROUTES.slice(ROUTES.indexOf("async function refreshWorker"), ROUTES.indexOf("async function evaluatePolicy"));
  const safeOutput = ROUTES.slice(ROUTES.indexOf("async function fetchSafeOutput"), ROUTES.indexOf("function generationForm"));

  it("found the code it is comparing against", () => {
    for (const [name, slice] of [["dispatchWorker", dispatch], ["refreshWorker", refresh], ["fetchSafeOutput", safeOutput]]) {
      assert.ok(slice.length > 200, `${name} is not where this test expects it; every assertion below would be vacuous`);
    }
    assert.ok(DOC.length > 3000, "the install guide is too short to be the whole document");
  });

  it("documents the two endpoint paths the code actually calls", () => {
    assert.match(dispatch, /\/v1\/jobs`/, "the submit path changed");
    assert.match(refresh, /\/v1\/jobs\/\$\{encodeURIComponent/, "the poll path changed");
    assert.match(DOC, /POST \{CREATOR_MEDIA_WORKER_URL\}\/v1\/jobs/);
    assert.match(DOC, /GET \{CREATOR_MEDIA_WORKER_URL\}\/v1\/jobs\/\{id\}/);
  });

  it("names every field the submit body carries", () => {
    // Parsed out of the JSON.stringify argument rather than listed here, so a
    // field added to the request is a field this test demands documentation for.
    const body = dispatch.slice(dispatch.indexOf("JSON.stringify({"), dispatch.indexOf("})\n  });") + 2);
    const fields = [...body.matchAll(/(?:^|[{,]\s*)([a-z_]+):/g)].map((match) => match[1]);
    assert.ok(fields.length >= 6, `only ${fields.length} body fields parsed; the matcher has stopped matching`);
    for (const field of fields) {
      assert.match(DOC, new RegExp(`\\b${field}\\b`), `the request sends ${field} and the guide never mentions it`);
    }
  });

  it("names the bearer header and the variable it comes from", () => {
    assert.match(dispatch, /Authorization: `Bearer \$\{process\.env\.CREATOR_MEDIA_WORKER_TOKEN\}`/);
    assert.match(DOC, /Authorization: Bearer \{CREATOR_MEDIA_WORKER_TOKEN\}/);
    assert.match(DOC, /CREATOR_MEDIA_WORKER_URL/);
  });

  it("lists the statuses the code treats as terminal", () => {
    const completion = ROUTES.slice(ROUTES.indexOf("async function completeFromProviderPayload"), ROUTES.indexOf("async function evaluatePolicy"));
    const failed = [...completion.matchAll(/\["failed", "error"\]/g)];
    assert.equal(failed.length, 1, "the failure statuses moved");
    const doneList = completion.match(/\["completed", "succeeded", "done"\]/);
    assert.ok(doneList, "the success statuses moved");
    for (const status of ["failed", "error", "completed", "succeeded", "done"]) {
      assert.match(DOC, new RegExp(`\`${status}\``), `${status} is a terminal status the guide does not list`);
    }
  });

  it("lists every key the output URL is read from", () => {
    const finder = ROUTES.slice(ROUTES.indexOf("function findOutputUrl"), ROUTES.indexOf("function generationForm"));
    // [a-zA-Z_] rather than [a-z_]: the first version stopped at the capital in
    // `generateVideoResponse`, captured "generate", and then demanded the guide
    // document a key that does not exist. A matcher that mangles a name and
    // then asserts on the mangled version fails in a way that looks like the
    // document being wrong.
    const keys = [...finder.matchAll(/payload\?\.([a-zA-Z_]+)(?:\?\.([a-zA-Z_]+))?/g)]
      .map((match) => (match[2] ? `${match[1]}.${match[2]}` : match[1]))
      // The Google Veo shapes are read by the same helper and are not part of
      // the worker's contract, so the guide does not describe them.
      .filter((key) => !/^(response|generateVideoResponse)/.test(key));
    assert.ok(keys.length >= 4, `only ${keys.length} output keys parsed; the matcher has stopped matching`);
    for (const key of [...new Set(keys)]) {
      assert.match(DOC, new RegExp(key.replace(".", "\\.")), `the code reads ${key} and the guide does not say so`);
    }
  });

  it("states the real size limit, not a remembered one", () => {
    const limit = safeOutput.match(/(\d+) \* 1024 \* 1024/);
    assert.ok(limit, "the size limit is no longer written as MB in the code");
    assert.match(DOC, new RegExp(`${limit[1]} MB`), `the code caps output at ${limit[1]} MB and the guide says otherwise`);
  });

  it("says https-only and no-redirect, because both are refusals", () => {
    assert.match(safeOutput, /url\.protocol !== "https:"/, "the https requirement is gone from the code");
    assert.match(safeOutput, /redirect: "error"/, "the no-redirect requirement is gone from the code");
    assert.match(DOC, /No redirects/i);
    assert.match(DOC, /insecure_output_url/);
  });

  it("lists exactly the capabilities the registry gives the worker", () => {
    const worker = CREATOR_GENERATION_PROVIDERS.find((provider) => provider.key === "open_source_media_worker");
    assert.ok(worker, "the worker is no longer in the registry");
    assert.ok(worker.capabilities.length >= 5, "too few capabilities to be worth checking");
    for (const capability of worker.capabilities) {
      assert.match(DOC, new RegExp(`\\b${capability}\\b`), `the registry gives the worker ${capability} and the guide omits it`);
    }
  });

  it("keeps the licence gate the registry record states", () => {
    const worker = CREATOR_GENERATION_PROVIDERS.find((provider) => provider.key === "open_source_media_worker");
    assert.match(String(worker.license), /license review/i, "the registry no longer requires a recorded licence review");
    // \s+ rather than a space: the phrase is line-wrapped in the markdown, and
    // a check that cannot see across a line break reports a present sentence as
    // missing.
    assert.match(DOC, /licence\s+review/i, "the guide dropped the licence gate the registry requires");
    assert.match(DOC, /CC-BY-NC/, "the guide dropped the AudioCraft weights warning");
  });
});

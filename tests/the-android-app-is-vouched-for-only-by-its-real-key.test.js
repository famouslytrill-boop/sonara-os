"use strict";

// /.well-known/assetlinks.json tells Android that the app signed with a given
// certificate may open this site as itself. Nothing served it, so the Android
// shell could only ever have opened as a browser tab. It is served now, from
// the Play app-signing fingerprint the owner sets -- and never from a guess:
// a file naming the wrong certificate would tell Android to trust whoever
// holds that key.

const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const registerWellKnownRoutes = require("../routes/sonara-well-known-routes.cjs");
const contract = require("../android/twa/build-contract.json");

const REAL = "14:6D:E9:83:C5:73:06:50:D8:EE:B9:95:2F:34:FC:64:16:A0:83:42:E6:1D:BE:A8:8A:04:96:B2:3F:CF:44:E5";
const ROTATED = "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99";

function appWith(value) {
  const app = express();
  registerWellKnownRoutes(app, { getEnv: (name) => (name === contract.digitalAssetLinks.fingerprintEnvironment ? value : undefined) });
  return app;
}

const PATH = "/.well-known/assetlinks.json";

describe("the Android app is vouched for only by its real key", () => {
  it("associates no app until the fingerprint is set, and does not cache that answer", async () => {
    for (const unset of [undefined, "", "  "]) {
      const response = await request(appWith(unset)).get(PATH);
      assert.equal(response.status, 404, `an unset fingerprint (${JSON.stringify(unset)}) produced an association`);
      assert.equal(response.headers["cache-control"], "no-store");
    }
  });

  it("refuses a malformed value, including one bad entry beside a good one", async () => {
    for (const bad of ["not-a-fingerprint", REAL.slice(0, -3), `${REAL},${REAL.replace(/:/g, "")}`]) {
      const response = await request(appWith(bad)).get(PATH);
      assert.equal(response.status, 404, `${bad} was served`);
      assert.match(response.text, /not in the expected form/);
    }
  });

  it("vouches for the package and relations the build contract names", async () => {
    const response = await request(appWith(`${REAL.toLowerCase()}, ${ROTATED},${REAL}`)).get(PATH);
    assert.equal(response.status, 200);
    assert.match(response.headers["content-type"], /application\/json/);
    assert.deepEqual(response.body, [{
      relation: contract.digitalAssetLinks.relations,
      target: { namespace: "android_app", package_name: contract.packageName, sha256_cert_fingerprints: [REAL, ROTATED] }
    }]);
  });

  it("is served by the application at the path the contract names", async () => {
    const server = require("../server");
    const saved = process.env[contract.digitalAssetLinks.fingerprintEnvironment];
    delete process.env[contract.digitalAssetLinks.fingerprintEnvironment];
    try {
      const response = await request(server).get(contract.digitalAssetLinks.path);
      assert.equal(response.status, 404, "the application does not serve the asset-links path through this route");
      assert.match(response.text, /No Android app is associated/);
    } finally {
      if (saved === undefined) delete process.env[contract.digitalAssetLinks.fingerprintEnvironment];
      else process.env[contract.digitalAssetLinks.fingerprintEnvironment] = saved;
    }
  });
});

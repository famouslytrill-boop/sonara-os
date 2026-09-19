// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));

const twa = readJson("android/twa/twa-manifest.json");
const contract = readJson("android/twa/build-contract.json");
const web = readJson("public/site.webmanifest");

assert.equal(contract.strategy, "twa_first");
assert.equal(contract.packageName, "com.sonaraindustries.os");
assert.equal(twa.packageId, contract.packageName);
assert.equal(twa.host, "sonaraindustries.com");
assert.equal(contract.productionOrigin, "https://sonaraindustries.com");
assert.equal(twa.webManifestUrl, contract.webManifest);
assert.equal(twa.fullScopeUrl, contract.productionOrigin + "/");
assert.equal(twa.startUrl, web.start_url);
assert.equal(twa.display, web.display);
assert.equal(twa.minSdkVersion, contract.minSdk);
assert.ok(contract.targetSdk >= 36, "Google Play new apps require target API 36+ after 2026-08-31");
assert.ok(contract.compileSdk >= contract.targetSdk);
assert.equal(contract.bubblewrapVersion, "1.25.0");
assert.equal(contract.capacitor.productionRemoteServerUrlAllowed, false);
assert.match(contract.capacitor.reason, /not intended for production/i);
assert.equal(contract.digitalAssetLinks.status, "setup_required");
assert.equal(contract.digitalAssetLinks.path, "/.well-known/assetlinks.json");
assert.equal(contract.digitalAssetLinks.fingerprintEnvironment, "ANDROID_PLAY_SIGNING_SHA256");
assert.ok(contract.digitalAssetLinks.relations.includes("delegate_permission/common.handle_all_urls"));
assert.ok(contract.digitalAssetLinks.relations.includes("delegate_permission/common.get_login_creds"));
assert.equal(contract.play.packageRegistrationDeadline, "2026-09-30");
assert.match(contract.play.billingDecision, /required_before/);
assert.equal(contract.proof.staticContract, "automated");
assert.equal(contract.proof.playSignedAab, "manual_required");
assert.equal(contract.proof.physicalDevice, "manual_required");
assert.deepEqual(twa.fingerprints, [], "Do not commit a guessed/debug fingerprint as production Play signing evidence");

const localIconPaths = new Set((web.icons || []).map((item) => item.src));
for (const url of [twa.iconUrl, twa.maskableIconUrl]) {
  const parsed = new URL(url);
  assert.equal(parsed.origin, contract.productionOrigin);
  assert.ok(localIconPaths.has(parsed.pathname), `${parsed.pathname} is not declared in the canonical PWA manifest`);
  assert.ok(fs.existsSync(path.join(root, "public", parsed.pathname)), `${parsed.pathname} does not exist under public/`);
}

for (const [name, state] of Object.entries(contract.proof)) {
  assert.ok(["automated", "automated_ci", "manual_required"].includes(state), `unknown Android proof state ${name}=${state}`);
}

console.log(
  `Android TWA contract verified: ${twa.packageId}, target API ${contract.targetSdk}, Bubblewrap ${contract.bubblewrapVersion}; Play signing/device proof remains explicit.`
);

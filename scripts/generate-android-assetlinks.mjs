// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contract = JSON.parse(fs.readFileSync(path.join(root, "android/twa/build-contract.json"), "utf8"));
const raw = String(process.env[contract.digitalAssetLinks.fingerprintEnvironment] || "").trim().toUpperCase();
const fingerprintPattern = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

if (!fingerprintPattern.test(raw)) {
  console.error(
    `setup_required: set ${contract.digitalAssetLinks.fingerprintEnvironment} to the SHA-256 certificate fingerprint from Google Play App Signing.`
  );
  process.exit(1);
}

const payload = [{
  relation: contract.digitalAssetLinks.relations,
  target: {
    namespace: "android_app",
    package_name: contract.packageName,
    sha256_cert_fingerprints: [raw]
  }
}];

const outputFlag = process.argv.find((arg) => arg.startsWith("--output="));
const json = JSON.stringify(payload, null, 2) + "\n";
if (!outputFlag) {
  process.stdout.write(json);
  process.exit(0);
}

const output = path.resolve(root, outputFlag.slice("--output=".length));
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, json);
console.log(`Wrote ${path.relative(root, output)} for ${contract.packageName}.`);

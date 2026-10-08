// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// /.well-known/assetlinks.json: the file that lets the Android app open this
// site as itself.
//
// The Android shell is a Trusted Web Activity (android/twa). Android shows it
// without a browser bar only when this site says, at this path, that the app's
// signing certificate belongs to it. android/twa/build-contract.json recorded
// that as `setup_required` and nothing served the path, so the shell could only
// ever have opened as a browser tab.
//
// ## The fingerprint is configuration, never a guess
//
// It is the SHA-256 of the Google Play app-signing certificate, which exists
// only once the app is registered in the Play Console, and only the owner can
// read it there. It arrives as ANDROID_PLAY_SIGNING_SHA256 -- several,
// comma-separated, while a key rotates. Until it is set, or if any value is not
// a well-formed fingerprint, this answers 404: no association at all is the
// honest answer, and a file naming a debug or invented certificate would tell
// Android to trust whoever holds that key.
//
// The package name and relations come from lib/sonara-android-app-association.cjs,
// which scripts/verify-android-twa.mjs holds equal to the build contract. They
// are not read from android/ at runtime: that directory is not shipped with the
// server, and reading it crashed the Docker image build at startup.

const association = require("../lib/sonara-android-app-association.cjs");

const FINGERPRINT = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/;

// Every value well-formed, or none used. A list with one good fingerprint and
// one typo is a configuration mistake, and serving the good half would hide it.
function fingerprintsFrom(raw) {
  const values = String(raw || "").split(",").map((value) => value.trim().toUpperCase()).filter(Boolean);
  if (!values.length) return { ok: false, code: "not_configured" };
  if (!values.every((value) => FINGERPRINT.test(value))) return { ok: false, code: "malformed_fingerprint" };
  return { ok: true, fingerprints: [...new Set(values)] };
}

function assetLinks(fingerprints) {
  return [{
    relation: [...association.relations],
    target: { namespace: "android_app", package_name: association.packageName, sha256_cert_fingerprints: fingerprints }
  }];
}

function registerWellKnownRoutes(app, deps = {}) {
  const getEnv = typeof deps.getEnv === "function" ? deps.getEnv : (name) => process.env[name];
  app.get(association.path, (req, res) => {
    const configured = fingerprintsFrom(getEnv(association.fingerprintEnvironment));
    if (!configured.ok) {
      // Not cached: the next request after the owner sets the value should see it.
      res.set("Cache-Control", "no-store");
      return res.status(404).type("text/plain").send(configured.code === "malformed_fingerprint"
        ? "The app signing fingerprint is set but not in the expected form, so no app is associated with this site."
        : "No Android app is associated with this site yet.");
    }
    res.set("Cache-Control", "public, max-age=3600");
    return res.status(200).json(assetLinks(configured.fingerprints));
  });
}

module.exports = registerWellKnownRoutes;
module.exports.fingerprintsFrom = fingerprintsFrom;

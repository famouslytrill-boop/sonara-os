// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// What /.well-known/assetlinks.json vouches for, held where the running server
// can reach it.
//
// routes/sonara-well-known-routes.cjs first read these from
// android/twa/build-contract.json at registration. That directory is part of the
// Android build, not the web deployment: the Dockerfile copies api, routes, lib,
// config, data, openapi, scripts, ui and public, and vercel.json bundles public,
// routes and lib. So the image build died at startup with ENOENT on the
// contract (Docker Image CI on 9c30834c), and a Vercel function could have done
// the same in production.
//
// The values live here instead, and scripts/verify-android-twa.mjs fails the
// release when they differ from the build contract. The app that is built and
// the app this file vouches for still cannot drift; a check holds that rather
// than a runtime read of a file the server is not shipped with.

module.exports = Object.freeze({
  packageName: "com.sonaraindustries.os",
  path: "/.well-known/assetlinks.json",
  fingerprintEnvironment: "ANDROID_PLAY_SIGNING_SHA256",
  relations: Object.freeze([
    "delegate_permission/common.handle_all_urls",
    "delegate_permission/common.get_login_creds"
  ])
});

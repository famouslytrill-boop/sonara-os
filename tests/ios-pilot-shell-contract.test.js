"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

describe("iOS internal pilot shell remains restricted", () => {
  const root = path.join(__dirname, "..");
  const project = fs.readFileSync(path.join(root, "ios", "project.yml"), "utf8");
  const code = fs.readFileSync(path.join(root, "ios", "SonaraPilot", "SonaraPilotApp.swift"), "utf8");
  const instructions = fs.readFileSync(path.join(root, "ios", "README.md"), "utf8");

  it("defines an iOS application without signing secrets or deployment authority", () => {
    assert.match(project, /platform: iOS/);
    assert.match(project, /deploymentTarget: "17\.0"/);
    assert.match(project, /PRODUCT_BUNDLE_IDENTIFIER: com\.sonaraindustries\.pilot/);
    assert.doesNotMatch(project, /(?:DEVELOPMENT_TEAM|PROVISIONING_PROFILE_SPECIFIER|CODE_SIGN_IDENTITY):\s*\S+/);
    assert.match(instructions, /source-only, restricted internal test shell/);
    assert.match(instructions, /App Store Connect/);
  });

  it("limits in-webview access to the first-party HTTPS public origin", () => {
    assert.match(code, /url\.scheme\?\.lowercased\(\) == "https"/);
    assert.match(code, /url\.host\?\.lowercased\(\) == PublicPageWebView\.allowedHost/);
    assert.match(code, /allowedPaths\.contains\(url\.path\)/);
    assert.match(code, /"\/", "\/about", "\/privacy", "\/terms"/);
    assert.match(code, /decisionHandler\(\.cancel\)/);
    assert.doesNotMatch(code, /WKScriptMessageHandler|evaluateJavaScript\(/);
  });

  it("disables persistence, JavaScript popups, and account/purchase paths", () => {
    assert.match(code, /websiteDataStore = \.nonPersistent\(\)/);
    assert.match(code, /javaScriptCanOpenWindowsAutomatically = false/);
    assert.match(code, /No offline customer data is stored/);
    assert.doesNotMatch(code, /URLSession\.shared\.upload|UIPasteboard|StoreKit/);
    assert.match(instructions, /StoreKit purchases\/entitlements/);
  });
});

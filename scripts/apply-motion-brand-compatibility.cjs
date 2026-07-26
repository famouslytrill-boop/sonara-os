"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const files = [
  path.join(root, "server.js"),
  path.join(root, "ui", "sonara", "styles", "99-sonara-cinematic-system.css"),
  path.join(root, "public", "sonara-application-ui.css")
];

for (const filePath of files) {
  if (!fs.existsSync(filePath)) {
    console.error(`Missing motion compatibility file: ${path.relative(root, filePath)}`);
    process.exit(1);
  }
  const source = fs.readFileSync(filePath, "utf8");
  const updated = source.replaceAll("sonara-startup-shell", "sonara-startup-frame");
  fs.writeFileSync(filePath, updated);
}

console.log("SONARA startup wrapper aligned with public-copy contracts.");

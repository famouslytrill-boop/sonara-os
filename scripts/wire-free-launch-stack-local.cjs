"use strict";

const fs = require("node:fs");
const path = require("node:path");

const serverPath = path.join(process.cwd(), "server.js");
if (!fs.existsSync(serverPath)) {
  console.error("server.js not found. Run this from the repository root.");
  process.exit(1);
}

let source = fs.readFileSync(serverPath, "utf8");

if (!source.includes("registerFreeLaunchStackRoutes")) {
  source = source.replace(
    'const registerLastNineHoursRoutes = require("./routes/sonara-last9-routes.cjs");',
    'const registerLastNineHoursRoutes = require("./routes/sonara-last9-routes.cjs");\nconst registerFreeLaunchStackRoutes = require("./routes/free-launch-stack-routes.cjs");'
  );
}

if (!source.includes("registerFreeLaunchStackRoutes(app")) {
  source = source.replace(
    'registerLastNineHoursRoutes(app, {',
    'registerFreeLaunchStackRoutes(app, {\n  layout,\n  brandCard,\n  linkAction\n});\n\nregisterLastNineHoursRoutes(app, {'
  );
}

if (!source.includes('href="/free-launch-stack"')) {
  source = source.replace(
    '        <a href="/pricing">Pricing</a>\n        <a href="/login">Login</a>',
    '        <a href="/pricing">Pricing</a>\n        <a href="/free-launch-stack">Free Stack</a>\n        <a href="/login">Login</a>'
  );
}

if (!source.includes('linkAction("/free-launch-stack", "Free Launch Stack")')) {
  source = source.replace(
    '        linkAction("/pricing", "View pricing"),\n        linkAction("/login", "Login"),',
    '        linkAction("/pricing", "View pricing"),\n        linkAction("/free-launch-stack", "Free Launch Stack"),\n        linkAction("/login", "Login"),'
  );
}

fs.writeFileSync(serverPath, source);
console.log("Free Launch Stack wiring applied to server.js.");

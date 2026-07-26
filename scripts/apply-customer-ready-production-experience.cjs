"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const serverPath = path.join(root, "server.js");
const templateRoot = path.join(root, "scripts", "customer-ready-templates");
const publicClientPath = path.join(root, "public", "sonara-one.js");
const publicStylePath = path.join(root, "public", "sonara-application-ui.css");
const assetVersion = "sonara-ui-20260726-customer-ready1";

function fail(message) {
  console.error(message);
  process.exit(1);
}

function read(file) {
  if (!fs.existsSync(file)) fail(`Missing required file: ${path.relative(root, file)}`);
  return fs.readFileSync(file, "utf8");
}

function template(name) {
  return read(path.join(templateRoot, `${name}.txt`)).trimEnd();
}

function replaceBetween(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  if (start === -1) fail(`Missing ${label} start marker`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (end === -1) fail(`Missing ${label} end marker`);
  const current = source.slice(start, end).trim();
  if (current === replacement.trim()) return source;
  return `${source.slice(0, start)}${replacement}\n\n${source.slice(end)}`;
}

function replaceRequired(source, previous, next, label) {
  if (source.includes(next)) return source;
  if (!source.includes(previous)) fail(`Unable to update ${label}`);
  return source.replace(previous, next);
}

function assemble(directory, output) {
  const sourceDirectory = path.join(root, directory);
  const files = fs.readdirSync(sourceDirectory)
    .filter((file) => /^99-.*\.(css|js)$/.test(file))
    .sort();
  if (!files.length) fail(`No canonical assets found in ${directory}`);
  fs.writeFileSync(output, files.map((file) => read(path.join(sourceDirectory, file))).join("\n"));
}

let server = read(serverPath);

const requireLine = 'const registerCustomerReadyExperienceRoutes = require("./routes/customer-ready-experience.cjs");';
if (!server.includes(requireLine)) {
  server = replaceRequired(
    server,
    'const registerRouteRegistryRoutes = require("./routes/sonara-route-registry-routes.cjs");',
    `const registerRouteRegistryRoutes = require("./routes/sonara-route-registry-routes.cjs");\n${requireLine}`,
    "customer-ready route import"
  );
}

const registration = `registerCustomerReadyExperienceRoutes(app, {
  layout,
  actionCard,
  brandCard,
  linkAction,
  responsePage,
  escapeHtml,
  accountNoticeCard,
  requireCustomer,
  handleEmailAuth,
  sendEmailAuthResult,
  wantsJson,
  getSupabaseAuthConfig,
  getSupabaseServerConfig,
  getPublicAppUrl,
  supabaseHeaders,
  insertActivityEvent,
  getCustomerPrimaryOrganization,
  setCustomerSessionCookies,
  verifySupabaseAccessToken,
  clearCustomerSessionCookie
});`;
if (!server.includes("registerCustomerReadyExperienceRoutes(app")) {
  server = replaceRequired(
    server,
    "registerSonaraInfrastructureRoutes(app, {",
    `${registration}\n\nregisterSonaraInfrastructureRoutes(app, {`,
    "customer-ready route registration"
  );
}

server = replaceBetween(server, "function workspaceToolPage({ slug, config, page, access, paid }) {", "function workspaceServiceCard(page, paid) {", template("workspaceToolPage"), "workspace tool page");
server = replaceBetween(server, "function workspaceServiceCard(page, paid) {", "function workspaceFormSections(page) {", template("workspaceServiceCard"), "workspace status copy");
server = replaceBetween(server, "function workspaceRecordSections(page) {", "function renderHomepageContent(readiness) {", template("workspaceRecordSections"), "workspace record copy");
server = replaceBetween(server, "function sendWorkspacePostResult(req, res, result, successTitle, backHref) {", "async function readModuleRecords(req, productKey) {", template("sendWorkspacePostResult"), "workspace save result");
server = replaceBetween(server, "async function getCustomerPrimaryOrganization(user", "async function getCustomerPaidEntitlement(user, productKey) {", template("getCustomerPrimaryOrganization"), "customer workspace lookup");
server = replaceBetween(server, "async function verifyAdminRequest(req) {", "function getBearerToken(req) {", template("verifyAdminRequest"), "single-session admin authorization");

const desktopNavPattern = /<nav class="sonara-desktop-nav" aria-label="Primary">[\s\S]*?<\/nav>/;
const desktopNav = `<nav class="sonara-desktop-nav" aria-label="Primary">
        <a href="/dashboard" data-i18n="dashboard">Workspace</a>
        <details class="sonara-workspace-menu"><summary>Workspaces</summary><div><a href="/business-builder">Business Builder</a><a href="/creator-studio">Creator Studio</a><a href="/growth-studio">Growth Studio</a></div></details>
        <a href="/free-tools" data-i18n="tools">Tools</a>
        <a href="/pricing" data-i18n="pricing">Pricing</a>
        <a href="/support" data-i18n="support">Support</a>
        <a href="/login" data-i18n="login">Log in</a>
        <a class="sonara-nav-primary" href="/signup" data-i18n="start">Create account</a>
      </nav>`;
if (!desktopNavPattern.test(server)) fail("Unable to locate desktop navigation");
server = server.replace(desktopNavPattern, desktopNav);

const motionControl = '<label class="sonara-setting-row"><span><b data-i18n="motion">Motion</b></span><input type="checkbox" data-sonara-preference="motion"></label>';
const brightnessControl = `<label class="sonara-setting-row sonara-setting-row--range"><span><b>Brightness</b><small>Adjust this device without changing your account.</small></span><span class="sonara-range-control"><input type="range" min="92" max="112" step="1" value="104" data-sonara-preference="brightness" aria-label="Interface brightness"><output data-sonara-brightness-output>104%</output></span></label>
        ${motionControl}`;
if (!server.includes('data-sonara-preference="brightness"')) server = replaceRequired(server, motionControl, brightnessControl, "brightness control");

server = server.replace(/(?:\s+data-legacy-mark="[^"]*"){2,}/g, ' data-legacy-mark="/brand/sonara-industries-mark.svg"');
server = server.replace(/sonara-ui-20260725-v6(?:-motion3)?/g, assetVersion);
server = server.replace(/Save requires account database setup\.?/gi, "Your result is ready");
server = server.replace(/Saving records depends on account database setup\.?/gi, "Signed-in work is saved automatically to your workspace.");
server = server.replace(/Setup required: organization membership is missing\.?/gi, "Your workspace is still being prepared.");
server = server.replace(/Setup required: account database is not configured\.?/gi, "Your workspace is temporarily unavailable.");
server = server.replace(/This uses server-side Supabase access only\. It never exposes service-role credentials to the browser\.?/gi, "Your workspace is protected and private.");
fs.writeFileSync(serverPath, server);

assemble(path.join("ui", "sonara", "scripts"), publicClientPath);
assemble(path.join("ui", "sonara", "styles"), publicStylePath);
console.log("SONARA customer-ready production experience applied");

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const serverPath = path.join(root, "server.js");
const clientSourcePath = path.join(root, "ui", "sonara", "scripts", "99-sonara-cinematic-system.js");
const styleSourcePath = path.join(root, "ui", "sonara", "styles", "99-sonara-cinematic-system.css");
const publicClientPath = path.join(root, "public", "sonara-one.js");
const publicStylePath = path.join(root, "public", "sonara-application-ui.css");
const assetVersion = "sonara-ui-20260725-v6-motion3";

function fail(message) {
  console.error(message);
  process.exit(1);
}

function readRequired(filePath) {
  if (!fs.existsSync(filePath)) fail(`Missing required file: ${path.relative(root, filePath)}`);
  return fs.readFileSync(filePath, "utf8");
}

function replaceRequired(source, previous, next, label) {
  if (source.includes(next)) return source;
  if (!source.includes(previous)) fail(`Unable to update ${label}`);
  return source.replace(previous, next);
}

function upsertBlock(source, startMarker, endMarker, block) {
  const start = source.indexOf(startMarker);
  if (start === -1) return `${source.trimEnd()}\n\n${block}\n`;
  const end = source.indexOf(endMarker, start);
  if (end === -1) fail(`Missing block terminator: ${endMarker}`);
  return `${source.slice(0, start)}${block}${source.slice(end + endMarker.length)}`;
}

function assemble(directory, output) {
  const sourceDirectory = path.join(root, directory);
  const allFiles = fs.readdirSync(sourceDirectory).filter((file) => /\.(css|js)$/.test(file)).sort();
  const canonicalFiles = allFiles.filter((file) => /^99-/.test(file));
  const files = canonicalFiles.length ? canonicalFiles : allFiles;
  fs.writeFileSync(output, files.map((file) => fs.readFileSync(path.join(sourceDirectory, file), "utf8")).join("\n"));
}

let server = readRequired(serverPath);
for (const [previous, next] of [
  ["/brand/sonara-industries-mark.svg", "/brand/sonara-one-mark-v3.svg"],
  ["/brand/business-builder-mark.svg", "/brand/business-builder-mark-v3.svg"],
  ["/brand/creator-studio-mark.svg", "/brand/creator-studio-mark-v3.svg"],
  ["/brand/growth-studio-mark.svg", "/brand/growth-studio-mark-v3.svg"]
]) {
  server = server.replaceAll(previous, next);
}

const loaderMarkup = `<div id="sonara-loader" class="sonara-loader" role="status" aria-live="polite" aria-label="SONARA One is loading">
      <div class="sonara-startup-shell">
        <div class="sonara-startup-stage" aria-hidden="true">
          <span class="sonara-startup-orbit sonara-startup-orbit--outer"></span>
          <span class="sonara-startup-orbit sonara-startup-orbit--inner"></span>
          <span class="sonara-startup-glow"></span>
          <span class="sonara-startup-mark-wrap">
            <img class="sonara-startup-mark sonara-startup-mark--light" src="/brand/sonara-one-mark-v3.svg" alt="">
            <img class="sonara-startup-mark sonara-startup-mark--dark" src="/brand/sonara-one-mark-v3-dark.svg" alt="">
          </span>
          <span class="sonara-startup-particle sonara-startup-particle--one"></span>
          <span class="sonara-startup-particle sonara-startup-particle--two"></span>
          <span class="sonara-startup-particle sonara-startup-particle--three"></span>
        </div>
        <div class="sonara-startup-wordmark" aria-hidden="true"><strong>SONARA</strong><span>One</span></div>
        <p class="sonara-startup-tagline">Build. Create. Grow.</p>
        <p class="sonara-loader__status" data-sonara-loader-status>Preparing your workspace</p>
        <div class="sonara-loader__track" aria-hidden="true"><span></span></div>
        <button class="sonara-loader__skip" type="button" data-sonara-loader-skip>Skip animation</button>
      </div>
    </div><div class="sonara-route-progress" aria-hidden="true"></div>`;

const loaderPattern = /<div id="sonara-loader"[\s\S]*?<div class="sonara-route-progress" aria-hidden="true"><\/div>/;
if (!loaderPattern.test(server)) fail("Unable to locate SONARA loader markup");
server = server.replace(loaderPattern, loaderMarkup);
server = server.replace(/sonara-ui-20260725-v6(?!-motion3)/g, assetVersion);
fs.writeFileSync(serverPath, server);

let client = readRequired(clientSourcePath);
client = replaceRequired(
  client,
  '  const legacyPreferenceKey = "sonara:nexus:preferences:v1";',
  '  const legacyPreferenceKey = "sonara:nexus:preferences:v1";\n  const startupKey = "sonara:startup:v3";\n  const startupStartedAt = window.performance?.now?.() || Date.now();',
  "startup state keys"
);

const startupFunction = `  /* SONARA MOTION START */
  function installStartupExperience() {
    const loader = document.querySelector("#sonara-loader");
    if (!loader) return;

    const status = loader.querySelector("[data-sonara-loader-status]");
    const skip = loader.querySelector("[data-sonara-loader-skip]");
    let firstVisit = true;
    try {
      firstVisit = window.sessionStorage.getItem(startupKey) !== "seen";
      window.sessionStorage.setItem(startupKey, "seen");
    } catch {}

    loader.dataset.mode = firstVisit ? "startup" : "route";
    if (status) status.textContent = firstVisit ? "Preparing your workspace" : "Loading SONARA One";

    let closed = false;
    const hide = () => {
      if (closed) return;
      closed = true;
      loader.classList.add("is-ready");
      root.classList.add("sonara-ready");
      window.setTimeout(() => { loader.hidden = true; }, reducedMotion ? 0 : 320);
    };

    const elapsed = (window.performance?.now?.() || Date.now()) - startupStartedAt;
    const minimum = reducedMotion ? 0 : (firstVisit ? 680 : 100);
    const finish = () => window.setTimeout(hide, Math.max(0, minimum - elapsed));

    if (document.readyState === "complete") finish();
    else window.addEventListener("load", finish, { once: true });

    window.setTimeout(hide, firstVisit ? 2600 : 1400);
    skip?.addEventListener("click", hide, { once: true });
  }
  /* SONARA MOTION END */`;

if (client.includes("  /* SONARA MOTION START */")) {
  client = upsertBlock(client, "  /* SONARA MOTION START */", "  /* SONARA MOTION END */", startupFunction);
} else {
  client = replaceRequired(client, "  function installRouteProgress() {", `${startupFunction}\n\n  function installRouteProgress() {`, "startup function insertion");
}

const oldLoaderClose = `    root.classList.add("sonara-ready");
    root.classList.remove("sonara-loading");
    const loader = document.querySelector("#sonara-loader");
    if (loader) {
      loader.classList.add("is-ready");
      window.setTimeout(() => { loader.hidden = true; }, reducedMotion ? 0 : 230);
    }`;
const newLoaderClose = `    root.classList.remove("sonara-loading");
    installStartupExperience();`;
client = replaceRequired(client, oldLoaderClose, newLoaderClose, "startup initialization");

const oldRouteProgress = `      progress?.classList.add("is-active");
      root.classList.add("sonara-leaving");`;
const newRouteProgress = `      progress?.classList.add("is-active");
      const loader = document.querySelector("#sonara-loader");
      if (loader) {
        loader.hidden = false;
        loader.dataset.mode = "route";
        loader.classList.remove("is-ready");
        const status = loader.querySelector("[data-sonara-loader-status]");
        if (status) status.textContent = "Loading SONARA One";
      }
      root.classList.add("sonara-leaving");`;
client = replaceRequired(client, oldRouteProgress, newRouteProgress, "route loading transition");
const oldPageShow = `    window.addEventListener("pageshow", () => {
      progress?.classList.remove("is-active");
      root.classList.remove("sonara-leaving");
    });`;
const newPageShow = `    window.addEventListener("pageshow", () => {
      progress?.classList.remove("is-active");
      root.classList.remove("sonara-leaving");
      const loader = document.querySelector("#sonara-loader");
      if (loader) {
        loader.classList.add("is-ready");
        loader.hidden = true;
      }
    });`;
client = replaceRequired(client, oldPageShow, newPageShow, "back-forward loader reset");
fs.writeFileSync(clientSourcePath, client);

let styles = readRequired(styleSourcePath);
const motionStyles = `/* SONARA MOTION BRAND START */
/* SONARA Motion Brand System 2026 — startup, loading, light/dark and restrained 3D */
.sonara-loader{--startup-bg:#f7f9ff;--startup-ink:#10234a;--startup-muted:#657391;--startup-line:rgba(79,111,255,.20);--startup-glow:rgba(99,102,241,.24);position:fixed;inset:0;z-index:9999;display:grid;place-items:center;overflow:hidden;padding:max(22px,env(safe-area-inset-top)) 22px max(22px,env(safe-area-inset-bottom));background:radial-gradient(circle at 50% 34%,rgba(255,255,255,.96) 0 8%,transparent 36%),radial-gradient(circle at 18% 8%,rgba(124,58,237,.13),transparent 34%),radial-gradient(circle at 86% 18%,rgba(14,165,233,.14),transparent 30%),linear-gradient(160deg,#fbfcff 0%,var(--startup-bg) 64%,#eef2ff 100%);color:var(--startup-ink);opacity:1;visibility:visible;transition:opacity .32s var(--nx-ease),visibility .32s var(--nx-ease);isolation:isolate}
html[data-theme="dark"] .sonara-loader{--startup-bg:#070a12;--startup-ink:#f8faff;--startup-muted:#9aa6bf;--startup-line:rgba(139,92,246,.28);--startup-glow:rgba(79,70,229,.42);background:radial-gradient(circle at 50% 33%,rgba(49,46,129,.28),transparent 32%),radial-gradient(circle at 18% 10%,rgba(37,99,235,.18),transparent 32%),radial-gradient(circle at 86% 18%,rgba(124,58,237,.20),transparent 30%),linear-gradient(160deg,#05070d 0%,var(--startup-bg) 64%,#0d1220 100%)}
.sonara-loader::before,.sonara-loader::after{content:"";position:absolute;inset:auto -15% -30%;height:48%;pointer-events:none;opacity:.65;filter:blur(1px)}.sonara-loader::before{background:repeating-radial-gradient(ellipse at 50% 100%,transparent 0 18px,rgba(99,102,241,.10) 19px 20px);transform:rotate(-5deg)}.sonara-loader::after{background:linear-gradient(110deg,transparent 15%,rgba(255,255,255,.32) 46%,transparent 74%);filter:blur(34px);animation:sonaraStartupSweep 4.2s ease-in-out infinite}html[data-theme="dark"] .sonara-loader::before{opacity:.34}html[data-theme="dark"] .sonara-loader::after{background:linear-gradient(110deg,transparent 15%,rgba(99,102,241,.22) 46%,transparent 74%)}
.sonara-loader.is-ready{opacity:0;visibility:hidden;pointer-events:none}.sonara-startup-shell{position:relative;z-index:2;width:min(520px,100%);display:grid;place-items:center;text-align:center}.sonara-startup-stage{position:relative;width:clamp(190px,34vw,300px);aspect-ratio:1;margin-bottom:18px;display:grid;place-items:center;perspective:900px;transform-style:preserve-3d}.sonara-startup-stage::after{content:"";position:absolute;left:20%;right:20%;bottom:5%;height:10%;border-radius:50%;background:var(--startup-glow);filter:blur(22px);transform:rotateX(72deg);animation:sonaraStartupShadow 2.4s ease-in-out infinite}
.sonara-startup-orbit{position:absolute;border:1px solid var(--startup-line);border-radius:50%;transform-style:preserve-3d}.sonara-startup-orbit--outer{inset:2%;animation:sonaraOrbitOuter 9s linear infinite}.sonara-startup-orbit--inner{inset:14%;border-width:2px;border-color:color-mix(in srgb,var(--startup-line) 74%,transparent);animation:sonaraOrbitInner 6.4s linear infinite reverse}.sonara-startup-mark-wrap{position:relative;width:58%;aspect-ratio:1;display:grid;place-items:center;transform-style:preserve-3d;animation:sonaraMarkMaterialize 2.6s var(--nx-ease) infinite alternate;filter:drop-shadow(0 28px 32px var(--startup-glow))}.sonara-startup-mark{grid-area:1/1;width:100%;height:100%;object-fit:contain;backface-visibility:hidden}.sonara-startup-mark--dark{display:none}html[data-theme="dark"] .sonara-startup-mark--light{display:none}html[data-theme="dark"] .sonara-startup-mark--dark{display:block}
.sonara-startup-glow{position:absolute;width:42%;aspect-ratio:1;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.85),var(--startup-glow) 28%,transparent 72%);filter:blur(10px);animation:sonaraGlowPulse 2.1s ease-in-out infinite}.sonara-startup-particle{position:absolute;width:8px;height:8px;border-radius:50%;background:#818CF8;box-shadow:0 0 20px 5px var(--startup-glow)}.sonara-startup-particle--one{left:8%;top:42%;animation:sonaraParticleOne 5.5s linear infinite}.sonara-startup-particle--two{right:10%;top:25%;width:6px;height:6px;background:#22D3EE;animation:sonaraParticleTwo 6.7s linear infinite}.sonara-startup-particle--three{right:20%;bottom:12%;width:5px;height:5px;background:#A78BFA;animation:sonaraParticleThree 4.8s linear infinite}
.sonara-startup-wordmark{display:flex;align-items:baseline;justify-content:center;gap:10px;color:var(--startup-ink);letter-spacing:.16em}.sonara-startup-wordmark strong{font-size:clamp(28px,6vw,48px);font-weight:780;letter-spacing:.14em}.sonara-startup-wordmark span{font-size:clamp(24px,5vw,42px);font-weight:500;letter-spacing:-.03em;background:linear-gradient(90deg,#4F6FFF,#8B5CF6,#22D3EE);-webkit-background-clip:text;background-clip:text;color:transparent}.sonara-startup-tagline{margin:8px 0 0;color:var(--startup-muted);font-size:clamp(14px,2.5vw,18px);letter-spacing:.08em}.sonara-loader__status{margin:24px 0 0;color:var(--startup-ink);font-size:14px;font-weight:720;letter-spacing:.03em}.sonara-loader__track{position:relative;width:min(320px,76vw);height:4px;margin-top:14px;overflow:hidden;border-radius:999px;background:var(--startup-line)}.sonara-loader__track span{display:block;width:42%;height:100%;border-radius:inherit;background:linear-gradient(90deg,#2563EB,#8B5CF6,#22D3EE);animation:sonaraLoaderTravel 1.15s var(--nx-ease) infinite}.sonara-loader__skip{min-height:44px;margin-top:18px;padding:8px 13px;border:1px solid var(--startup-line);border-radius:999px;background:color-mix(in srgb,var(--startup-bg) 76%,transparent);color:var(--startup-muted);box-shadow:none;font-size:12px;font-weight:720}
.sonara-loader[data-mode="route"] .sonara-startup-stage{width:120px;margin-bottom:8px}.sonara-loader[data-mode="route"] .sonara-startup-wordmark,.sonara-loader[data-mode="route"] .sonara-startup-tagline,.sonara-loader[data-mode="route"] .sonara-loader__skip{display:none}.sonara-loader[data-mode="route"] .sonara-loader__status{margin-top:10px}.sonara-product{transform-style:preserve-3d;perspective:900px}.sonara-product:hover{transform:perspective(900px) rotateX(1.4deg) rotateY(-1.8deg) translateY(-4px)}.sonara-product .sonara-product-mark{transform:translateZ(20px);filter:drop-shadow(0 12px 20px rgba(50,70,130,.14));transition:transform .28s var(--nx-ease)}.sonara-product:hover .sonara-product-mark{transform:translateZ(28px) rotate(-3deg) scale(1.04)}
@keyframes sonaraMarkMaterialize{0%{transform:rotateX(5deg) rotateY(-13deg) translateZ(8px) scale(.96)}100%{transform:rotateX(-4deg) rotateY(13deg) translateZ(36px) scale(1.04)}}@keyframes sonaraOrbitOuter{to{transform:rotateX(68deg) rotateZ(360deg)}}@keyframes sonaraOrbitInner{to{transform:rotateY(64deg) rotateZ(360deg)}}@keyframes sonaraGlowPulse{50%{transform:scale(1.18);opacity:.72}}@keyframes sonaraStartupShadow{50%{transform:rotateX(72deg) scale(.82);opacity:.45}}@keyframes sonaraLoaderTravel{0%{transform:translateX(-120%)}100%{transform:translateX(340%)}}@keyframes sonaraStartupSweep{50%{transform:translateX(18%) rotate(2deg);opacity:.3}}@keyframes sonaraParticleOne{to{transform:rotate(360deg) translateX(86px) rotate(-360deg)}}@keyframes sonaraParticleTwo{to{transform:rotate(-360deg) translateX(68px) rotate(360deg)}}@keyframes sonaraParticleThree{to{transform:rotate(360deg) translateX(54px) rotate(-360deg)}}
@media(max-width:680px){.sonara-startup-stage{width:min(230px,66vw)}.sonara-loader__skip{min-height:48px}.sonara-product:hover{transform:translateY(-2px)}}@media(prefers-reduced-motion:reduce){.sonara-loader::after,.sonara-startup-stage::after,.sonara-startup-orbit,.sonara-startup-mark-wrap,.sonara-startup-glow,.sonara-startup-particle,.sonara-loader__track span{animation:none!important}.sonara-startup-mark-wrap{transform:none}.sonara-product:hover,.sonara-product:hover .sonara-product-mark{transform:none}}@supports not (backdrop-filter:blur(1px)){.sonara-loader__skip{background:var(--startup-bg)}}
/* SONARA MOTION BRAND END */`;

styles = upsertBlock(styles, "/* SONARA MOTION BRAND START */", "/* SONARA MOTION BRAND END */", motionStyles);
fs.writeFileSync(styleSourcePath, styles);
assemble("ui/sonara/styles", publicStylePath);
assemble("ui/sonara/scripts", publicClientPath);
console.log("SONARA motion brand, startup and loading experience applied.");

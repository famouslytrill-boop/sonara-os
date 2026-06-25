const fs = require("node:fs");
const path = require("node:path");

const serverPath = path.join(process.cwd(), "server.js");
const cssPath = path.join(process.cwd(), "public", "sonara-friendly-premium.css");

let server = fs.readFileSync(serverPath, "utf8");

const oldHero = [
  '      <section class="hero">',
  '        <div class="eyebrow">${escapeHtml(eyebrow)}</div>',
  '        <h1>${escapeHtml(heading)}</h1>',
  '        <p class="lede">${escapeHtml(body)}</p>',
  '        <div class="actions">${actions.join("")}</div>',
  '      </section>'
].join("\n");

const newHero = [
  '      <section class="hero sonara-hero-stage" data-sonara-interface="live">',
  '        <div class="sonara-hero-copy">',
  '          <div class="eyebrow">${escapeHtml(eyebrow)}</div>',
  '          <h1>${escapeHtml(heading)}</h1>',
  '          <p class="lede">${escapeHtml(body)}</p>',
  '          <div class="actions">${actions.join("")}</div>',
  '        </div>',
  '        <aside class="sonara-interface-face" aria-label="SONARA interface preview">',
  '          <div class="sonara-face-orb" aria-hidden="true">',
  '            <span class="sonara-orb-core"></span>',
  '            <span class="sonara-orb-ring ring-a"></span>',
  '            <span class="sonara-orb-ring ring-b"></span>',
  '            <span class="sonara-orb-node node-a"></span>',
  '            <span class="sonara-orb-node node-b"></span>',
  '            <span class="sonara-orb-node node-c"></span>',
  '          </div>',
  '          <div class="sonara-device-card">',
  '            <div class="sonara-device-bar"><span></span><span></span><span></span></div>',
  '            <strong>SONARA Industries</strong>',
  '            <p>One bright command interface for Business Builder, Creator Studio, and Growth Studio.</p>',
  '            <div class="sonara-module-strip"><span>Business</span><span>Creator</span><span>Growth</span></div>',
  '          </div>',
  '          <div class="sonara-proof-pill">Mobile-ready • Paid-ready • Operator-controlled</div>',
  '        </aside>',
  '      </section>'
].join("\n");

if (!server.includes('data-sonara-interface="live"')) {
  if (!server.includes(oldHero)) {
    throw new Error("Could not find old hero block in server.js. Stop and inspect layout() manually.");
  }

  server = server.replace(oldHero, newHero);
}

server = server
  .replace(/href="\/sonara-brand-system\.css(?:\?v=[^"]*)?"/g, 'href="/sonara-brand-system.css?v=interface-dom-20260623"')
  .replace(/href="\/sonara-friendly-premium\.css(?:\?v=[^"]*)?"/g, 'href="/sonara-friendly-premium.css?v=interface-dom-20260623"')
  .replace(/src="\/sonara-experience\.js(?:\?v=[^"]*)?"/g, 'src="/sonara-experience.js?v=interface-dom-20260623"');

fs.writeFileSync(serverPath, server);

let css = fs.readFileSync(cssPath, "utf8");

const patch = `

/* FORCED HOMEFACE DOM REDESIGN */
.sonara-hero-stage {
  display: grid !important;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 520px) !important;
  gap: clamp(24px, 5vw, 70px) !important;
  align-items: center !important;
  min-height: 78vh !important;
  padding: clamp(48px, 7vw, 92px) !important;
  background:
    radial-gradient(circle at 18% 12%, rgba(255, 209, 102, .34), transparent 28rem),
    radial-gradient(circle at 78% 34%, rgba(94, 231, 255, .32), transparent 30rem),
    linear-gradient(135deg, rgba(255,255,255,.18), rgba(255,255,255,.055)) !important;
}

.sonara-hero-stage::before,
.sonara-hero-stage::after {
  display: none !important;
}

.sonara-hero-copy {
  position: relative !important;
  z-index: 5 !important;
}

.sonara-interface-face {
  position: relative !important;
  z-index: 4 !important;
  min-height: 560px !important;
  display: grid !important;
  place-items: center !important;
  isolation: isolate !important;
}

.sonara-interface-face::before {
  content: "SONARA\\\\A INTERFACE" !important;
  white-space: pre !important;
  position: absolute !important;
  inset: auto 0 30px auto !important;
  font-size: clamp(46px, 7vw, 104px) !important;
  line-height: .78 !important;
  font-weight: 1000 !important;
  letter-spacing: -.08em !important;
  text-align: right !important;
  color: rgba(255,255,255,.18) !important;
  z-index: 0 !important;
}

.sonara-face-orb {
  width: min(42vw, 470px) !important;
  min-width: 330px !important;
  aspect-ratio: 1 !important;
  position: relative !important;
  z-index: 2 !important;
  border-radius: 44% 56% 48% 52% / 48% 42% 58% 52% !important;
  background:
    radial-gradient(circle at 34% 38%, rgba(255,255,255,1) 0 3.5%, transparent 4.8%),
    radial-gradient(circle at 61% 36%, rgba(255,255,255,1) 0 3.5%, transparent 4.8%),
    radial-gradient(ellipse at 49% 64%, rgba(8,10,22,.92) 0 10%, transparent 11%),
    radial-gradient(circle at 50% 50%, rgba(255,255,255,.44), transparent 33%),
    repeating-radial-gradient(circle at 50% 50%, rgba(255,255,255,.40) 0 1px, transparent 2px 9px),
    conic-gradient(from 210deg, #ffd166, #ff7a66, #ff79c6, #b693ff, #5ee7ff, #8ff7b8, #ffd166) !important;
  box-shadow:
    0 0 0 1px rgba(255,255,255,.35) inset,
    0 34px 110px rgba(94,231,255,.32),
    0 34px 110px rgba(255,121,198,.28) !important;
  transform: rotate(-8deg) !important;
}

.sonara-orb-core,
.sonara-orb-ring,
.sonara-orb-node {
  position: absolute !important;
  display: block !important;
  pointer-events: none !important;
}

.sonara-orb-core {
  inset: 25% !important;
  border-radius: 999px !important;
  border: 1px solid rgba(255,255,255,.36) !important;
  background: radial-gradient(circle, rgba(255,255,255,.28), transparent 62%) !important;
}

.sonara-orb-ring {
  inset: 9% !important;
  border-radius: 999px !important;
  border: 1px solid rgba(255,255,255,.26) !important;
}

.ring-b {
  inset: 17% !important;
  transform: rotate(32deg) !important;
  border-color: rgba(255,209,102,.35) !important;
}

.sonara-orb-node {
  width: 14px !important;
  height: 14px !important;
  border-radius: 999px !important;
  background: #fff !important;
  box-shadow: 0 0 22px rgba(255,255,255,.85) !important;
}

.node-a { left: 14%; top: 36%; }
.node-b { right: 14%; top: 28%; }
.node-c { right: 28%; bottom: 16%; }

.sonara-device-card {
  position: absolute !important;
  left: -4% !important;
  bottom: 2% !important;
  z-index: 3 !important;
  max-width: 310px !important;
  padding: 22px !important;
  border-radius: 26px !important;
  border: 1px solid rgba(255,255,255,.26) !important;
  background: rgba(14, 13, 28, .72) !important;
  backdrop-filter: blur(22px) saturate(1.3) !important;
  box-shadow: 0 28px 80px rgba(0,0,0,.38) !important;
}

.sonara-device-bar {
  display: flex !important;
  gap: 7px !important;
  margin-bottom: 16px !important;
}

.sonara-device-bar span {
  width: 10px !important;
  height: 10px !important;
  border-radius: 999px !important;
  background: #ffd166 !important;
}

.sonara-device-card strong {
  display: block !important;
  font-size: 28px !important;
  letter-spacing: -.05em !important;
  color: #fffdf7 !important;
}

.sonara-device-card p {
  margin: 8px 0 14px !important;
  color: rgba(255,253,247,.80) !important;
}

.sonara-module-strip {
  display: flex !important;
  flex-wrap: wrap !important;
  gap: 8px !important;
}

.sonara-module-strip span,
.sonara-proof-pill {
  border: 1px solid rgba(255,255,255,.22) !important;
  border-radius: 999px !important;
  padding: 8px 10px !important;
  color: #fffdf7 !important;
  background: rgba(255,255,255,.10) !important;
  font-size: 12px !important;
  font-weight: 850 !important;
}

.sonara-proof-pill {
  position: absolute !important;
  right: 0 !important;
  top: 8% !important;
  z-index: 4 !important;
  background: linear-gradient(135deg, rgba(255,209,102,.26), rgba(94,231,255,.18)) !important;
}

@media (max-width: 980px) {
  .sonara-hero-stage {
    grid-template-columns: 1fr !important;
    padding-bottom: 38px !important;
  }

  .sonara-interface-face {
    min-height: 440px !important;
  }

  .sonara-face-orb {
    width: min(78vw, 390px) !important;
    min-width: 280px !important;
  }

  .sonara-device-card {
    left: 4% !important;
    bottom: 0 !important;
  }
}
`;

if (!css.includes("FORCED HOMEFACE DOM REDESIGN")) {
  css += patch;
}

fs.writeFileSync(cssPath, css);

console.log("SONARA homepage hard interface DOM patch applied.");



"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const serverPath = path.join(root, "server.js");
const clientSourcePath = path.join(root, "ui", "sonara", "scripts", "99-sonara-cinematic-system.js");
const styleSourcePath = path.join(root, "ui", "sonara", "styles", "99-sonara-cinematic-system.css");
const publicClientPath = path.join(root, "public", "sonara-one.js");
const publicStylePath = path.join(root, "public", "sonara-application-ui.css");
const assetVersion = "sonara-ui-20260725-v7";

function fail(message) {
  console.error(message);
  process.exit(1);
}

function readRequired(filePath) {
  if (!fs.existsSync(filePath)) fail(`Missing required file: ${path.relative(root, filePath)}`);
  return fs.readFileSync(filePath, "utf8");
}

function replaceText(source, previous, next, label) {
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

const homeContent = `<div class="sonara-home sonara-conversion-home">
  <section class="sonara-launch-boundary" aria-label="Product availability">
    <div><span class="sonara-kicker">Transparent availability</span><strong>Use what works today. See what still needs setting up or checking.</strong></div>
    <p>What you can open depends on how far along a product is, which accounts you have connected, and your plan. Anything that is not finished stays closed until it genuinely works.</p>
    <div class="card-actions"><a class="action" href="/service-catalog">Review product status</a><a class="action" href="/readiness">See what is working</a></div>
  </section>

  <section class="sonara-section" aria-labelledby="companies-heading">
    <div class="sonara-section-head"><div><span class="sonara-kicker" data-i18n="productsKicker">Three connected companies</span><h2 id="companies-heading" data-i18n="productsHeading">Choose the studio that matches the work.</h2></div><p data-i18n="productsBody">Each company does one clear job in its own way, and tells you honestly what is ready, while your login, billing, records, and support stay shared.</p></div>
    <div class="sonara-product-grid">
      <article class="sonara-product sonara-product--forge"><div class="sonara-product-meta"><img class="sonara-product-mark" src="/brand/business-builder-mark.svg" alt=""><span class="sonara-product-index">LAUNCH · SELL · OPERATE</span></div><h3>Business Builder</h3><p>Turn an offer into an organised business, with a setup plan, customer enquiries, quotes, billing, bookings, and your records in one place.</p><ul class="sonara-feature-list"><li>Build the offer and operating plan</li><li>Move toward the first completed transaction</li><li>Keep setup and compliance boundaries visible</li></ul><a href="/business-builder">Explore Business Builder</a></article>
      <article class="sonara-product sonara-product--canvas"><div class="sonara-product-meta"><img class="sonara-product-mark" src="/brand/creator-studio-mark.svg" alt=""><span class="sonara-product-index">BRAND · CREATE · RELEASE</span></div><h3>Creator Studio</h3><p>Organize brand assets, content projects, release packages, rights notes, collaborators, commerce, and creator-owned audience records.</p><ul class="sonara-feature-list"><li>Keep assets and projects portable</li><li>Make rights and collaborator notes explicit</li><li>Prepare releases without fake clearance claims</li></ul><a href="/creator-studio">Explore Creator Studio</a></article>
      <article class="sonara-product sonara-product--signal"><div class="sonara-product-meta"><img class="sonara-product-mark" src="/brand/growth-studio-mark.svg" alt=""><span class="sonara-product-index">CONSENT · MEASURE · GROW</span></div><h3>Growth Studio</h3><p>Connect consented customer records to campaigns, journeys, reviews, referrals, partnerships, attribution evidence, and provider diagnostics.</p><ul class="sonara-feature-list"><li>Use first-party customer evidence</li><li>Keep outreach and publishing approval-gated</li><li>Measure without guaranteed-placement claims</li></ul><a href="/growth-studio">Explore Growth Studio</a></article>
    </div>
  </section>

  <section class="sonara-section" aria-labelledby="outcomes-heading">
    <div class="sonara-section-head"><div><span class="sonara-kicker">Customer outcomes</span><h2 id="outcomes-heading">Professional systems built around the result you need next.</h2></div><p>SONARA is designed for founders, creators, and small teams that need a useful path forward without an enterprise budget or an enterprise maze.</p></div>
    <div class="sonara-outcome-grid">
      <article class="sonara-outcome"><span class="sonara-outcome-label">Business</span><h3>Reach the first real transaction.</h3><p>Clarify the offer, collect the right customer information, prepare payment and booking paths, and preserve operating evidence.</p></article>
      <article class="sonara-outcome"><span class="sonara-outcome-label">Creator</span><h3>Turn creative work into a release-ready package.</h3><p>Keep assets, rights notes, collaborators, deliverables, offers, and export materials connected without pretending clearance is automatic.</p></article>
      <article class="sonara-outcome"><span class="sonara-outcome-label">Growth</span><h3>Grow from consented customer evidence.</h3><p>Plan follow-up, campaigns, partnerships, reviews, and measurement while keeping sending, spending, and publishing under human control.</p></article>
    </div>
  </section>

  <section class="sonara-section sonara-flow" aria-labelledby="connected-path-heading">
    <div><span class="sonara-kicker" data-i18n="flowKicker">One connected operating path</span><h2 id="connected-path-heading" data-i18n="flowHeading">Move from first setup to measurable progress.</h2><p>One account connects the three companies, but each workspace remains focused. You always see where things stand, what to do next, and what has to be true before anything can run.</p><div class="card-actions"><a class="action" href="/start">See how SONARA works</a><a class="action" href="/about">Why SONARA exists</a><a class="action" href="/trust">Review the trust model</a></div></div>
    <ol class="sonara-path-list"><li><span>01</span><div><strong>Choose the outcome</strong><small>Enter the company designed for the work in front of you.</small></div></li><li><span>02</span><div><strong>Complete guided setup</strong><small>Anything missing stays visible: records, connected accounts, permissions, and plan.</small></div></li><li><span>03</span><div><strong>Review before execution</strong><small>Payments, publishing, outreach, and anything you cannot undo wait for your approval.</small></div></li><li><span>04</span><div><strong>Measure the real result</strong><small>Your saved records, proof of delivery, billing, and next steps all stay joined up.</small></div></li></ol>
  </section>

  <section class="sonara-section" aria-labelledby="lifecycle-heading">
    <div class="sonara-section-head"><div><span class="sonara-kicker">Honest about what is ready</span><h2 id="lifecycle-heading">Being listed here does not mean it is finished.</h2></div><p>We show what is coming as well as what is done, and we label the difference, so nothing on the roadmap gets sold to you as finished.</p></div>
    <div class="sonara-lifecycle-grid">
      <article class="sonara-lifecycle-card" data-lifecycle="available"><span>Active or beta</span><h3>You can get real work done</h3><p>You can do the main work now, once your account is set up and your plan covers it.</p></article>
      <article class="sonara-lifecycle-card" data-lifecycle="setup"><span>Setup required</span><h3>A little setup first</h3><p>Some setup has to be finished first: a connected account, your records, or your customer details.</p></article>
      <article class="sonara-lifecycle-card" data-lifecycle="restricted"><span>Coming soon, or in review</span><h3>Not open yet</h3><p>These stay closed until the work is built, tested, security-checked, approved, and covered by your plan.</p></article>
    </div>
  </section>

  <section class="sonara-section sonara-value-section" aria-labelledby="value-heading">
    <div class="sonara-value-copy"><span class="sonara-kicker">Professional tools at a price that works</span><h2 id="value-heading">Start free. Pay for what is proven to work, not vague promises.</h2><p>What you pay for and what you can open have to match. Where a connected service costs extra we say so, and we do not advertise an unfinished paid feature as working.</p><div class="card-actions"><a class="action" href="/pricing">Compare plans</a><a class="action" href="/signup">Create a free account</a></div></div>
    <aside class="sonara-proof-policy"><strong>Proof policy</strong><p>SONARA does not publish fake testimonials, invented customer counts, fictional awards, guaranteed revenue, false scarcity, or unsupported compliance and security claims.</p><a href="/trust">Read the evidence and approval standards →</a></aside>
  </section>

  <section class="sonara-section sonara-faq" aria-label="Common questions">
    <div class="sonara-section-head"><div><span class="sonara-kicker">Common questions</span><h2>Know the boundaries before you sign up.</h2></div><p>Straight answers about what is free, what is paid, what is ready, and what happens to your data.</p></div>
    <div class="sonara-faq-list">
      <details><summary>What is SONARA Industries?</summary><p>SONARA Industries is the parent company connecting Business Builder, Creator Studio, and Growth Studio through shared identity, billing, records, evidence, and support.</p></details>
      <details><summary>Can I start without paying?</summary><p>Yes. Free tools and account setup can be used without a card where offered. We only advertise a paid feature as working once a real payment has actually unlocked it.</p></details>
      <details><summary>Does everything in the catalog work today?</summary><p>No. Every product says where it stands. Anything marked coming soon, in review, or needs setup stays closed until it genuinely works.</p></details>
      <details><summary>Will SONARA send messages, publish content, or spend money automatically?</summary><p>No. Outreach, publishing, payments, running a connected service, and anything you cannot undo all wait for your permission and approval.</p></details>
      <details><summary>Does SONARA guarantee revenue, compliance, security, or search placement?</summary><p>No. SONARA gives you the tools, the records, and the steps. It cannot promise you sales, keep you legal, make you secure, or get you ranked.</p></details>
      <details><summary>How is organization data handled?</summary><p>Your records belong to your organisation and are private by default. Only people you have given a role to can reach them.</p></details>
    </div>
  </section>

  <section class="sonara-cta"><div><span class="sonara-kicker" data-i18n="ctaKicker">Start with the next real step</span><h2 data-i18n="ctaHeading">Create a free account. Add paid tools only once they are proven to work.</h2><p>Pick the workspace that fits the job, work through the setup honestly, and keep every important action under your control.</p></div><div class="card-actions"><a class="action" href="/signup">Create free account</a><a class="action" href="#companies-heading">Explore the studios</a><a class="action" href="/pricing">Compare plans</a></div></section>
</div>`;

let serverSource = readRequired(serverPath);
const rootRoute = `app.get("/", (req, res) => {
  return res.status(200).type("html").send(layout({
    title: "SONARA Industries | Build. Create. Grow.",
    eyebrow: "Build. Create. Grow.",
    heading: "Launch your work. Run it professionally. Grow with evidence.",
    variant: "home",
    body: "Business Builder, Creator Studio, and Growth Studio give founders, creators, and small teams focused tools inside one connected account.",
    sections: [${JSON.stringify(homeContent)}],
    actions: [linkAction("/signup", "Create free account"), linkAction("#companies-heading", "Explore the three studios"), linkAction("/pricing", "Compare plans")]
  }));
});`;

const rootPattern = /app\.get\("\/", \(req, res\) => \{[\s\S]*?\n\}\);\n\nregisterProduct\("business-builder"/;
if (!rootPattern.test(serverSource)) fail("Unable to locate the public homepage route");
serverSource = serverSource.replace(rootPattern, `${rootRoute}\n\nregisterProduct("business-builder"`);
serverSource = serverSource.replace(/sonara-ui-\d{8}-v\d+/g, assetVersion);
fs.writeFileSync(serverPath, serverSource);

let clientSource = readRequired(clientSourcePath);
const translations = [
  ["Build, create, and grow—without losing control.", "Launch your work. Run it professionally. Grow with evidence.", "English hero heading"],
  ["Business Builder, Creator Studio, and Growth Studio — one account, three focused workspaces, and honest status every step of the way.", "Business Builder, Creator Studio, and Growth Studio give founders, creators, and small teams focused tools inside one connected account.", "English hero body"],
  ["One system. Three focused ways to move.", "Choose the studio that matches the work.", "English company heading"],
  ["Each company keeps its own workflows and records while identity, access, billing, support, and delivery remain connected through SONARA One.", "Each company does one clear job in its own way, and tells you honestly what is ready, while your login, billing, records, and support stay shared.", "English company body"],
  ["Designed for real operations", "One connected operating path", "English flow kicker"],
  ["Move from intention to evidence-backed action.", "Move from first setup to measurable progress.", "English flow heading"],
  ["Start with useful work", "Start with the next real step", "English CTA kicker"],
  ["Begin free. Add depth when the work demands it.", "Create a free account. Add paid tools only once they are proven to work.", "English CTA heading"],

  ["Construye, crea y crece sin perder el control.", "Lanza tu trabajo. Opéralo profesionalmente. Crece con evidencia.", "Spanish hero heading"],
  ["Business Builder, Creator Studio y Growth Studio: una cuenta, tres espacios de trabajo y un estado honesto en cada paso.", "Business Builder, Creator Studio y Growth Studio ofrecen a fundadores, creadores y equipos pequeños herramientas enfocadas dentro de una sola cuenta conectada.", "Spanish hero body"],
  ["Un sistema. Tres formas enfocadas de avanzar.", "Elige el estudio que corresponde al trabajo.", "Spanish company heading"],
  ["Cada empresa conserva sus flujos y registros mientras identidad, acceso, facturación, soporte y entrega permanecen conectados.", "Cada empresa tiene una función clara, su propio flujo y disponibilidad honesta, mientras identidad, facturación, evidencia y soporte permanecen conectados.", "Spanish company body"],
  ["Diseñado para operaciones reales", "Una ruta operativa conectada", "Spanish flow kicker"],
  ["Pasa de la intención a una acción respaldada por evidencia.", "Pasa de la configuración inicial al progreso medible.", "Spanish flow heading"],
  ["Empieza con trabajo útil", "Empieza con el siguiente paso real", "Spanish CTA kicker"],
  ["Comienza gratis. Añade profundidad cuando el trabajo lo exija.", "Crea una cuenta gratis. Añade sistemas de pago solo cuando estén verificados.", "Spanish CTA heading"],

  ["Construisez, créez et développez sans perdre le contrôle.", "Lancez votre travail. Gérez-le professionnellement. Progressez avec des preuves.", "French hero heading"],
  ["Business Builder, Creator Studio et Growth Studio : un compte, trois espaces de travail et un statut honnête à chaque étape.", "Business Builder, Creator Studio et Growth Studio offrent aux fondateurs, créateurs et petites équipes des outils ciblés dans un compte connecté.", "French hero body"],
  ["Un système. Trois façons ciblées d’avancer.", "Choisissez le studio adapté au travail.", "French company heading"],
  ["Chaque entreprise conserve ses flux et ses données tandis que l’identité, l’accès, la facturation, l’assistance et la livraison restent connectés.", "Chaque entreprise a une mission claire, son propre flux et une disponibilité honnête, tandis que l’identité, la facturation, les preuves et l’assistance restent connectées.", "French company body"],
  ["Conçu pour les opérations réelles", "Un parcours opérationnel connecté", "French flow kicker"],
  ["Passez de l’intention à l’action fondée sur des preuves.", "Passez de la configuration initiale à des progrès mesurables.", "French flow heading"],
  ["Commencez par un travail utile", "Commencez par la prochaine étape réelle", "French CTA kicker"],
  ["Commencez gratuitement. Ajoutez de la profondeur au bon moment.", "Créez un compte gratuit. Ajoutez des systèmes payants uniquement après vérification.", "French CTA heading"],

  ["Bauen, gestalten und wachsen—ohne die Kontrolle zu verlieren.", "Starten Sie Ihre Arbeit. Führen Sie sie professionell. Wachsen Sie mit Nachweisen.", "German hero heading"],
  ["Business Builder, Creator Studio und Growth Studio: ein Konto, drei fokussierte Arbeitsbereiche und ehrlicher Status bei jedem Schritt.", "Business Builder, Creator Studio und Growth Studio bieten Gründern, Kreativen und kleinen Teams fokussierte Werkzeuge in einem verbundenen Konto.", "German hero body"],
  ["Ein System. Drei fokussierte Wege nach vorn.", "Wählen Sie das Studio, das zur Aufgabe passt.", "German company heading"],
  ["Jedes Unternehmen behält seine Abläufe und Daten, während Identität, Zugriff, Abrechnung, Support und Lieferung verbunden bleiben.", "Jedes Unternehmen hat eine klare Aufgabe, einen eigenen Ablauf und ehrliche Verfügbarkeit, während Identität, Abrechnung, Nachweise und Support verbunden bleiben.", "German company body"],
  ["Für echte Abläufe entwickelt", "Ein verbundener Betriebsweg", "German flow kicker"],
  ["Von der Absicht zur nachweisbaren Handlung.", "Von der ersten Einrichtung zu messbarem Fortschritt.", "German flow heading"],
  ["Mit sinnvoller Arbeit beginnen", "Mit dem nächsten echten Schritt beginnen", "German CTA kicker"],
  ["Kostenlos starten. Tiefe hinzufügen, wenn sie gebraucht wird.", "Erstellen Sie ein kostenloses Konto. Fügen Sie bezahlte Systeme erst nach der Verifizierung hinzu.", "German CTA heading"],

  ["Construa, crie e cresça sem perder o controle.", "Lance seu trabalho. Opere profissionalmente. Cresça com evidências.", "Portuguese hero heading"],
  ["Business Builder, Creator Studio e Growth Studio: uma conta, três espaços de trabalho e status honesto em cada etapa.", "Business Builder, Creator Studio e Growth Studio oferecem a fundadores, criadores e pequenas equipes ferramentas focadas em uma conta conectada.", "Portuguese hero body"],
  ["Um sistema. Três maneiras focadas de avançar.", "Escolha o estúdio que corresponde ao trabalho.", "Portuguese company heading"],
  ["Cada empresa mantém seus próprios fluxos e registros enquanto identidade, acesso, cobrança, suporte e entrega permanecem conectados.", "Cada empresa tem uma função clara, seu próprio fluxo e disponibilidade honesta, enquanto identidade, cobrança, evidências e suporte permanecem conectados.", "Portuguese company body"],
  ["Criado para operações reais", "Um caminho operacional conectado", "Portuguese flow kicker"],
  ["Passe da intenção para uma ação baseada em evidências.", "Passe da configuração inicial para um progresso mensurável.", "Portuguese flow heading"],
  ["Comece com trabalho útil", "Comece com o próximo passo real", "Portuguese CTA kicker"],
  ["Comece grátis. Adicione profundidade quando o trabalho exigir.", "Crie uma conta gratuita. Adicione sistemas pagos somente quando forem verificados.", "Portuguese CTA heading"]
];
for (const [previous, next, label] of translations) clientSource = replaceText(clientSource, previous, next, label);
fs.writeFileSync(clientSourcePath, clientSource);

let styleSource = readRequired(styleSourcePath);
const cssStart = "/* SONARA Premium Conversion Experience 2026 */";
const cssEnd = "/* END SONARA Premium Conversion Experience 2026 */";
const cssBlock = `${cssStart}
.sonara-conversion-home{gap:18px}
.sonara-launch-boundary{margin:8px 0 24px;padding:20px 22px;display:grid;grid-template-columns:minmax(0,.85fr) minmax(280px,1.15fr) auto;gap:22px;align-items:center;border:1px solid color-mix(in srgb,var(--nx-warning) 28%,var(--nx-line));border-radius:var(--nx-radius);background:color-mix(in srgb,var(--nx-warning) 5%,var(--nx-surface));box-shadow:var(--nx-shadow)}
.sonara-launch-boundary strong{display:block;color:var(--nx-ink);font-size:17px;line-height:1.35}.sonara-launch-boundary p{margin:0}.sonara-launch-boundary .sonara-kicker{margin-bottom:7px}.sonara-launch-boundary .card-actions{justify-content:flex-end}
.sonara-feature-list{margin:0 0 24px;padding:0;display:grid;gap:8px;list-style:none}.sonara-feature-list li{position:relative;padding-left:19px;color:var(--nx-muted);font-size:13px;line-height:1.5}.sonara-feature-list li::before{content:"";position:absolute;left:0;top:.62em;width:7px;height:7px;border-radius:50%;background:var(--product-accent,var(--nx-violet))}
.sonara-outcome-grid,.sonara-lifecycle-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px}
.sonara-outcome,.sonara-lifecycle-card{min-width:0;padding:24px;border:1px solid var(--nx-line);border-radius:var(--nx-radius);background:var(--nx-surface);box-shadow:var(--nx-shadow)}
.sonara-outcome-label,.sonara-lifecycle-card>span{display:inline-flex;margin-bottom:18px;color:var(--nx-violet);font:800 10px/1.2 var(--nx-mono);letter-spacing:.12em;text-transform:uppercase}.sonara-outcome h3,.sonara-lifecycle-card h3{margin-bottom:8px}.sonara-outcome p,.sonara-lifecycle-card p{margin-top:0}
.sonara-path-list{margin:0;padding:0;display:grid;gap:1px;border:1px solid var(--nx-line);border-radius:var(--nx-radius);overflow:hidden;background:var(--nx-line);list-style:none}.sonara-path-list li{min-width:0;padding:18px;display:grid;grid-template-columns:42px 1fr;gap:14px;align-items:start;background:var(--nx-surface)}.sonara-path-list>li>span{display:grid;place-items:center;width:38px;height:38px;border-radius:11px;background:var(--nx-surface-2);color:var(--nx-violet);font:800 10px var(--nx-mono)}.sonara-path-list strong{display:block;color:var(--nx-ink)}.sonara-path-list small{display:block;margin-top:4px;line-height:1.55}
.sonara-lifecycle-card[data-lifecycle="available"]{border-top:4px solid var(--nx-success)}.sonara-lifecycle-card[data-lifecycle="setup"]{border-top:4px solid var(--nx-warning)}.sonara-lifecycle-card[data-lifecycle="restricted"]{border-top:4px solid var(--nx-danger)}
.sonara-value-section{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(300px,.72fr);gap:28px;align-items:start}.sonara-proof-policy{padding:24px;border:1px solid var(--nx-line);border-radius:var(--nx-radius);background:var(--nx-surface-2)}.sonara-proof-policy strong{color:var(--nx-ink);font-size:18px}.sonara-proof-policy p{margin-top:9px}.sonara-proof-policy a{display:inline-flex;margin-top:17px;color:var(--nx-ink);font-weight:800;text-decoration:none}
@media(max-width:980px){.sonara-launch-boundary{grid-template-columns:1fr 1fr}.sonara-launch-boundary .card-actions{grid-column:1/-1;justify-content:flex-start}.sonara-outcome-grid,.sonara-lifecycle-grid{grid-template-columns:1fr 1fr}.sonara-value-section{grid-template-columns:1fr}}
@media(max-width:680px){.sonara-home-v3 .sonara-hero-scene{display:none}.sonara-home-v3 .hero{min-height:auto;padding:36px 0 30px}.sonara-launch-boundary{margin-top:0;padding:18px;grid-template-columns:1fr;gap:14px}.sonara-launch-boundary .card-actions{grid-column:auto}.sonara-outcome-grid,.sonara-lifecycle-grid{grid-template-columns:1fr}.sonara-outcome,.sonara-lifecycle-card{padding:20px}.sonara-path-list li{grid-template-columns:38px 1fr;padding:16px}.sonara-value-section{gap:18px}.action,button,.button,[class*="btn"],input[type="submit"],input[type="button"],.sonara-icon-button,.sonara-mobile-menu>summary,.sonara-account-menu summary{min-height:48px}.sonara-brand-copy small{display:none}}
@media(max-width:420px){.sonara-launch-boundary,.sonara-outcome,.sonara-lifecycle-card,.sonara-proof-policy{border-radius:14px}.sonara-path-list li{grid-template-columns:1fr}.sonara-path-list>li>span{width:34px;height:34px}}
${cssEnd}`;
styleSource = upsertBlock(styleSource, cssStart, cssEnd, cssBlock);
fs.writeFileSync(styleSourcePath, styleSource);

fs.writeFileSync(publicClientPath, clientSource);
fs.writeFileSync(publicStylePath, styleSource);

console.log("SONARA premium conversion and mobile experience applied.");

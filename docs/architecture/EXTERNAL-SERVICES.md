# Connecting this application to services you run

Written 12 August 2026, after the first adapter hit the constraint that
governs all of them.

---

## The constraint

This application deploys to Vercel as serverless functions. Every service in
the adapter family — Ollama, Langflow, Open WebUI, Crawl4AI — is something you
run yourself, and the default place people run them is their own machine.

**A serverless function cannot reach your machine.** `http://localhost:11434`
in production resolves to the function's own container, where nothing is
listening. It is not a firewall problem and no setting fixes it: the code is
executing somewhere else entirely.

Every adapter checks for this at configuration time and names it, rather than
letting it arrive as a timeout weeks later.

## Three ways to fix it, in the order I would try them

### 1 — A tunnel (fastest, no architecture change)

A tunnel runs a small agent next to your service that makes an **outbound**
connection to a provider's edge, and the provider gives you a public hostname
that rides that connection back. No open ports, no static IP, no port
forwarding, and the TLS certificate is handled for you.

**Cloudflare Tunnel** is the one I would start with. `cloudflared` creates an
outbound-only connection, and exposing a local service through a public
hostname is available on the free plan. A quick tunnel gives you a random
`trycloudflare.com` address for testing; a named tunnel gives you a stable
hostname on a domain you control, plus Access policies in front of it.

**Tailscale Funnel** is the other. It publishes a service from your tailnet to
the public internet on port 443 with an automatically provisioned certificate
you never touch.

**Do not skip the access control.** A tunnel makes your service reachable by
everyone, not only by this application. Ollama and Crawl4AI have no
authentication of their own. Put Cloudflare Access, a Tailscale ACL, or at
minimum a shared secret in front of anything you expose — otherwise you have
published an open model endpoint and, in Crawl4AI's case, an open URL fetcher
that anybody can point at anything.

Cost: free at this scale on both. Effort: minutes. Downside: your traffic
crosses a third party's edge.

### 2 — Run the service somewhere the server can already reach

A small VPS, a container on a host with a public hostname, or a managed
container service. Point `SONARA_*_URL` at it and the reachability problem does
not exist.

Cost: whatever the host costs — this is the option that stops being free.
Effort: an afternoon. Upside: no third party in the path, and the service is up
whether or not your laptop is.

### 3 — Self-host this application beside the service

The one that removes the constraint rather than working around it. This
application is a plain Express server — `server.js` with no bundler and no
build step, which `api/index.js` wraps for Vercel. It runs under `node
server.js` anywhere Node runs.

Put it and your services on one Docker network and `http://ollama:11434`
resolves, with no tunnel and nothing public.

What you give up: Vercel's edge, its deploy pipeline, and the preview
deployments the release process currently checks. What you gain: services that
never leave your network, and no per-request cold start in front of a model
call.

**This is the only option that also unblocks the wider integration question.**
Several of the 53 permissively-licensed repositories in `data/open-source-tools.ts`
are not libraries you import — they are whole applications on other stacks:
Dify and Langflow are Python, Chatwoot is Rails, TastyIgniter is PHP. They can
never be `require`d into a CommonJS Express app regardless of licence. As
neighbouring services on a shared network, called through adapters, all of them
become reachable.

## How to add an adapter

`lib/sonara-service-adapter.cjs` holds everything the four have in common, so a
new one is small and cannot be quietly less careful than the others.

```js
const base = require("./sonara-service-adapter.cjs");

const ENV_KEYS = base.envKeysFor("SONARA_THING", ["model"]);

function getThingReadiness(options = {}) {
  return base.readinessFor({ label: "Thing", prefix: "SONARA_THING", required: ["model"], ...options });
}

async function ask(prompt, { readiness = getThingReadiness(), fetchImpl = fetch } = {}) {
  const called = await base.postJson(readiness, "/api/generate", { prompt }, { fetchImpl });
  if (!called.ok) return called;
  // …read the answer out of called.data, optional-chained rather than assumed
}
```

You get, without writing them: `SONARA_THING_ENABLED` / `_URL` / `_TIMEOUT_MS`
naming, placeholder rejection, URL validation, the loopback-on-serverless
check, timeout bounds, and the rule that a fetch error message is never passed
through — because it contains the configured URL.

`tests/service-adapters.test.js` runs the same rules against every adapter in
its `ADAPTERS` list, and asserts the list length, so adding an adapter without
adding it there fails.

### Four rules an adapter must follow

**Off by default.** Absent configuration it reports setup-required, and no page
may notice.

**Never a dependency.** Every caller keeps the deterministic path it already
had. A service being unreachable must never be the difference between a page
working and a page failing — which is why the record checks, the money figures
and the chase drafts are all still arithmetic over the owner's own rows.

**Never render configuration.** Readiness reports a host, never a URL, and the
URL is carried non-enumerably so `JSON.stringify` cannot reach it. A base URL
can carry a token in its query string. Open WebUI's API key gets the same
treatment.

**Validate anything that becomes part of a request.** A flow id goes into a
path, so Langflow checks it is a plain identifier — otherwise a configured
value addresses a different endpoint on the same host, with this server making
the request. A crawl target is worse: Crawl4AI refuses loopback, link-local,
cloud-metadata and private ranges, and refuses a URL carrying credentials,
because a URL somebody supplies plus a server that fetches it is a request
forwarder with this application's network position behind it.

The limit worth stating: those checks read the URL as written. A public
hostname that **resolves** to a private address is the case they cannot see
from here, and it needs the service itself to be network-isolated.

## What this does not solve

Licence, mostly. An adapter calls a service over HTTP; it does not copy anyone's
code, which is why Apache and MIT services need nothing beyond attribution. The
19 reciprocal repositories were a separate decision, and it has now been taken
— see below.

Cost. Every one of these is free because it runs on hardware you already pay
for. A hosted model API behind the same adapter would be metered, and that
changes what may depend on it.

---

## The reciprocal decision, and what it settled

Asked on 18 August 2026, decided the same day: **install what can be installed
without changing SONARA's own licence, and install nothing that would change
it.** The 19 reciprocal repositories in `data/open-source-tools.ts` were
enumerated and worked through against that rule. Three things came out of it,
and two were surprises.

**Most of them are not things you install.** Eleven are whole applications in
four different language runtimes — C#/.NET, PHP, Rust, Python — and this is
Express CommonJS on Vercel with no build step. Three are reference material with
no installable artifact. Exactly one, HyperFormula, is a library this runtime
could load. So the licence was never the binding constraint for fourteen of the
seventeen; the runtime was.

**The one browser-automation candidate is a worse-licensed duplicate.**
Figranium is GPL-3.0 and does what `lib/sonara-crawl4ai-adapter.cjs` already
does — fetch a page, get readable text back — except Crawl4AI is Apache-2.0,
already built, already called from `routes/market-intelligence-routes.cjs`, and
already refuses loopback, link-local, cloud-metadata and private ranges. Adopting
Figranium would trade a permissive licence for a reciprocal one and gain nothing.
That is the single clearest result of the exercise and it is a reason not to
build, which is the kind of result that does not announce itself.

**The AGPL and OSL ones stay untouched, and the reason is not a legal opinion.**
Eleven of the seventeen are AGPL-3.0 or OSL-3.0. `CLAUDE.md` takes the
conservative reading — that a reciprocal licence triggers on network use and so
reaches a hosted product — and nothing here loosens it. Whether an AGPL service
held at arm's length behind an HTTP boundary is genuinely separable is a
question for a lawyer and not for this file. The arrangement below is proposed
only for the plain-GPL ones, where the separation is the settled reading.

### What that leaves

| Repository | Licence | Outcome |
| --- | --- | --- |
| HyperFormula | GPL-3.0 **or** commercial | The only real candidate. Two non-reciprocal routes: buy the vendor licence, or run it as a service this application calls. Blocked on a price nobody has asked for — see `docs/owner/OWNER-STEPS.md`. |
| Flox | GPL-2.0 | Already usable today, and no adapter is possible or needed. Using a GPL tool to build software does not make the software GPL; the obligation follows the code you ship, not the compiler you ran. |
| Figranium, Figranium MCP | GPL-3.0 | Not adopted. Crawl4AI already covers it under Apache-2.0. |
| NautilusTrader, Self-Driving Car | LGPL-3.0, GPL-3.0 | No product fit. A trading engine and a video-game driving model. |
| The other 11 | AGPL-3.0 / OSL-3.0 | Untouched, per the paragraph above. |

**Nothing was installed, and that is the finished state of this decision rather
than a deferral.** The register records why for each one. If a calculated-field
surface is ever built, HyperFormula is the first thing to reconsider and the
price is the question to settle first.

---

## Sources

- [Cloudflare Tunnel in 2026: Expose localhost Without Opening Ports or Buying an IP](https://recca0120.github.io/en/2026/04/14/cloudflare-tunnel-2026/)
- [Exposing Localhost Securely with Cloudflare Tunnel](https://blog.openreplay.com/exposing-localhost-cloudflare-tunnel/)
- [Tailscale Funnel: Securely Expose Local Services to the Internet](https://tailscale.com/blog/introducing-tailscale-funnel)
- [Tailscale Funnel examples · Tailscale Docs](https://tailscale.com/docs/reference/examples/funnel)
- [Securing your API | Supabase Docs](https://supabase.com/docs/guides/api/securing-your-api)

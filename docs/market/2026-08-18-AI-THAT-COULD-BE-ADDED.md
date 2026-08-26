# What kind of AI this application could actually add — 18 August 2026

Checked: 2026-08-18
Review by: 2027-02-18

Research into which free and open-source AI could be implemented here. The
conclusion is not a list of models. It is that **the choice is decided by three
headers and one rule**, and once those are read the field narrows sharply.

## The rule that eliminates most of the field

`AGENTS.md` requires AI calls to go through the Provider Gateway or an approved
server-side adapter, and this product's commercial position is that a feature
must cost the customer nothing. Together those rule out every hosted model API as
a *shipped* capability: a per-token bill that grows with use cannot sit behind a
free tool, and a free tier is a price somebody else can change.

So the question is not "which model". It is **"which AI has no per-use cost"**,
and there are two answers.

## Answer one: the plumbing already exists, and it is off

The part most likely to be missed. The application already has:

| Adapter | What it reaches |
| --- | --- |
| `sonara-ollama-adapter.cjs` | A local open-weight model the owner runs |
| `sonara-open-webui-adapter.cjs` | A self-hosted chat front end and its API |
| `sonara-dify-adapter.cjs` | An agent and workflow platform |
| `sonara-langflow-adapter.cjs` | Flow-based orchestration |
| `sonara-ragflow-adapter.cjs` | Retrieval over documents |
| `sonara-crawl4ai-adapter.cjs` | Fetching page text for a person to read |
| `optional-ai-gateway.cjs` | The gateway itself, explicitly optional |

Every one is **off until configured**, reports setup-required when it is not, and
no page notices its absence. Nothing here is unbuilt — it is a decision to run a
model somewhere and set two environment variables. The cost is compute the owner
pays for, once per request, and it does not grow with the customer's success the
way streaming bandwidth does.

**The realistic zero-cost version is Ollama on hardware the owner already owns.**
That is not a new integration. It is configuration against an adapter written
for it.

## Answer two: AI that runs in the customer's browser

The genuinely new option. It mirrors the video sweep's finding: the constraint
that blocks server-side tools does not apply to something running on the
customer's own device.

| Repository | Stars | Licence (verified) | What it gives |
| --- | --- | --- | --- |
| `huggingface/transformers.js` | 16,261 | **Apache-2.0** | Small task models — summarise, classify, embed, transcribe |
| `mlc-ai/web-llm` | 18,569 | **Apache-2.0** | A full language model on WebGPU |

No server, no per-token cost, and **no customer record leaving the device** —
which is a rule here, not a nice-to-have.

### Why both are `needs_security_review` rather than adapters

Three blockers, all in this application's own headers, all read out of
`server.js` on 18 August 2026 rather than assumed:

1. **`connect-src 'self' https://*.supabase.co https://api.stripe.com`** would
   refuse a model download from `huggingface.co`. Either that list grows — a
   third-party host gains permission to receive requests from every customer's
   browser — or the weights are served from this origin and this product pays
   the bandwidth for every device.
2. **`Cross-Origin-Embedder-Policy` is not set anywhere in the codebase.** COOP
   is (`same-origin`); COEP is not. Without both, the page is not cross-origin
   isolated, `SharedArrayBuffer` is unavailable, and multithreaded WASM inference
   cannot run. Adding `require-corp` is not a one-line change: it breaks every
   cross-origin resource that does not opt in.
3. **`script-src 'self'` with no bundler** means a vendored prebuilt bundle whose
   updates this project then owns — the same decision Excalidraw and WebAV need.

None of that refuses the idea. It makes it an **owner decision about security
posture**, not a library somebody installs. `AGENTS.md` already requires that
weakening a security check be documented in `SECURITY_NOTES.md` with the exact
reason; each of these would qualify.

### The download is a real cost to a real customer

Transformers.js can run a task model of a few tens of megabytes. A WebLLM chat
model is hundreds of megabytes at best and usually several gigabytes, once per
device. This product's customers are small businesses and creators, many on
phones and metered connections. **"Free" that costs somebody two gigabytes of
data is not free**, and that sentence decides WebLLM rather than any benchmark.

## What is deliberately not recommended

- **A hosted model API behind a free tool.** A per-token bill under a free tier
  is a cost that grows with use and a price somebody else controls.
- **Anything that sends customer records to a third party.** The consent,
  provenance and anti-clone rules are not negotiable for a convenience.
- **Calling any of it AI in customer copy.** `AGENTS.md` says avoid overusing
  "AI" in public copy, and a test enforces that nothing is described as AI. That
  survives any of the above being adopted.

## The recommendation, cheapest first

1. **Configure Ollama against the adapter that already exists.** Nothing to
   build, no new licence question, no header relaxed.
2. **Decide the three header questions above, in writing**, before any
   browser-side work starts. They are security decisions with a documented
   process already defined for them.
3. **Then Transformers.js for one narrow task** — classifying an enquiry, or
   summarising a note the customer already wrote. Small model, small download,
   obvious value, and it fails safely by being unavailable.
4. **WebLLM last, if at all**, and only for customers on a desktop who are told
   the download size first and choose it.

What should not happen is the middle of that list being skipped because the top
of it is boring.

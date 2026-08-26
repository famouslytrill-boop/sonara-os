# The 26 marked `optional_adapter_after_review`, reviewed

Checked: 2026-08-26
Review by: 2027-02-26

`data/open-source-tools.ts` carried 26 repositories at `optional_adapter_after_review`
— permission to build an adapter *after somebody looks properly*. This is that
review. It exists because "installable after review" is not a status anything can
act on: it says a licence is fine and says nothing about whether there is
anything to install.

**The finding is that the status was doing two jobs.** For some of these,
"install" means writing an adapter against a service the owner runs. For most of
them it means something else entirely — vendoring built JavaScript, wrapping a
Python library that has no server, or reading a document. Those are different
amounts of work with different risks, and one status could not tell them apart.

**One was built:** whisper.cpp, now `adapter_built`. Its record says so and names
the files.

---

## 1 — Services the owner runs, reachable by an adapter (7)

The same shape as whisper.cpp: something with an HTTP API, run on hardware the
owner controls, reached through `lib/sonara-service-adapter.cjs`. Each still
needs its own review of what it does with the data it is handed, but the
plumbing is now written and each new one is small.

| Repository | What an adapter would give a customer | The question to settle first |
| --- | --- | --- |
| sherpa-onnx | Speech recognition alongside Whisper, and speech *synthesis* Whisper does not do | Whether a second speech backend earns its keep, or splits testing across two |
| Vosk | Offline recognition over a websocket rather than HTTP | `postJson`/`postMultipart` are HTTP; a websocket adapter is a new shape, not a small one |
| seek-tune | Identifying a track from a recording, for Creator Studio catalog work | What it is matched *against*: an empty fingerprint database identifies nothing, and would report that as "no match" |
| Ghost | Publishing a creator's posts to their own site from Creator Studio | Ghost's Admin API needs a key; readiness must carry it non-enumerably, like Dify's |
| TastyIgniter | Restaurant ordering beside Business Builder's menus and recipes | Whether it duplicates the booking page rather than extending it |
| wacrm | WhatsApp conversations into Growth Studio's lead pipeline | Consent. Growth Studio records consent per contact, and a WhatsApp thread arrives without it |
| Harness | A second orchestration path beside Langflow and Dify | Whether a third one is a capability or a maintenance surface |

**None of these is blocked.** They are ordered by how much a customer would
notice: Ghost and seek-tune are the two that add something Creator Studio cannot
currently do at all.

## 2 — Runs in the customer's browser, not on a server (3)

**WebAV, FreeCut, Excalidraw.** These are front-end libraries, and this
application has no front end in the sense they expect: no bundler, no build
step, and a Content-Security-Policy of `script-src 'self'` that forbids loading
anything from a CDN.

"Installing" one means vendoring its built JavaScript into `public/` and serving
it from this origin — which is a real option, and it is what
`public/sonara-scroll-frames.js` already does for video frame extraction, hand
written rather than vendored. The cost is that vendored built output is code
nobody here has read, shipped to every customer, under this origin's policy.

That is a decision about how much unread code to serve, not a licence question.
All three are MIT.

## 3 — Python libraries with no server (3)

**Spleeter, WhisperX, CrewAI.** Each is a library the owner would have to wrap
in something before this application could reach it. There is nothing to point
an adapter at until that wrapper exists, so "install" here means "write a
service", and the register should not imply otherwise.

Worth saying about Spleeter specifically: stem separation is genuinely useful to
Creator Studio, and the honest path is the same as whisper.cpp's — the owner
runs it, this reaches it. The difference is that whisper.cpp ships a server and
Spleeter does not.

## 4 — Reference material, not software to install (9)

**Awesome LLM Apps, prompts.chat, Superpowers, Claude Skills Collection, AI
Content Studio, AWS Generative AI Use Cases, Cloudflare OS, BoxyHQ SaaS Starter
Kit, OpenClaw.**

Every one of these is a collection, a template or a set of examples. Nothing
here calls them at runtime and nothing would. They were correctly recorded as
permissively licensed and correctly *not* recorded as `reference_only`, because
somebody could legitimately copy a pattern out of them — but "install" is the
wrong verb, and leaving them at a status that invites installing is how a
register stops being read.

The one with a live use: **prompts.chat** is CC0 for its prompt content, which
means prompts could be adapted into `sonara-prompt-library` without attribution
obligations. That is a copy, reviewed per prompt, not an integration.

## 5 — Already vendored (1)

**disposable-email-domains** is in `tools/disposable-domains/` and its list is in
`lib/sonara-disposable-domains.txt`, checked by the release chain. Its record
should say `adapter_built` in spirit; it is left as-is because "adapter" is the
wrong word for a vendored list, and inventing a status for one row would be
worse than the mismatch.

## 6 — Permitted by licence, refused by a rule we already have (1)

**OpenVoice.** MIT, so the licence is not the problem. `AGENTS.md` requires
provenance, consent and anti-clone safety, and this branch already refuses to
publish `voice_identity` or `prompt_rules` on a creator profile for exactly that
reason — publishing them hands somebody the instructions for reproducing an
artist's voice. A voice-cloning integration is the same decision at a larger
scale, and it is the owner's to make rather than one to take while tidying a
register.

## 7 — Small, self-contained, genuinely vendorable (1)

**Project Nayuki's QR Code generator.** MIT, no dependencies, one file. It is the
only one of the 26 that could be vendored today with nothing to weigh: a QR code
on a printed invoice pointing at `/shared/:token`, or on a card pointing at
`/book/:slug`, is a customer feature this product has an obvious use for and no
way to produce.

Not done in this pass, deliberately: vendoring somebody's code is a copy with an
attribution obligation, and it deserves its own commit with the licence header
intact rather than being folded into a review.

---

## What changed in the register

| Repository | Was | Now |
| --- | --- | --- |
| whisper.cpp | `optional_adapter_after_review` | `adapter_built` |

The other 25 keep their status. That is deliberate: the review's finding is
about *what the status means*, not that any of them should be reclassified, and
rewriting 25 records to encode a distinction this document already draws would
move the information somewhere harder to read.

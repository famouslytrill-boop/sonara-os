# Browser-side inference: the security review

Reviewed 26 August 2026.

Review by: 2027-02-26

`data/open-source-tools.ts` has held **Transformers.js** and **WebLLM** at
`needs_security_review` since 18 August. This is that review. It exists because
the register's own note says the honest thing: *"treat this as a
Content-Security-Policy decision before it is a feature decision — three headers
in `server.js` would have to change."*

## The verdict, first

**Transformers.js: approved for adoption, with four conditions.** Status moves
`needs_security_review` → `optional_adapter_after_review`.

**WebLLM: still refused, and not on security grounds.** The security analysis
below applies identically to it — same engine class, same headers. It is refused
on the constraint already recorded against it: a chat model is hundreds of
megabytes at best and usually several gigabytes, downloaded once per device on
the customer's own connection, and this product's customers are small businesses
and creators, many on phones and metered connections. That is a product decision
and it has not changed. Status stays `needs_security_review` rather than moving
to `blocked`, because the reason is size rather than safety and a smaller model
class would reopen it.

## Why this is worth doing at all

The economic argument, which is the only one that matters here. Every hosted
model carries a per-token bill that grows with use:

| Model | Input / 1M | Output / 1M |
| --- | --- | --- |
| Grok 4.1 | $0.20 | $0.50 |
| Gemini 3 Flash | $0.50 | $3.00 |
| Gemini 3.1 Pro | $2.00 | $12.00 |
| GPT-5.2 | $1.75 | $14.00 |

*(August 2026, sourced in `docs/market/2026-08-26-PER-PRODUCT-COMPETITOR-REASSESSMENT.md`.)*

`scripts/verify-env.mjs` classifies every provider key as
`OPTIONAL_CAPABILITY`, which by that file's own rule means no path may depend on
one. So the product's AI features are off for almost everybody, and turning them
on means accepting a bill that scales with usage behind tools advertised as
included.

Inference on the customer's own device has a marginal cost to us of **zero**,
and the customer's records never leave their machine — which is the same
sentence as the consent and provenance rules already in `AGENTS.md`, rather than
a second promise needing its own enforcement.

## What actually has to change, and what each change costs

The live header, `server.js:326`:

```
default-src 'self'; base-uri 'self'; form-action 'self' https://checkout.stripe.com;
frame-ancestors 'none'; object-src 'none'; img-src 'self' data: https:;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' data: https://fonts.gstatic.com; script-src 'self';
connect-src 'self' https://*.supabase.co https://api.stripe.com; upgrade-insecure-requests
```

### 1. `script-src` needs `'wasm-unsafe-eval'` — accept

Verified against MDN and the library's own issue tracker rather than recalled:
if a page sends a CSP and `script-src` does not name `'wasm-unsafe-eval'`,
WebAssembly is **blocked from compiling**. Chrome has supported the token since
Chrome 97; before it existed the only option was `'unsafe-eval'`.

That distinction is the whole reason this is acceptable. `'unsafe-eval'` would
re-enable `eval()` and `new Function()` across the origin, turning every
injection into code execution. **`'wasm-unsafe-eval'` permits WebAssembly
compilation and nothing else** — `eval()` stays blocked.

The residual risk is real but narrow: an attacker who can already inject script
gains the ability to compile WebAssembly. They could already run JavaScript, so
this widens what they can do rather than whether they can do anything. Given
`script-src 'self'` with no bundler and no inline script, the injection itself
remains the hard part.

**Verdict: accept.** Add `'wasm-unsafe-eval'` to `script-src` only.

### 2. `connect-src` must NOT be widened — this is the important one

Transformers.js defaults to fetching weights from `huggingface.co`. Doing that
would mean adding a model host to `connect-src`, and that is the change to
refuse, for two reasons that are separate and both sufficient:

- **It is a data-exfiltration channel.** `connect-src` is what stops injected
  script posting a customer's records somewhere. Every host added is a
  destination that becomes permitted. The current list is Supabase and Stripe,
  both of which already hold this data.
- **It makes a third party's uptime and content into ours.** A weight file
  served from a host we do not control is code we do not control, executing on
  our origin, on a page holding a signed-in session.

**Serve the weights from this origin instead.** `'self'` already covers it, so
`connect-src` does not change at all. The cost is bandwidth and repository size,
paid in full and knowingly.

### 3. `worker-src` — do not add `blob:`

ONNX Runtime Web spawns workers. `default-src 'self'` already covers
`worker-src 'self'`, so a worker loaded from a same-origin URL needs no change.

Some builds construct workers from `blob:` URLs, which needs `worker-src 'self'
blob:`. **Refuse that.** A `blob:` worker is script assembled at runtime from a
string, which is the property `script-src 'self'` exists to remove. Configure
the library to use a same-origin worker file, and if a version cannot, that
version is not adoptable.

## The four conditions

1. **`script-src` gains `'wasm-unsafe-eval'` and nothing else.** Not
   `'unsafe-eval'`. A release check must fail if `'unsafe-eval'` ever appears.
2. **Weights are served from this origin.** `connect-src` is unchanged. A
   release check must fail if a model host appears in `connect-src`.
3. **No `blob:` in `worker-src`.** Same-origin worker files only.
4. **Each model's licence is read separately and recorded.** The library is
   Apache-2.0; the weights are published under their own terms and the weights
   do the work. `data/open-source-tools.ts` gets a row per model, not per
   library.

## What this does not authorise

- **Not WebLLM.** Size, as above.
- **Not shipping anything yet.** This review clears the path; the first adoption
  is its own piece of work with its own tests, and it must degrade to a stated
  "your browser cannot run this" rather than a broken button — WebGPU is roughly
  90%+ of desktop and 70–75% of mobile, so a meaningful minority has no GPU path
  at all.
- **Not a claim about model quality.** Nothing here has measured whether a model
  small enough to ship is good enough to use. That is the next question and it is
  not a security one.

## Sources

- [CSP `script-src` — MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src)
- [Transformers.js issue 774 — WebAssembly compilation error due to CSP](https://github.com/xenova/transformers.js/issues/774)
- [WebAssembly/content-security-policy issue 7 — no WebAssembly on Chrome without unsafe-eval](https://github.com/WebAssembly/content-security-policy/issues/7)

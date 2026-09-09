# Installing the SONARA Open Media Worker

Written 9 September 2026. **Every path, header and field below was read out of
`routes/creator-generation-routes.cjs`**, not designed here — `dispatchWorker`,
`refreshWorker`, `completeFromProviderPayload`, `findOutputUrl` and
`fetchSafeOutput` are the specification, and
`tests/the-media-worker-contract-is-what-the-code-sends.test.js` fails if this
file and that code stop agreeing.

---

## What this is, and why it is the only supported route

ComfyUI, LTX-2, Wan 2.2, HunyuanVideo, CogVideoX, Stable Audio 3, AudioCraft,
OpenVoice and GPT-SoVITS are recorded `reference_only` in
`lib/creator-generation-provider-registry.cjs`. There is no adapter for any of
them and no variable to set, and since 9 September the application refuses to
select one rather than parking a job on a setup nobody can finish.

That is not a gap waiting to be closed by an adapter each. **A serverless
function cannot host a GPU model.** The deployed application is a Vercel
function: no GPU, no persistent disk, a short execution budget. Whatever runs
HunyuanVideo has to be a machine you control.

The Open Media Worker is the shape of that machine as far as this application is
concerned: **a service you host, exposing two HTTP endpoints, which the
application calls as an ordinary provider.** Which engine sits behind those two
endpoints is yours to choose — that is the point. One adapter, any engine.

---

## Before you host anything: the licence gate

The worker's own registry record says activation **requires a recorded licence
review**. That is not paperwork for its own sake:

- **AudioCraft's published weights are CC-BY-NC 4.0.** NonCommercial. SONARA One
  is sold on paid plans, so those weights cannot be used behind this worker,
  however it is hosted. Only Meta relicensing changes that.
- **HunyuanVideo** carries Tencent usage restrictions needing qualified review.
- Every other engine records the same caution more mildly, and it is the one
  people get wrong: **the code licence is not the model-weights licence.** MIT
  code that loads non-commercial weights is a non-commercial deployment.

Decide per engine, and write the decision down before it is serving customers.

---

## Where to run it

Anywhere with a GPU that can be reached at a **public HTTPS address**:

- a GPU VM (AWS `g5`/`g6`, GCP `a2`/`g2`, Azure `NC`), or
- a GPU host such as RunPod, Lambda Labs, Vast.ai, Fly.io GPU, or
- your own hardware behind a tunnel that terminates TLS publicly.

**`http://localhost:11434` will not work, and this is the thing that catches
people.** From the deployed application, `localhost` means *the serverless
function that is running right now* — a container in a datacentre with no GPU and
nothing of yours on it. Your laptop is not reachable from it. The address you set
has to be one the public internet can resolve.

Plain `http://` is refused for the output download regardless (see below), so use
TLS end to end.

---

## The contract: two endpoints

### 1. Submit — `POST {CREATOR_MEDIA_WORKER_URL}/v1/jobs`

The application sends:

```
Authorization: Bearer {CREATOR_MEDIA_WORKER_TOKEN}
Content-Type: application/json
Accept: application/json
```

```json
{
  "idempotency_key": "<the SONARA job id, stable across retries>",
  "organization_id": "<uuid>",
  "user_id": "<uuid>",
  "capability": "text_to_video",
  "prompt": "…",
  "negative_prompt": "…",
  "input_assets": [],
  "parameters": {}
}
```

Your worker must reply **2xx with a JSON body carrying `id` or `job_id`**. It may
also return `progress_percent`.

- A non-2xx reply fails the job as `media_worker_submission_failed`.
- A 2xx reply with no id fails it as `media_worker_job_id_missing`, with
  "Worker did not return a job id."

`idempotency_key` is the SONARA job id. Key your own queue on it — the
application may submit the same job twice, and two renders billed for one request
is a cost you pay.

### 2. Poll — `GET {CREATOR_MEDIA_WORKER_URL}/v1/jobs/{id}`

Same `Authorization` header, `Accept: application/json`. `{id}` is the id you
returned, URL-encoded.

Return one of three states:

| `status` | What happens |
|---|---|
| `failed` or `error` | Job fails. Your `error` or `message` is recorded, truncated at 2000 characters. |
| `completed`, `succeeded` or `done` **and** an output URL | The output is downloaded and stored, job completes. |
| anything else | Job stays `running`, and `progress_percent` is clamped to 1–99. |

**A terminal status with no output URL does not complete the job** — it is read
as still running. Return the URL in the same response that reports success.

The output URL is taken from the first of these that is an `https://` string:

```
output_url, audio_url, video_url, url, output.url, result.url
```

### 3. What the output URL has to satisfy

Read from `fetchSafeOutput`, and each is a refusal, not a warning:

- **`https://` only.** `http://` fails as `insecure_output_url`.
- **No redirects.** The fetch uses `redirect: "error"`, so a 301/302 fails.
  Hand back the final URL, not a shortener or a signed-redirect.
- **160 MB maximum**, checked against `content-length` *and* the received bytes,
  so a wrong or absent header does not get past it. Over that is
  `output_too_large`.
- **`Content-Type` becomes the stored file's type**, so send a real one
  (`video/mp4`, `audio/wav`) rather than `application/octet-stream`.

A presigned S3 or R2 URL is the normal answer, and it must be valid long enough
for the poll that returns it to be acted on.

---

## What it may claim to do

The registry declares eight capabilities for this worker:

```
text_to_video   image_to_video   video_to_video   reference_analysis
text_to_music   text_to_audio    text_to_speech   speech_to_speech
```

The application will route those to your worker when it is configured and no
other provider is. **Do not accept a capability you cannot actually serve** —
returning `failed` promptly is honest; accepting and never completing leaves a
customer's job running forever.

The five voice capabilities are additionally gated by `evaluatePolicy`, which
refuses any of them without a live, in-scope voice consent on file. That check
runs before your worker is ever called and is not yours to implement.

---

## Setting the two variables

**Vercel → project `sonara-os` → Settings → Environment Variables → Production:**

```
CREATOR_MEDIA_WORKER_URL   = https://<your worker host>   ← no trailing slash needed; one is stripped
CREATOR_MEDIA_WORKER_TOKEN = <a long random string>       ← mark Sensitive
```

Then **redeploy** — a Vercel variable is read when a deployment is built, so
setting it alone changes nothing.

The token is a bearer secret you invent and your worker checks. Generate it with
`openssl rand -hex 32`. **Your worker must reject a request whose bearer token
does not match**, or its `/v1/jobs` endpoint is an open GPU for anyone who finds
the address.

---

## Proving it works

1. `/api/readiness` — the worker appears as configured once both variables are set.
2. The assistant page inside Creator Studio lists providers and their state.
3. Submit one real generation and watch the job reach `completed` with a stored
   asset.

Until a job completes end to end, what you have verified is that two variables
are set, which is a narrower claim than it looks.

---

## The order, if you only read one thing

1. Decide the licence question for the engine you intend to run. AudioCraft's
   published weights cannot be one of them.
2. Stand the engine up on a GPU host with a public HTTPS address.
3. Put the two endpoints in front of it: `POST /v1/jobs`, `GET /v1/jobs/{id}`.
4. Make it check the bearer token, and key its queue on `idempotency_key`.
5. Return an `https`, non-redirecting, under-160 MB output URL with a real
   content type.
6. Set both variables in Vercel. Redeploy.
7. Run one job all the way to a stored asset.

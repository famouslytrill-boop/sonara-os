# Songsmith

A self-hosted web application for turning a text idea into a song. Somebody asks
for an account, you approve it, they write lyrics and a style, and the job goes
to a generation backend you run on RunPod. When it comes back they play the
stereo M4A in the browser, rename it, make it again with the same seed, share it
with the other people here, or delete it.

**No dependencies.** Storage is `node:sqlite`, hashing is `node:crypto`, the
server is `node:http`. There is no `npm install` step, no lockfile, and no
dependency tree whose licences somebody has to have read.

```
docker compose up
```

Then open <http://localhost:8787>. The first account created is an active admin,
because otherwise there would be nobody to approve the second one.

## What it does

| | |
| --- | --- |
| **Accounts** | Request, wait, be approved, sign in. Disabling an account ends the session it is holding, immediately. |
| **Writing** | A prompt becomes a title, a style note and structured lyrics. With a model configured it writes them; without one it gives you the section headings and says so. |
| **Generating** | Submitted to RunPod with `/run`, polled with `/status`. Progress is shown when the backend reports it and not otherwise. |
| **Playing** | Stereo M4A in the browser, with byte ranges so the scrubber works. |
| **Sharing** | Private by default. Sharing makes a finished song readable by the other people signed in here — not by the internet; there is no public link. |
| **Admin** | Approve, disable, enable, delete. Deleting somebody deletes their songs. |

## Configuration

Everything except the RunPod credentials has a working default.

| Variable | What happens without it |
| --- | --- |
| `RUNPOD_API_KEY`, `RUNPOD_ENDPOINT_ID` | The application runs and refuses to submit, saying so on the page and on the song. Nothing is charged. |
| `SONGSMITH_LLM_BASE_URL`, `SONGSMITH_LLM_MODEL`, `SONGSMITH_LLM_API_KEY` | The writing helper returns a structure outline and labels it as one. Any OpenAI-shaped chat endpoint works — llama.cpp, vLLM, Ollama's compatible route. |
| `SONGSMITH_SECRET` | One is generated into the data directory on first start. Fine for one container; set it explicitly the moment there are two. |
| `SONGSMITH_DATA_DIR` | `./data`, or `/data` in the container. Holds the SQLite file, the audio and the secret. |
| `SONGSMITH_OPEN_REQUESTS` | `true`. Set `false` to close the request form once everybody has an account. |
| `SONGSMITH_TRUST_PROXY` | `false`. Only set it to `true` when something really is terminating TLS in front — trusting `X-Forwarded-For` without a proxy lets anybody pick their own rate-limit bucket. |
| `PORT`, `HOST` | `8787`, `0.0.0.0`. |

## What the backend has to return

The endpoint is called with:

```json
{ "input": { "prompt": "...", "lyrics": "...", "style": "...", "seed": 12345, "format": "m4a", "channels": 2 } }
```

and its `output` should be either `audio_base64` (an M4A) or `audio_url`, plus
optionally `duration_ms` and a `progress` number between 0 and 100 while it is
running. Anything else that comes back is recorded as a failure with the reason
on the song — including `COMPLETED` with no audio in it, which is a failure and
not a song.

## Decisions worth knowing about

**`/runsync` is never used.** It is the obvious call and it is a trap for a job
that takes minutes: if the response has not arrived in time the request returns
without the result while the job keeps running and keeps being billed, with no
id in hand to poll or cancel with. Its results are also discarded after about a
minute against thirty for `/run`. So `/run` plus polling, always.

**Progress is reported, never invented.** A bar that climbs on a timer is a
picture of work nobody observed. A running job with no reported percentage says
"working on it" and shows no bar.

**Songs are private from an admin too.** "Private by default" would mean very
little if the person who approves the accounts could read everybody's songs.

**Every action is a form post.** There is no JSON API and no client-side router,
which is what lets the Content-Security-Policy forbid inline script entirely.
The one script in `public/app.js` reloads a page while a song is being made, and
without it everything still works — you press reload instead.

**The audio is checked before it is stored.** `src/audio.js` reads the MP4 box
tree far enough to know whether it really is one and how many channels it has.
A backend that answers with a JSON error is caught here rather than becoming a
play button that does nothing. A file whose channel count cannot be read reports
`null` rather than guessing.

## Running it without Docker

```
node --run start        # needs Node 22 or newer for node:sqlite
node --test tests/*.test.js   # 44 tests
```

## What this is not

- **It does not authenticate to the internet.** There is no public share link.
  Sharing means the other approved accounts on this installation.
- **It does not generate anything itself.** The model runs on RunPod, or on
  whatever answers that API shape.
- **It has not been built as a container in this repository's CI.** The Docker
  daemon is not available where this was written, so the `Dockerfile` and
  `docker-compose.yml` here are read but not run. Everything else is tested.

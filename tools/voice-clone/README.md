# voice-clone

Upload a voice, prove the speaker agreed, type text, get audio in that voice.
Cross-lingual: an English sample can speak Spanish, French, Chinese, Japanese or
Korean. Built on [OpenVoice](https://github.com/myshell-ai/OpenVoice) (MIT).

```bash
make run     # http://127.0.0.1:8000
make test
```

`make` builds the virtual environment on first run. **It works immediately, and
it will not have cloned anything** — see "Two engines" below.

## Read this first: consent is enforced, not asked about

`AGENTS.md` in this repository says, in one line: *"Enforce provenance, consent,
and anti-clone safety."* Not "ask about" — enforce. That is why this app is
shaped the way it is, and it is the reason it is worth having rather than being
one more way to put words in somebody's mouth.

**A tickbox proves nothing.** Anybody cloning a voice they should not have ticks
it, and it leaves no record worth anything afterwards. What actually
distinguishes a consenting speaker from a scraped clip is that a consenting
speaker is *present when you ask* and can be asked to say something nobody could
have predicted.

So the flow is:

1. Press **Get a phrase to read**. The server invents one — a fixed sentence
   plus four random words and a number — and keeps it.
2. The speaker records themselves reading it aloud.
3. Upload that recording alongside the voice sample.
4. The server transcribes it and compares it against the phrase **it** issued.
   Only a match produces audio.

The phrase never comes from the browser. A client that could supply its own
phrase could supply one it already had a recording of, and the check would be
theatre. Challenges are single-use and expire after fifteen minutes, so one
consent recording authorises one clone.

**Three outcomes, not two.** Granted, refused, and *unverified* — the last being
when the check could not run at all, usually because no speech recogniser is
installed. Unverified never becomes granted. A check that could not run and a
check that passed are the same shape and opposite meanings.

Every result carries a consent record: who consented, when, how much of the
phrase matched, and the SHA-256 of the reference clip. Refusals are recorded as
fully as grants — a tool that only writes down its successes cannot answer the
one question anybody will ever ask it. A refused reference clip is deleted.

Output from the real engine is watermarked `@SONARA-CLONED` using OpenVoice's
own `wavmark`. That is the provenance half of the same rule.

## Two engines

**Stub** (default, works anywhere). Produces a real, playable WAV that is **a
tone, not speech**. No voice is cloned. It exists so the whole app — the
consent gate, the validation, the interface, the tests — can be used on a laptop
with no GPU and nothing downloaded. It says what it is, in the API response and
on the page, because a stub that dressed itself up as a result would let
somebody demo this to a room without noticing nothing had happened.

**OpenVoice V2** (real). `make openvoice`, then follow the rest of the
instructions at the top of `requirements-openvoice.txt` — OpenVoice itself,
MeloTTS, unidic, and the V2 checkpoints.

> **The OpenVoice path has not been run.** It was written against OpenVoice's
> documentation and source layout; the machine it was written on had no GPU and
> could not download the checkpoints. Nothing in the test suite exercises it and
> nothing here claims it works. If you are the first to run it and it does not,
> the fault is in `voiceclone/openvoice_engine.py`, not in your setup.

## Emotion, honestly

OpenVoice **V1** synthesises with a base speaker that has named emotions —
cheerful, sad, angry, terrified, whispering — and then converts the tone colour
onto the reference voice. **V2** replaces that base speaker with MeloTTS, which
is better and multilingual and does *not* expose those emotions: delivery comes
from the base speaker, tone colour from your clip.

So emotion control on V2 is weaker than the marketing summary suggests. Rather
than offer nine styles and render several identically, **each engine reports
what it actually has** and the interface asks it. The stub offers six; the V2
adapter reports one. If named emotions matter more than V2's audio quality and
language coverage, V1 is the model to wire in, and the interface will not need
changing.

## Languages

English, Spanish, French, Chinese, Japanese, Korean — the six OpenVoice V2 names
natively. Anything else is refused rather than attempted: a model asked for a
language it was not built for does not error, it produces confident nonsense in
an accent, and the person who asked has no way to tell.

## Why this is not inside SONARA One

SONARA One is an Express app on Vercel serverless with one production
dependency, and `vercel.json` bundles `{public/**,routes/**,lib/**}` into the
function. PyTorch and several gigabytes of checkpoints do not go there, and
would not fit a serverless execution model if they did. This is a tool the owner
runs on their own machine — the pattern `docs/architecture/EXTERNAL-SERVICES.md`
describes. If it is ever reachable over the network, the four rules in that
document apply, starting with: off by default, and never a dependency.

## Layout

```
voiceclone/
  consent.py            the challenge phrase, the decision, the record
  languages.py          what is accepted, and what is refused rather than faked
  engine.py             the interface, and the stub that runs anywhere
  openvoice_engine.py   the real adapter (written, NOT verified)
  app.py                four endpoints
static/index.html       the whole interface, no build step
tests/                  named after ways somebody would get a clone they should not have
```

MIT licensed. See `LICENSE`.

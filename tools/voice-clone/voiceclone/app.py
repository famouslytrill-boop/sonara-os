"""The web app: upload a voice, prove consent, type text, get audio.

    make run      then open http://127.0.0.1:8000

Four endpoints and one page. The page is plain HTML with a little JavaScript --
no build step, no framework, nothing to install beyond the Python.

## The order things happen in, which is the security property

1. The browser asks for a challenge. The server generates a phrase, keeps it,
   and returns a token and the phrase to read.
2. The speaker records themselves reading it.
3. The browser sends the reference clip, the consent clip and the token.
4. **The server looks the phrase up by token.** It never takes the phrase from
   the request -- a client that supplied its own phrase could supply one it
   already had a recording of, and the whole check would be theatre.
5. The consent clip is transcribed and compared. Only GRANTED proceeds.

A challenge is single-use and expires. Reusing one would let a single consent
recording authorise an unlimited number of different clones later.
"""

from __future__ import annotations

import hmac
import os
import shutil
import tempfile
import time
import uuid
from pathlib import Path

from fastapi import Depends, FastAPI, Form, Header, HTTPException, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse

from .consent import Challenge, Consent, evaluate, may_clone
from .engine import StubEngine
from .languages import LANGUAGES, validate
from .openvoice_engine import load

CHALLENGE_TTL_SECONDS = 15 * 60
MAX_UPLOAD_BYTES = 25 * 1024 * 1024
ALLOWED_SUFFIXES = {".wav", ".mp3", ".m4a", ".ogg", ".flac", ".webm"}

STATIC = Path(__file__).resolve().parent.parent / "static"
WORKSPACE = Path(tempfile.gettempdir()) / "voiceclone"

app = FastAPI(title="Voice clone, with consent")

ENGINE, ENGINE_NOTE = load()

# The shared secret, if this instance is exposed to anything but localhost.
#
# docs/architecture/EXTERNAL-SERVICES.md is blunt about why: a tunnel makes a
# service reachable by everyone, not only by the application that wanted it, and
# an open voice cloner is worse than an open model endpoint. Unset, the app runs
# for somebody on their own machine and says so on the page; set, every API call
# must present it.
#
# Compared with hmac.compare_digest rather than ==, because a plain comparison
# returns as soon as it finds a differing byte and that timing is a side channel
# somebody can walk a secret out of, one character at a time.
API_TOKEN = os.environ.get("VOICECLONE_TOKEN", "").strip()


def require_token(authorization: str | None = Header(default=None)) -> None:
    if not API_TOKEN:
        return
    presented = ""
    if authorization and authorization.lower().startswith("bearer "):
        presented = authorization[7:].strip()
    if not hmac.compare_digest(presented, API_TOKEN):
        raise HTTPException(401, "This instance requires a token.")


# token -> (Challenge, issued_monotonic). In memory on purpose: this is a tool
# somebody runs on their own machine for their own recordings, and a database
# would be one more thing to install for state that is meaningless after a
# quarter of an hour.
_challenges: dict[str, tuple[Challenge, float]] = {}


def _expire() -> None:
    now = time.monotonic()
    for token in [t for t, (_, at) in _challenges.items() if now - at > CHALLENGE_TTL_SECONDS]:
        _challenges.pop(token, None)


async def _save(upload: UploadFile, destination: Path) -> None:
    """Write an upload to disk, refusing anything oversized or oddly named."""
    suffix = Path(upload.filename or "").suffix.lower()
    if suffix not in ALLOWED_SUFFIXES:
        raise HTTPException(400, f"{suffix or 'that file'} is not an audio format this accepts.")
    destination.parent.mkdir(parents=True, exist_ok=True)
    written = 0
    with destination.open("wb") as handle:
        while chunk := await upload.read(1024 * 1024):
            written += len(chunk)
            if written > MAX_UPLOAD_BYTES:
                handle.close()
                destination.unlink(missing_ok=True)
                raise HTTPException(413, "That file is larger than 25 MB.")
            handle.write(chunk)
    if written == 0:
        destination.unlink(missing_ok=True)
        raise HTTPException(400, "That file is empty.")


@app.get("/", response_class=HTMLResponse)
def index() -> HTMLResponse:
    return HTMLResponse((STATIC / "index.html").read_text(encoding="utf-8"))


@app.get("/api/capabilities", dependencies=[Depends(require_token)])
def capabilities() -> JSONResponse:
    return JSONResponse(
        {
            "engine": ENGINE.name,
            "engine_note": ENGINE_NOTE,
            "produces_real_speech": not isinstance(ENGINE, StubEngine),
            "languages": LANGUAGES,
            "styles": list(ENGINE.styles()),
            "token_required": bool(API_TOKEN),
        }
    )


@app.post("/api/challenge", dependencies=[Depends(require_token)])
def challenge() -> JSONResponse:
    _expire()
    issued = Challenge.issue()
    _challenges[issued.token] = (issued, time.monotonic())
    return JSONResponse({"token": issued.token, "phrase": issued.phrase, "expires_in": CHALLENGE_TTL_SECONDS})


@app.post("/api/clone", dependencies=[Depends(require_token)])
async def clone(
    reference: UploadFile,
    consent_clip: UploadFile,
    token: str = Form(...),
    speaker_name: str = Form(...),
    text: str = Form(...),
    language: str = Form("en"),
    style: str = Form("default"),
    speed: float = Form(1.0),
) -> JSONResponse:
    _expire()
    # Single-use: popped, not read. A challenge that survived its use would let
    # one consent recording authorise every clone made afterwards.
    entry = _challenges.pop(token, None)
    if entry is None:
        raise HTTPException(400, "That consent challenge has expired or was already used. Ask for a new phrase.")
    issued, _ = entry

    request, why = validate(text, language, style, speed, ENGINE.styles())
    if request is None:
        raise HTTPException(400, why)

    job = uuid.uuid4().hex
    work = WORKSPACE / job
    reference_path = work / f"reference{Path(reference.filename or '').suffix.lower()}"
    consent_path = work / f"consent{Path(consent_clip.filename or '').suffix.lower()}"
    await _save(reference, reference_path)
    await _save(consent_clip, consent_path)

    heard = ENGINE.transcribe(consent_path)
    record = evaluate(issued, heard, speaker_name, reference_path, consent_path)
    (work / "consent.json").write_text(record.to_json(), encoding="utf-8")

    if not may_clone(record):
        # The clip is deleted. Keeping a voice this app was not allowed to clone
        # is the thing somebody would later have to explain.
        reference_path.unlink(missing_ok=True)
        consent_path.unlink(missing_ok=True)
        status = 403 if record.decision == Consent.REFUSED else 409
        return JSONResponse(
            status_code=status,
            content={
                "ok": False,
                "decision": record.decision,
                "reason": record.reason,
                "heard": record.heard,
                "match_ratio": record.match_ratio,
            },
        )

    out = work / "cloned.wav"
    result = ENGINE.synthesize(reference_path, request.text, request.language, request.style, request.speed, out)

    return JSONResponse(
        {
            "ok": True,
            "decision": record.decision,
            "job": job,
            "audio_url": f"/api/audio/{job}",
            "engine": result.engine,
            "is_real_speech": result.is_real_speech,
            "detail": result.detail,
            "consent": {
                "speaker_name": record.speaker_name,
                "recorded_at": record.recorded_at,
                "match_ratio": record.match_ratio,
                "reference_sha256": record.reference_sha256,
            },
        }
    )


@app.get("/api/audio/{job}")
def audio(job: str) -> FileResponse:
    # The job id goes into a path, so it is checked before it gets there.
    # Anything but hex would address a different directory with this process's
    # permissions behind it.
    if not job.isalnum() or len(job) != 32:
        raise HTTPException(404, "No such job.")
    path = WORKSPACE / job / "cloned.wav"
    if not path.is_file():
        raise HTTPException(404, "No such job.")
    return FileResponse(path, media_type="audio/wav", filename="cloned.wav")


@app.delete("/api/audio/{job}")
def forget(job: str) -> JSONResponse:
    if not job.isalnum() or len(job) != 32:
        raise HTTPException(404, "No such job.")
    shutil.rmtree(WORKSPACE / job, ignore_errors=True)
    return JSONResponse({"ok": True})

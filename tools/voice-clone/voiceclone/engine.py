"""The seam between this app and a model that weighs several gigabytes.

Two implementations sit behind one interface.

`StubEngine` produces a real, playable WAV -- a tone, not speech -- and is what
the tests and the first run use. It exists so that the app, the consent gate,
the validation and the whole request path can be exercised on a machine with no
GPU, no checkpoints and no PyTorch. It is **explicit about being a stub**: the
audio it returns is a tone, the response says so, and the UI says so. A stub
that returned silence, or that dressed itself up as a result, would let somebody
demonstrate this to a room without noticing nothing was cloned.

`OpenVoiceEngine` is the real one, in openvoice_engine.py. It is written and it
is **not verified here**: the checkpoints are large, the container this was
written in has no GPU, and downloading them was not possible. That is stated in
the module, in the README, and in the sprint log rather than being left for
somebody to discover.
"""

from __future__ import annotations

import math
import struct
import wave
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Result:
    path: Path
    engine: str
    is_real_speech: bool
    detail: str


class Engine:
    """What the app is allowed to assume about any engine."""

    name = "engine"

    def styles(self) -> tuple[str, ...]:
        raise NotImplementedError

    def transcribe(self, clip: Path) -> str | None:
        """What was said in this clip, or None if it cannot be determined.

        None is not an empty string. An engine with no recogniser returns None,
        the consent gate reports UNVERIFIED, and no clone is produced -- which
        is the difference between "we could not check" and "they said nothing".
        """
        raise NotImplementedError

    def synthesize(self, reference: Path, text: str, language: str, style: str, speed: float, out: Path) -> Result:
        raise NotImplementedError


class StubEngine(Engine):
    """Runs anywhere. Produces a tone, and never pretends otherwise."""

    name = "stub"

    def styles(self) -> tuple[str, ...]:
        return ("default", "friendly", "cheerful", "excited", "sad", "angry")

    def transcribe(self, clip: Path) -> str | None:
        # No recogniser. Deliberately None rather than "" so the consent gate
        # reaches UNVERIFIED and refuses, instead of comparing against an empty
        # transcript and refusing for the wrong reason.
        return None

    def synthesize(self, reference: Path, text: str, language: str, style: str, speed: float, out: Path) -> Result:
        # One second per ten characters, bounded, so the file is proportional to
        # the request and obviously not speech.
        seconds = max(1.0, min(10.0, len(text) / 10.0)) / max(speed, 0.1)
        rate = 22050
        frames = int(rate * seconds)
        pitch = {"sad": 180.0, "angry": 320.0, "excited": 360.0}.get(style, 240.0)

        out.parent.mkdir(parents=True, exist_ok=True)
        with wave.open(str(out), "wb") as handle:
            handle.setnchannels(1)
            handle.setsampwidth(2)
            handle.setframerate(rate)
            samples = bytearray()
            for i in range(frames):
                # Fade in and out so it is pleasant rather than a click.
                envelope = min(1.0, i / (rate * 0.05), (frames - i) / (rate * 0.05))
                value = int(12000 * envelope * math.sin(2 * math.pi * pitch * (i / rate)))
                samples += struct.pack("<h", value)
            handle.writeframes(bytes(samples))

        return Result(
            path=out,
            engine=self.name,
            is_real_speech=False,
            detail=(
                "This is the stub engine. The file is a tone, not speech, and no voice "
                "was cloned. Install OpenVoice and its checkpoints to produce real audio."
            ),
        )

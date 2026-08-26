"""OpenVoice V2, behind the same interface as the stub.

**This module has not been run.** It was written against OpenVoice's published
documentation and source layout; the machine it was written on has no GPU, and
the checkpoints -- base speaker TTS plus the tone-colour converter -- are large
enough that downloading them was not possible there. Nothing in the test suite
exercises it, and nothing in this repository claims it works.

That is stated here, at the top of the file, rather than in a commit message
somebody will not read. If you are the first person to run it and it does not
work, the fault is here and not in your setup, and the fix belongs in this file.

## What it needs

    pip install -r requirements-openvoice.txt
    # then, per OpenVoice's own instructions:
    #   git clone https://github.com/myshell-ai/OpenVoice
    #   pip install -e OpenVoice
    #   pip install git+https://github.com/myshell-ai/MeloTTS.git
    #   python -m unidic download
    # and the V2 checkpoints from the link in OpenVoice's README, unpacked to
    #   OPENVOICE_CHECKPOINTS (default: ./checkpoints_v2)

## How V2 differs from V1, and why the style list is short

V1 synthesises with a base speaker that has named emotions -- cheerful, sad,
angry -- and then converts the tone colour to the reference voice. V2 replaces
that base speaker with MeloTTS, which is better and multilingual and does **not**
expose those named emotions. So V2's delivery comes from the base speaker and
the tone colour comes from the reference clip.

The honest consequence is that emotion control on V2 is weaker than on V1, and
`styles()` reports what is actually offered rather than listing nine names and
rendering several of them identically. Whichever engine is loaded, the app asks
it what it can do.
"""

from __future__ import annotations

import os
from pathlib import Path

from .engine import Engine, Result

CHECKPOINTS = Path(os.environ.get("OPENVOICE_CHECKPOINTS", "checkpoints_v2"))

# MeloTTS speaker keys per language, from its own speaker table. The default
# accent for English is the one V2's own demo uses.
MELO_SPEAKER = {
    "en": "EN-Default",
    "es": "ES",
    "fr": "FR",
    "zh": "ZH",
    "ja": "JP",
    "ko": "KR",
}


class OpenVoiceEngine(Engine):
    name = "openvoice-v2"

    def __init__(self, device: str | None = None, checkpoints: Path | None = None) -> None:
        # Imported lazily and inside __init__ so that the app starts, the tests
        # run and the stub works on a machine where none of this is installed.
        # A module-level import here would make torch a hard requirement of a
        # tool whose whole point is that it degrades to the stub.
        import torch  # noqa: PLC0415
        from openvoice.api import ToneColorConverter  # noqa: PLC0415

        self.checkpoints = checkpoints or CHECKPOINTS
        self.device = device or ("cuda:0" if torch.cuda.is_available() else "cpu")

        converter_dir = self.checkpoints / "converter"
        config = converter_dir / "config.json"
        weights = converter_dir / "checkpoint.pth"
        if not config.is_file() or not weights.is_file():
            raise FileNotFoundError(
                f"OpenVoice V2 checkpoints not found under {self.checkpoints}. "
                "Download them from the link in OpenVoice's README and unpack them there, "
                "or set OPENVOICE_CHECKPOINTS."
            )

        self.converter = ToneColorConverter(str(config), device=self.device)
        self.converter.load_ckpt(str(weights))
        self._melo: dict[str, object] = {}
        self._whisper = None

    def styles(self) -> tuple[str, ...]:
        # V2 takes its delivery from the base speaker rather than from a named
        # emotion. Reporting one entry is the truth; reporting nine would be a
        # menu where eight of the choices do the same thing.
        return ("default",)

    def transcribe(self, clip: Path) -> str | None:
        """Whisper, for the consent phrase. None when it cannot be loaded."""
        try:
            from faster_whisper import WhisperModel  # noqa: PLC0415
        except ImportError:
            return None
        try:
            if self._whisper is None:
                self._whisper = WhisperModel("base", device="cpu", compute_type="int8")
            segments, _ = self._whisper.transcribe(str(clip), beam_size=5)
            return " ".join(segment.text for segment in segments).strip()
        except Exception:  # noqa: BLE001
            # An unreadable clip or a model that will not load is "could not
            # check", and the consent gate turns that into a refusal to clone.
            return None

    def _melo_for(self, language: str):
        from melo.api import TTS  # noqa: PLC0415

        key = language.upper() if language != "ja" else "JP"
        if key not in self._melo:
            self._melo[key] = TTS(language=key, device=self.device)
        return self._melo[key]

    def synthesize(self, reference: Path, text: str, language: str, style: str, speed: float, out: Path) -> Result:
        import torch  # noqa: PLC0415
        from openvoice import se_extractor  # noqa: PLC0415

        out.parent.mkdir(parents=True, exist_ok=True)
        scratch = out.parent / f"{out.stem}.base.wav"

        # The reference voice, as an embedding. vad=True trims silence, which
        # matters more than it looks: a clip that is mostly room tone produces
        # an embedding of the room.
        target_se, _ = se_extractor.get_se(str(reference), self.converter, vad=True)

        model = self._melo_for(language)
        speaker_key = MELO_SPEAKER.get(language, "EN-Default")
        speaker_ids = model.hps.data.spk2id
        speaker_id = speaker_ids[speaker_key] if speaker_key in speaker_ids else list(speaker_ids.values())[0]
        model.tts_to_file(text, speaker_id, str(scratch), speed=speed)

        source_se = torch.load(
            self.checkpoints / "base_speakers" / "ses" / f"{speaker_key.lower().replace('_', '-')}.pth",
            map_location=self.device,
        )

        # message= is OpenVoice's audio watermark, and it is not decoration.
        # AGENTS.md requires provenance; a clone that carries a mark saying it is
        # one is the difference between a tool and a forgery kit.
        self.converter.convert(
            audio_src_path=str(scratch),
            src_se=source_se,
            tgt_se=target_se,
            output_path=str(out),
            message="@SONARA-CLONED",
        )
        scratch.unlink(missing_ok=True)

        return Result(
            path=out,
            engine=self.name,
            is_real_speech=True,
            detail=f"OpenVoice V2 on {self.device}, watermarked @SONARA-CLONED.",
        )


def load(prefer_real: bool = True):
    """The real engine if it will load, otherwise the stub, and say which.

    Never raises. A missing checkpoint or an absent torch is an ordinary state
    for this tool -- the app still runs, still enforces consent, and still says
    plainly that what it produced is a tone.
    """
    from .engine import StubEngine  # noqa: PLC0415

    if not prefer_real:
        return StubEngine(), "asked for the stub engine"
    try:
        return OpenVoiceEngine(), "OpenVoice V2 loaded"
    except Exception as error:  # noqa: BLE001
        return StubEngine(), f"OpenVoice is not available ({type(error).__name__}: {error}); using the stub"

"""What this app will accept, and what it refuses to pretend about.

OpenVoice V2 names six languages it supports natively. Anything outside that
list is refused rather than attempted: a model asked for a language it was not
built for does not error, it produces confident nonsense in an accent, and the
person who asked has no way to tell.

The style names are the same. OpenVoice V1 exposes a set of named emotions; V2's
tone-colour conversion carries the *reference speaker's* delivery and takes its
emotion from the base speaker instead. So the honest thing is to say which
styles a given engine actually offers rather than to list eight and quietly
render four of them identically.
"""

from __future__ import annotations

from dataclasses import dataclass

# Code, English name, and what a person picking from a menu should see.
LANGUAGES: dict[str, str] = {
    "en": "English",
    "es": "Spanish",
    "fr": "French",
    "zh": "Chinese",
    "ja": "Japanese",
    "ko": "Korean",
}

# V1's named styles. V2 does not expose these directly, which is why an engine
# reports its own list rather than this being treated as the truth everywhere.
STYLES: tuple[str, ...] = (
    "default",
    "friendly",
    "cheerful",
    "excited",
    "sad",
    "angry",
    "terrified",
    "shouting",
    "whispering",
)

MAX_TEXT_CHARS = 2000


@dataclass(frozen=True)
class Request:
    text: str
    language: str
    style: str
    speed: float = 1.0


def validate(text: str, language: str, style: str, speed: float, offered_styles: tuple[str, ...]) -> tuple[Request | None, str | None]:
    """A request this engine can actually serve, or the reason it cannot.

    Returns (request, None) or (None, reason). The reason is a sentence for a
    person, because every one of these is something they can fix by choosing
    differently rather than a condition to retry through.
    """
    body = (text or "").strip()
    if not body:
        return None, "There is no text to speak."
    if len(body) > MAX_TEXT_CHARS:
        return None, f"That is {len(body)} characters; the limit is {MAX_TEXT_CHARS}."

    if language not in LANGUAGES:
        offered = ", ".join(f"{name} ({code})" for code, name in LANGUAGES.items())
        return None, f"{language!r} is not a language this model was built for. Choose one of: {offered}."

    if style not in offered_styles:
        return None, (
            f"{style!r} is not a style this engine offers. It offers: {', '.join(offered_styles)}."
        )

    try:
        rate = float(speed)
    except (TypeError, ValueError):
        return None, "Speed must be a number."
    if not 0.5 <= rate <= 2.0:
        return None, "Speed must be between 0.5 and 2.0."

    return Request(body, language, style, rate), None

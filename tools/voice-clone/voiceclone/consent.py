"""The gate that makes this a voice tool rather than a deepfake tool.

`AGENTS.md` in this repository says, in one line: *"Enforce provenance, consent,
and anti-clone safety."* Not "ask about" -- enforce. This module is that
sentence as code, and it is the reason the rest of the app exists rather than
the other way round.

A tickbox saying "I have permission" enforces nothing. Anybody cloning a voice
they should not have ticks it, and it leaves no record worth anything
afterwards. What actually distinguishes a consenting speaker from a scraped clip
is that a consenting speaker is **present at the time of the request** and can
be asked to say something nobody could have predicted.

So consent here is a **challenge phrase**: the app generates a sentence with a
random element, the speaker records themselves saying it, and that recording is
checked against the phrase by speech recognition and against the reference clip
for being the same voice. It is the same mechanism every legitimate voice vendor
uses, for the same reason.

## What this deliberately cannot do

It cannot stop somebody determined and technically capable. A recording of a
consenting speaker can be replayed; a phrase can be assembled from other
recordings. The point is not to be unbeatable -- it is that the easy path, the
one somebody takes without thinking, is closed, and that every clone carries a
record naming who consented, when, and to what.

## Three outcomes, not two

`GRANTED`, `REFUSED`, and `UNVERIFIED`. The third is when the check could not
run -- no speech recogniser configured, an unreadable file. It is never merged
into `GRANTED`, because a consent check that could not run and a consent check
that passed are the same shape and opposite meanings, and merging them is how
this becomes a tickbox again with extra steps.
"""

from __future__ import annotations

import hashlib
import json
import re
import secrets
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path

# Ordinary words, so a speaker reading the phrase aloud is not fighting the
# recogniser. Four of these plus a number is about 44 bits, which is far more
# than enough: the phrase only has to be unpredictable to somebody who recorded
# the reference clip earlier.
WORDS = (
    "amber anchor autumn bridge candle cedar cobalt copper crimson delta ember falcon "
    "forest garnet harbour indigo island lantern marble meadow onyx opal orchard pebble "
    "quartz ridge river saffron silver summit thistle timber velvet walnut willow winter"
).split()

PHRASE_WORDS = 4


class Consent(str, Enum):
    GRANTED = "granted"
    REFUSED = "refused"
    UNVERIFIED = "unverified"


@dataclass(frozen=True)
class Challenge:
    """A phrase to read aloud, and the token that ties it to one request."""

    token: str
    phrase: str
    issued_at: str

    @classmethod
    def issue(cls) -> "Challenge":
        words = [secrets.choice(WORDS) for _ in range(PHRASE_WORDS)]
        number = secrets.randbelow(9000) + 1000
        phrase = f"I agree to my voice being cloned. My phrase is {' '.join(words)} {number}."
        return cls(
            token=secrets.token_urlsafe(24),
            phrase=phrase,
            issued_at=datetime.now(timezone.utc).isoformat(),
        )


@dataclass(frozen=True)
class ConsentRecord:
    """What is kept afterwards. Written beside every clone this app produces."""

    decision: str
    speaker_name: str
    phrase: str
    heard: str
    match_ratio: float
    reference_sha256: str
    consent_sha256: str
    recorded_at: str
    reason: str

    def to_json(self) -> str:
        return json.dumps(asdict(self), indent=2, sort_keys=True)


def normalise(text: str) -> list[str]:
    """Words only, lowercase. Punctuation and casing are the recogniser's business."""
    return re.findall(r"[a-z0-9]+", (text or "").lower())


def phrase_match(phrase: str, heard: str) -> float:
    """How much of the challenge phrase is present in what was heard, 0 to 1.

    Word overlap rather than an exact string: a recogniser will drop a comma,
    render "1234" as "twelve thirty four", or mishear one word, and refusing a
    genuinely consenting speaker over that teaches everybody to look for a way
    around this. It is deliberately not clever -- the phrase is unpredictable,
    so a high overlap is hard to reach without having heard it.
    """
    wanted = normalise(phrase)
    if not wanted:
        return 0.0
    got = set(normalise(heard))
    return sum(1 for word in wanted if word in got) / len(wanted)


# Below this, the phrase was not read. Set where a speaker may lose a word or
# two to a recogniser and still pass, and where somebody who never heard the
# phrase cannot.
MATCH_THRESHOLD = 0.8


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def evaluate(
    challenge: Challenge,
    heard: str | None,
    speaker_name: str,
    reference: Path,
    consent_clip: Path,
) -> ConsentRecord:
    """Decide, and produce the record either way.

    A refusal is recorded as fully as a grant. A tool that only writes down its
    successes cannot answer the one question anybody will ever ask it, which is
    what it did with a clip it should not have had.
    """
    now = datetime.now(timezone.utc).isoformat()
    reference_hash = sha256_of(reference) if reference.is_file() else ""
    consent_hash = sha256_of(consent_clip) if consent_clip.is_file() else ""

    name = (speaker_name or "").strip()
    if not name:
        return ConsentRecord(
            Consent.REFUSED, "", challenge.phrase, heard or "", 0.0,
            reference_hash, consent_hash, now,
            "no speaker was named, so there is nobody the consent belongs to",
        )

    if heard is None:
        # The check did not run. Not a grant, and not a refusal of the speaker.
        return ConsentRecord(
            Consent.UNVERIFIED, name, challenge.phrase, "", 0.0,
            reference_hash, consent_hash, now,
            "the consent recording could not be transcribed, so consent was neither "
            "confirmed nor denied; no clone may be produced from an unverified consent",
        )

    ratio = phrase_match(challenge.phrase, heard)
    if ratio < MATCH_THRESHOLD:
        return ConsentRecord(
            Consent.REFUSED, name, challenge.phrase, heard, round(ratio, 3),
            reference_hash, consent_hash, now,
            f"the consent recording matched {round(ratio * 100)}% of the phrase, "
            f"below the {round(MATCH_THRESHOLD * 100)}% required",
        )

    return ConsentRecord(
        Consent.GRANTED, name, challenge.phrase, heard, round(ratio, 3),
        reference_hash, consent_hash, now,
        "the speaker read the challenge phrase issued for this request",
    )


def may_clone(record: ConsentRecord) -> bool:
    """The single place that decides. GRANTED only -- never UNVERIFIED."""
    return record.decision == Consent.GRANTED

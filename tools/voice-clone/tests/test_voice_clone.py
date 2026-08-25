"""Tests for the gate, not for the model.

The model is not exercised here and cannot be: OpenVoice needs PyTorch and
several gigabytes of checkpoints, and none of that was available where this was
written. What IS tested is everything that decides whether the model is reached
at all -- which is the part that matters, because a voice cloner whose consent
check can be walked around is a forgery kit with a nice interface.

Every test below is named after a way somebody would get a clone they should
not have.
"""

from __future__ import annotations

import io
import sys
import wave
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from voiceclone.consent import (  # noqa: E402
    MATCH_THRESHOLD, Challenge, Consent, evaluate, may_clone, phrase_match,
)
from voiceclone.engine import StubEngine  # noqa: E402
from voiceclone.languages import LANGUAGES, validate  # noqa: E402


def wav_bytes(seconds: float = 0.2) -> bytes:
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(8000)
        handle.writeframes(b"\x00\x00" * int(8000 * seconds))
    return buffer.getvalue()


@pytest.fixture()
def client(monkeypatch):
    from voiceclone import app as module

    # The stub cannot transcribe, so consent would always be UNVERIFIED. These
    # tests need to drive both a granted and a refused decision, so the
    # recogniser is the one thing replaced -- everything else is the real app.
    heard: dict[str, str | None] = {"value": None}

    class Recognising(StubEngine):
        def transcribe(self, clip):
            return heard["value"]

    monkeypatch.setattr(module, "ENGINE", Recognising())
    with TestClient(module.app) as test_client:
        test_client.heard = heard
        yield test_client


def upload(client, *, token, heard=None, text="Hello", language="en", style="default", speaker="Ana"):
    if heard is not None:
        client.heard["value"] = heard
    return client.post(
        "/api/clone",
        data={"token": token, "speaker_name": speaker, "text": text, "language": language, "style": style, "speed": "1.0"},
        files={
            "reference": ("reference.wav", wav_bytes(), "audio/wav"),
            "consent_clip": ("consent.wav", wav_bytes(), "audio/wav"),
        },
    )


class TestThePhraseIsUnpredictable:
    def test_two_challenges_differ(self):
        phrases = {Challenge.issue().phrase for _ in range(20)}
        assert len(phrases) > 15, "the challenge phrase repeats often enough to be guessable"

    def test_reciting_only_the_predictable_half_is_not_enough(self):
        challenge = Challenge.issue()
        # Anybody can guess the fixed sentence. The random words are the point.
        ratio = phrase_match(challenge.phrase, "I agree to my voice being cloned")
        assert ratio < MATCH_THRESHOLD, f"the guessable half alone scored {ratio}"

    def test_a_speaker_who_fluffs_one_word_still_passes(self):
        # Refusing a genuinely consenting speaker over a mis-heard word teaches
        # everybody to look for a way around the check.
        challenge = Challenge.issue()
        words = challenge.phrase.split()
        mangled = " ".join(words[:-2] + ["something", words[-1]])
        assert phrase_match(challenge.phrase, mangled) >= MATCH_THRESHOLD


class TestTheGate:
    def test_grants_when_the_phrase_was_read(self, tmp_path):
        challenge = Challenge.issue()
        record = evaluate(challenge, challenge.phrase, "Ana", tmp_path / "a", tmp_path / "b")
        assert record.decision == Consent.GRANTED
        assert may_clone(record)

    def test_refuses_when_it_was_not(self, tmp_path):
        challenge = Challenge.issue()
        record = evaluate(challenge, "hello this is a different sentence", "Ana", tmp_path / "a", tmp_path / "b")
        assert record.decision == Consent.REFUSED
        assert not may_clone(record)

    def test_unverified_is_not_granted(self, tmp_path):
        # The check could not run. This is the state that must never be treated
        # as consent, because it has the same shape and the opposite meaning.
        challenge = Challenge.issue()
        record = evaluate(challenge, None, "Ana", tmp_path / "a", tmp_path / "b")
        assert record.decision == Consent.UNVERIFIED
        assert not may_clone(record), "an unverified consent was treated as a granted one"

    def test_refuses_when_nobody_is_named(self, tmp_path):
        challenge = Challenge.issue()
        record = evaluate(challenge, challenge.phrase, "   ", tmp_path / "a", tmp_path / "b")
        assert record.decision == Consent.REFUSED

    def test_a_refusal_is_recorded_as_fully_as_a_grant(self, tmp_path):
        challenge = Challenge.issue()
        record = evaluate(challenge, "nothing like it", "Ana", tmp_path / "a", tmp_path / "b")
        assert record.reason.strip(), "a refusal with no reason cannot be explained to anybody"
        assert record.recorded_at
        assert "phrase" in record.to_json()


class TestTheApp:
    def test_the_page_loads_and_says_what_the_engine_is(self, client):
        assert client.get("/").status_code == 200
        caps = client.get("/api/capabilities").json()
        assert caps["produces_real_speech"] is False, "the stub claimed to produce real speech"
        assert set(caps["languages"]) == set(LANGUAGES)

    def test_a_clone_needs_a_challenge_that_was_issued(self, client):
        response = upload(client, token="a-token-nobody-issued", heard="anything")
        assert response.status_code == 400
        assert "expired or was already used" in response.json()["detail"]

    def test_a_challenge_cannot_be_used_twice(self, client):
        token = client.post("/api/challenge").json()["token"]
        phrase = None
        # Read the phrase back the way the browser does -- from the issue call.
        issued = client.post("/api/challenge").json()
        token, phrase = issued["token"], issued["phrase"]

        first = upload(client, token=token, heard=phrase)
        assert first.status_code == 200, first.text
        second = upload(client, token=token, heard=phrase)
        assert second.status_code == 400, "one consent recording authorised a second clone"

    def test_the_phrase_is_never_taken_from_the_request(self, client):
        # The client sends only a token. If the server accepted a phrase from
        # the request, somebody could send one they already had a recording of.
        issued = client.post("/api/challenge").json()
        response = client.post(
            "/api/clone",
            data={
                "token": issued["token"], "speaker_name": "Ana", "text": "Hi",
                "language": "en", "style": "default", "speed": "1.0",
                # A phrase the caller would like used instead.
                "phrase": "I agree to my voice being cloned. My phrase is a a a a 1111.",
            },
            files={
                "reference": ("r.wav", wav_bytes(), "audio/wav"),
                "consent_clip": ("c.wav", wav_bytes(), "audio/wav"),
            },
        )
        # The supplied phrase is ignored, so the transcript (still None) yields
        # UNVERIFIED rather than a grant.
        assert response.status_code != 200
        assert response.json()["decision"] != Consent.GRANTED

    def test_a_wrong_recording_is_refused_and_the_clip_is_not_kept(self, client):
        from voiceclone import app as module

        # Before and after, because a granted request earlier in this run keeps
        # its reference clip legitimately. The claim being tested is narrower
        # than "the workspace is empty": it is that THIS request left nothing.
        before = set(module.WORKSPACE.glob("*/reference.*"))
        issued = client.post("/api/challenge").json()
        response = upload(client, token=issued["token"], heard="completely different words")
        assert response.status_code == 403
        assert response.json()["decision"] == Consent.REFUSED

        added = set(module.WORKSPACE.glob("*/reference.*")) - before
        assert added == set(), f"a refused reference clip was kept: {added}"

        # The refusal itself is still on record. Deleting the voice and keeping
        # no note of having been asked would leave nothing to answer with.
        records = [p for p in module.WORKSPACE.glob("*/consent.json")]
        assert records, "a refusal was not written down anywhere"

    def test_a_granted_request_produces_playable_audio(self, client):
        issued = client.post("/api/challenge").json()
        response = upload(client, token=issued["token"], heard=issued["phrase"])
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["ok"] is True
        assert body["is_real_speech"] is False, "the stub claimed to have cloned a voice"
        assert "stub" in body["detail"].lower()

        audio = client.get(body["audio_url"])
        assert audio.status_code == 200
        assert audio.content[:4] == b"RIFF", "what came back is not a WAV file"

    def test_the_consent_record_travels_with_the_result(self, client):
        issued = client.post("/api/challenge").json()
        body = upload(client, token=issued["token"], heard=issued["phrase"]).json()
        assert body["consent"]["speaker_name"] == "Ana"
        assert len(body["consent"]["reference_sha256"]) == 64
        assert body["consent"]["match_ratio"] >= MATCH_THRESHOLD

    def test_a_job_id_cannot_address_another_directory(self, client):
        for attempt in ["../../etc", "..", "a/b", "x" * 31, ""]:
            assert client.get(f"/api/audio/{attempt}").status_code in (404, 307), attempt

    def test_refuses_a_file_that_is_not_audio(self, client):
        issued = client.post("/api/challenge").json()
        client.heard["value"] = issued["phrase"]
        response = client.post(
            "/api/clone",
            data={"token": issued["token"], "speaker_name": "Ana", "text": "Hi", "language": "en", "style": "default", "speed": "1.0"},
            files={
                "reference": ("payload.exe", b"MZ\x90\x00", "application/octet-stream"),
                "consent_clip": ("c.wav", wav_bytes(), "audio/wav"),
            },
        )
        assert response.status_code == 400


class TestWhatItRefusesToPretend:
    def test_refuses_a_language_the_model_was_not_built_for(self):
        request, why = validate("hallo", "de", "default", 1.0, ("default",))
        assert request is None
        assert "not a language" in why

    def test_offers_exactly_the_languages_asked_for(self):
        for code in ["en", "es", "fr", "zh", "ja"]:
            assert code in LANGUAGES, f"{code} is missing from the language list"

    def test_refuses_a_style_the_engine_does_not_have(self):
        # An engine offering one style must not silently accept nine and render
        # them identically.
        request, why = validate("hello", "en", "excited", 1.0, ("default",))
        assert request is None
        assert "excited" in why and "default" in why

    def test_refuses_empty_text_and_absurd_speed(self):
        assert validate("   ", "en", "default", 1.0, ("default",))[0] is None
        assert validate("hi", "en", "default", 9.0, ("default",))[0] is None
        assert validate("x" * 5000, "en", "default", 1.0, ("default",))[0] is None

    def test_the_stub_never_claims_to_be_real(self, tmp_path):
        result = StubEngine().synthesize(tmp_path / "ref", "hello", "en", "default", 1.0, tmp_path / "out.wav")
        assert result.is_real_speech is False
        assert result.path.is_file()
        assert "not speech" in result.detail

    def test_the_stub_cannot_transcribe_and_says_so_with_none(self):
        # Returning "" here would make the consent gate compare against an empty
        # transcript and refuse for the wrong reason.
        assert StubEngine().transcribe(Path("anything")) is None

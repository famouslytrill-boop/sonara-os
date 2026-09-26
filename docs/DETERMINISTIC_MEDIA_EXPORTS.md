# Provider-free media exports

The protected Creator Studio Music System now offers two actual downloads:

1. Enter up to 16 notes, a tempo of 60–180 BPM, and download a mono PCM WAV. `-` is a rest. The sound is an original simple tone sequence; it is not synthesized speech or a mastered song.
2. Enter an approved transcript and a duration of 1–60 seconds, then download a WebVTT caption file for media the customer owns. This is not automatic transcription or translation.

Both forms submit to one canonical POST action each: `/api/creator/media/score.wav` and `/api/creator/media/captions.vtt`. Existing Creator Studio workspace authorization protects the page and both actions. The exports write no database or object storage records and invoke no external model. Each response is a private, noncached download. Errors explain how to correct the input and link back to the Music System. There is no prerecorded sample pretending to be a generated result.

`lib/sonara-deterministic-media.cjs` pins 24 kHz, 16-bit mono PCM output and bounds CPU/memory by limiting notes and duration. For the same validated input on the same Node/runtime implementation it yields the same WAV bytes. Cross-runtime floating-point audio equality and identical playback hardware output are not promised. Captions are escaped as plain WebVTT text and have no automatic timing alignment beyond the explicit duration the customer enters.

Verification: `pnpm exec mocha --file tests/setup-env.cjs tests/deterministic-media-export.test.js` and the full root verification matrix. Natural speech, voice cloning, general-purpose translation, realtime media, production GPU workers, and codecs beyond this PCM export require separate services, licenses, consent, and execution proofs. Existing translation records are tenant-scoped; this media export does not modify them.

# GitHub category sweep — 18 August 2026

Method, findings, and an honest account of what this kind of sweep can and
cannot finish. **Review before 18 February 2027**: every repository below is
filtered on "pushed within the last year", and that filter expires.

## Method, including the search that did not work

Filters used: `topic:<name>`, `stars:>N`, `pushed:>2025-08-18`, and `license:`.

The first attempt used free-text search — `restaurant OR point-of-sale OR pos in:name,description` — and returned **postcss, postgrest, oh-my-posh, postal, node-postgres and postgres-operator**. Substring matching on "pos". Zero of eight results were relevant, and the call cost about thirty thousand tokens.

Recording that because it is the useful half of the method: **topic filters find the category, free text finds the spelling.** Anybody repeating this sweep should start from `topic:`.

## Finding 1 — the POS category is mostly closed to us, and the reason is licensing

Of **18** point-of-sale projects above 200 stars pushed in the last year:

| Licence family | Count | Notable |
| --- | --- | --- |
| Reciprocal (GPL/AGPL) | **8** | erpnext (38.2k), frappe/books (4.9k), NexoPOS (1.2k), lakasir (896), OCA/pos (355), **ury (336)**, viewtouch (216), laravel-easy-pos (204) |
| Permissive (MIT/Apache/BSD) | **5** | btcpayserver (7.7k), react-point-of-sale (423), mycompany (318), point-of-sales (271), flutter_pos (209) |
| Other or undeclared | 5 | — |

**Every large one is reciprocal.** `CLAUDE.md` states the rule plainly: a reciprocal licence triggers on network use, so incorporating one into this hosted product obliges releasing this product's source under the same terms. That includes **ury**, which is the only purpose-built restaurant POS in the set and would otherwise have been the obvious candidate.

So the answer for restaurants and POS is not "adopt one". It is either build, or run one *separately* as an owner-operated service reached through an adapter — the arrangement `docs/architecture/EXTERNAL-SERVICES.md` already describes, where the licence obligation sits with the deployment rather than with this codebase.

## Finding 2 — the strongest speech candidate is the one that runs offline

Of text-to-speech projects above 3,000 stars pushed in the last year under MIT or Apache-2.0 (**27** in total), the shortlist:

| Repository | Stars | What it is | Position |
| --- | --- | --- | --- |
| **k2-fsa/sherpa-onnx** | 14.2k | STT, TTS, speaker diarization, enhancement, VAD — **offline, no internet**, 12 languages, embedded through server | The one worth pursuing |
| OpenBMB/VoxCPM | 35.8k | Tokenizer-free TTS, voice **cloning** | Consent-gated only |
| QwenAudio/CosyVoice | 22.8k | Multilingual generation, voice **cloning** | Consent-gated only |
| RVC-Boss/GPT-SoVITS | 61k | Voice **cloning** from one minute of audio | Consent-gated only |
| nari-labs/dia | 19.4k | Ultra-realistic dialogue TTS | Consent-gated only |

**Four of the five headline projects are voice cloning**, and `AGENTS.md` says: *enforce provenance, consent, and anti-clone safety*. This codebase already has `creator_voice_consents` and `song_fingerprints` for exactly that. None of the four is unusable — they are unusable **as a general feature**. Behind the existing consent gate, cloning a voice its owner has recorded permission for is the legitimate case, and it is the only one.

`sherpa-onnx` is different in kind rather than degree: transcription, synthesis and diarization with no cloning emphasis, running with no network call at all. That means **no per-customer cost and no customer audio leaving the owner's machine**, which is the same commercial and privacy argument that made the calculator tools worth building.

## What this sweep is not

The request named roughly forty categories and asked for "all repositories at github.com". Two things are worth stating rather than quietly not doing:

- **There is no finite set.** GitHub holds hundreds of millions of repositories. "All of them that pertain to this application" has no completion state, and a register that claimed to have swept it would be this codebase's own recurring defect — a signal reporting success without being true — at the largest scale yet attempted.
- **The register's standard is per-record.** All 88 existing records were reviewed before they were written. Bulk-adding candidates from search metadata would produce records asserting a review nobody did. The entries added today say exactly what they are based on: licence and metadata from the GitHub API and the project's own description, **not** a source read.

Two categories done properly cost roughly six searches and an afternoon of judgement. Forty categories is a programme of work, and it is worth doing one category at a time in the order the product actually needs them.

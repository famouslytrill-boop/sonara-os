"use strict";

// whisper.cpp — transcripts and captions for a creator's own audio.
//
// MIT, read from GitHub's licence field on 18 August 2026. No whisper.cpp code
// is copied here: this calls `whisper-server`, which the owner runs. **The model
// weights it loads are licensed separately by their publisher and are not
// covered by that MIT grant** — that is the register's own note and it is worth
// repeating at the point somebody would ship something.
//
// ## Why an adapter and not a dependency
//
// A C++ binary plus multi-gigabyte weights is not something a serverless
// function loads. So "adopt whisper.cpp" means the owner runs it somewhere and
// this application reaches it — a decision about infrastructure, not licence.
// The commercial property that makes it worth having: transcription at **no
// per-minute cost**, with the audio never leaving hardware the owner controls.
//
// ## The two hops, and why the first one is the dangerous half
//
// `whisper-server` takes the audio bytes as multipart. It does not fetch a URL.
// So this server fetches the creator's asset and forwards it, which makes it a
// request forwarder unless the target is checked — the same risk Crawl4AI has.
// The check is `base.reasonNotFetchable`, shared between the two rather than
// copied, so the next fix reaches both.
//
// ## The limitation somebody will otherwise meet at 2am
//
// `whisper-server` accepts **WAV** unless it was started with `--convert`,
// which needs ffmpeg on that machine. An MP3 posted to a server started without
// it comes back as a failure from the service, not from here. `readiness` says
// so, so the answer is on the page rather than in a log.

const base = require("./sonara-service-adapter.cjs");

const LABEL = "Whisper";
const PREFIX = "SONARA_WHISPER";

const ENV_KEYS = base.envKeysFor(PREFIX);

// A creator's audio asset. 64MB is roughly an hour of 16-bit 16kHz mono WAV,
// which is what whisper wants anyway; past this the answer is to transcode
// before uploading rather than to stream a film through a serverless function.
const MAX_AUDIO_BYTES = 64 * 1024 * 1024;

// What whisper-server will actually accept without `--convert`.
const NATIVE_TYPES = new Set(["audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave"]);

function getWhisperReadiness(options = {}) {
  const readiness = base.readinessFor({ label: LABEL, prefix: PREFIX, ...options });
  // Said on the readiness rather than only in a comment: an owner reading a
  // settings page should learn this before they upload an MP3, not after.
  readiness.note = "whisper-server accepts WAV unless it was started with --convert, which needs ffmpeg on that machine.";
  return readiness;
}

/**
 * Fetch a creator's audio asset.
 *
 * Separate from `transcribe` so the refusal reasons are testable on their own,
 * and because this half is the one with the security story.
 */
async function collectAudio(target, { fetchImpl = fetch, maxBytes = MAX_AUDIO_BYTES, timeoutMs = 60000 } = {}) {
  const refusal = base.reasonNotFetchable(target);
  if (refusal) return { ok: false, code: "refused_target", detail: refusal };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetchImpl(String(target), { redirect: "follow", signal: controller.signal });
  } catch (error) {
    return {
      ok: false,
      code: error?.name === "AbortError" ? "timed_out" : "failed",
      // Never the error message: it carries the URL, and on a redirect chain
      // that URL may not even be the one the creator typed.
      detail: error?.name === "AbortError"
        ? "The audio took too long to download."
        : "The audio could not be downloaded."
    };
  } finally {
    clearTimeout(timer);
  }

  if (!response?.ok) {
    return { ok: false, code: "unreachable", detail: `The audio could not be downloaded (${response?.status || "no response"}).` };
  }

  const declared = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { ok: false, code: "too_large", detail: `That file is ${declared} bytes; the limit is ${maxBytes}.` };
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  // Measured again after the fact: content-length is a claim, not a measurement,
  // and a server that lies about it would otherwise get past the check above.
  if (bytes.length > maxBytes) {
    return { ok: false, code: "too_large", detail: `That file is ${bytes.length} bytes; the limit is ${maxBytes}.` };
  }
  if (!bytes.length) return { ok: false, code: "empty_file", detail: "That address returned no audio at all." };

  const contentType = String(response.headers?.get?.("content-type") || "").split(";")[0].trim().toLowerCase();
  return { ok: true, bytes, contentType, native: NATIVE_TYPES.has(contentType) };
}

/**
 * Transcribe a creator's audio asset.
 *
 * Returns `{ ok: true, text, segments, converted }` or `{ ok: false, code, detail }`.
 *
 * `converted` is `true` when the file was not WAV and the owner's server had to
 * convert it — reported rather than hidden, because that is the difference
 * between "this worked" and "this worked because ffmpeg happened to be there".
 */
async function transcribe(target, { readiness = getWhisperReadiness(), fetchImpl = fetch, language = "", prompt = "" } = {}) {
  const collected = await collectAudio(target, { fetchImpl });
  if (!collected.ok) return collected;

  const called = await base.postMultipart(readiness, "/inference", {
    file: {
      filename: collected.native ? "audio.wav" : "audio",
      contentType: collected.contentType || "application/octet-stream",
      bytes: collected.bytes
    },
    response_format: "json",
    temperature: "0.0",
    temperature_inc: "0.2",
    ...(language ? { language } : {}),
    ...(prompt ? { prompt: String(prompt).slice(0, 2000) } : {})
  }, { fetchImpl });

  if (!called.ok) {
    if (called.code === "unreachable" && !collected.native) {
      // The most likely cause by a distance, and the one whose real fix is a
      // flag on somebody else's process rather than anything in this code.
      return {
        ok: false,
        code: "needs_conversion",
        detail: `That file is ${collected.contentType || "not WAV"}, and whisper-server only accepts WAV unless it was started with --convert.`
      };
    }
    return called;
  }

  const text = String(called.data?.text || "").trim();
  if (!text) {
    // Not an empty transcript reported as a success. A creator who is told
    // "here is your transcript" and shown nothing has no idea whether the
    // recording was silent or the service was misconfigured.
    return { ok: false, code: "empty_response", detail: "The audio was transcribed and no words came back." };
  }

  const segments = Array.isArray(called.data?.segments)
    ? called.data.segments.map((segment) => ({
        start: segment?.start ?? segment?.t0 ?? null,
        end: segment?.end ?? segment?.t1 ?? null,
        text: String(segment?.text || "").trim()
      })).filter((segment) => segment.text)
    : [];

  return { ok: true, text, segments, converted: !collected.native };
}

module.exports = { ENV_KEYS, MAX_AUDIO_BYTES, NATIVE_TYPES, getWhisperReadiness, collectAudio, transcribe };

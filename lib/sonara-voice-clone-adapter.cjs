"use strict";

// What this application knows about a voice service the owner runs.
//
// `tools/voice-clone/` is a FastAPI app that clones a voice behind a consent
// gate. It cannot live in this application -- torch and several gigabytes of
// checkpoints do not go into a Vercel function, and `vercel.json` bundles only
// `{public/**,routes/**,lib/**}` -- so it is one of the services
// `docs/architecture/EXTERNAL-SERVICES.md` describes: something an owner runs,
// which this application reaches or honestly reports it cannot.
//
// ## What this adapter deliberately does not do
//
// **It never carries audio.** Not the reference clip, not the consent
// recording, not the result. Three reasons, and the first two alone would be
// enough:
//
// A reference clip is somebody's voice. Passing it through this application
// makes this application a place that holds voices, with everything that
// implies about storage, retention and what a breach would mean -- and it gains
// nobody anything, because the owner's own machine is where the file already is
// and where the model already runs.
//
// A serverless function is the wrong pipe. There is no multipart parser here --
// Express 4 has none and this application has one production dependency, which
// is why even the spreadsheet importer takes a paste. Proxying tens of
// megabytes through a function with a payload ceiling and an execution limit
// would be building a bottleneck on purpose.
//
// And the consent gate lives at the service. Relaying a clone request through
// here would put this application in the position of vouching for a consent it
// never saw.
//
// So what crosses this boundary is **one GET that returns no audio and no
// personal data**: which engine is loaded, whether it produces real speech,
// which languages and which styles. The owner works in their own instance; this
// application says whether it is there, what it can do, and what it refuses to
// do without consent.
//
// ## The shared secret is not optional
//
// EXTERNAL-SERVICES.md is blunt about it: a tunnel makes a service reachable by
// everyone, not only by this application, and an exposed voice cloner is worse
// than an exposed model endpoint. So `SONARA_VOICE_CLONE_TOKEN` is declared as
// a required secret rather than an optional one -- readiness reports
// setup_required without it, and the service refuses a request that does not
// present it.

const base = require("./sonara-service-adapter.cjs");

const LABEL = "Voice studio";
const PREFIX = "SONARA_VOICE_CLONE";

const ENV_KEYS = base.envKeysFor(PREFIX, ["token"]);

function getVoiceCloneReadiness(options = {}) {
  return base.readinessFor({ label: LABEL, prefix: PREFIX, secrets: ["token"], ...options });
}

// GET, because there is nothing to send. Written here rather than added to the
// shared helper because this is the only adapter in the family that reads
// rather than asks, and a `getJson` nothing else uses would be a shared
// abstraction with one caller.
async function capabilities(readiness = getVoiceCloneReadiness(), { fetchImpl = fetch } = {}) {
  if (!readiness?.enabled) {
    return { ok: false, code: "disabled", detail: readiness?.detail || `${LABEL} is off.` };
  }
  if (readiness.status !== "configured") {
    return { ok: false, code: readiness.status, detail: readiness.detail };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), readiness.timeoutMs || base.DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetchImpl(`${readiness.baseUrl}/api/capabilities`, {
      method: "GET",
      headers: { Accept: "application/json", Authorization: `Bearer ${readiness.token}` },
      signal: controller.signal
    });
    if (!response?.ok) {
      return {
        ok: false,
        code: response?.status === 401 || response?.status === 403 ? "rejected" : "unreachable",
        detail: response?.status === 401 || response?.status === 403
          ? `${ENV_KEYS.token} was not accepted by the service.`
          : `The service did not answer (${response?.status || "no response"}).`
      };
    }

    const data = await response.json().catch(() => null);
    if (!data || typeof data !== "object") {
      return { ok: false, code: "unreadable_response", detail: "The service answered with something that is not JSON." };
    }
    return { ok: true, data: summarise(data) };
  } catch (error) {
    // The message is never passed through: a fetch error carries the URL it
    // failed on, and that URL is configuration.
    return {
      ok: false,
      code: error?.name === "AbortError" ? "timed_out" : "failed",
      detail: error?.name === "AbortError"
        ? `The service did not answer within ${readiness.timeoutMs || base.DEFAULT_TIMEOUT_MS}ms.`
        : "The call to the service failed."
    };
  } finally {
    clearTimeout(timer);
  }
}

// Only the fields this application renders, and each one narrowed to a shape a
// page can trust. A service answering with an unexpected type must not reach a
// template -- and passing the whole body through would also carry anything the
// service adds later, straight onto a page nobody re-read.
function summarise(data) {
  const languages = data.languages && typeof data.languages === "object" && !Array.isArray(data.languages)
    ? Object.entries(data.languages)
      .filter(([code, name]) => typeof code === "string" && typeof name === "string")
      .slice(0, 40)
      .map(([code, name]) => ({ code, name }))
    : [];

  const styles = Array.isArray(data.styles)
    ? data.styles.filter((style) => typeof style === "string").slice(0, 40)
    : [];

  return {
    engine: typeof data.engine === "string" ? data.engine.slice(0, 60) : "unknown",
    // Absent is not false. A service that did not say must not be reported as
    // having said no -- the page shows "it did not say" instead.
    producesRealSpeech: typeof data.produces_real_speech === "boolean" ? data.produces_real_speech : null,
    note: typeof data.engine_note === "string" ? data.engine_note.slice(0, 300) : "",
    languages,
    styles
  };
}

module.exports = { ENV_KEYS, LABEL, getVoiceCloneReadiness, capabilities, summarise };

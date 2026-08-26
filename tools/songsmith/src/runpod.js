"use strict";

// The generation backend: a RunPod serverless endpoint.
//
// ## `/runsync` is not used, and that is deliberate
//
// RunPod offers `/runsync`, which holds the connection open and returns the
// result. It is the obvious call to make and it is a trap for a job that takes
// minutes:
//
//   - if the response has not arrived within its window, the request returns
//     without the result -- and the job is **still running and still billed**,
//     with no id in hand to poll or cancel it with. The work is paid for and
//     unreachable.
//   - `/runsync` results are discarded after about a minute, against about
//     thirty minutes for `/run`. A caller that reconnects a little late finds
//     the job finished and the output gone.
//
// So: `/run` to submit, `/status/{id}` to poll, `/cancel/{id}` to stop. The job
// id is written to the song row before anything else happens, so a crash
// between submitting and storing cannot orphan a paid job.
//
// ## Progress is reported, never invented
//
// A progress bar that climbs on a timer is the exact defect this codebase keeps
// finding: a signal that reports more than happened. `progress` here is `null`
// unless the backend actually said a number. `null` renders as "working on it"
// and 0 renders as "0%", because those are different facts.
//
// ## Statuses
//
// IN_QUEUE, IN_PROGRESS, COMPLETED, FAILED, CANCELLED, TIMED_OUT. Every one is
// mapped below; an unrecognised status is surfaced by name rather than folded
// into "failed", because a status this does not know about is news about
// RunPod, not about the song.

const STATES = {
  IN_QUEUE: "queued",
  IN_PROGRESS: "running",
  COMPLETED: "ready",
  FAILED: "failed",
  CANCELLED: "cancelled",
  TIMED_OUT: "failed"
};

const DEFAULT_BASE = "https://api.runpod.ai/v2";

class NotConfigured extends Error {
  constructor() {
    super("No generation backend is configured. Set RUNPOD_API_KEY and RUNPOD_ENDPOINT_ID.");
    this.notConfigured = true;
  }
}

/**
 * Build a client.
 *
 * `fetchImpl` is injectable so the tests drive this against a scripted backend
 * rather than the network. It defaults to the global `fetch`.
 */
function createClient({
  apiKey = process.env.RUNPOD_API_KEY || "",
  endpointId = process.env.RUNPOD_ENDPOINT_ID || "",
  baseUrl = process.env.RUNPOD_BASE_URL || DEFAULT_BASE,
  fetchImpl = globalThis.fetch,
  timeoutMs = 30000
} = {}) {
  const configured = Boolean(apiKey && endpointId);

  async function call(method, path, body) {
    if (!configured) throw new NotConfigured();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetchImpl(`${baseUrl}/${endpointId}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json"
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal
      });
    } catch (error) {
      // A network failure is not a failed job. The caller must be able to tell
      // them apart, because one means "try again" and the other means "this
      // song will never arrive".
      throw Object.assign(new Error(`Could not reach the generation backend: ${error.message}`), { unreachable: true });
    } finally {
      clearTimeout(timer);
    }

    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }
    if (!response.ok) {
      const detail = (payload && (payload.error || payload.message)) || text.slice(0, 300) || "no detail";
      throw Object.assign(new Error(`The generation backend answered ${response.status}: ${detail}`), {
        status: response.status,
        // 5xx and 429 are worth trying again; 4xx is the request being wrong.
        retryable: response.status >= 500 || response.status === 429
      });
    }
    if (!payload) {
      throw new Error("The generation backend answered with something that is not JSON.");
    }
    return payload;
  }

  return {
    configured,

    /** Submit a job. Returns the RunPod job id. */
    async submit(input) {
      const payload = await call("POST", "/run", { input });
      const id = payload && payload.id;
      if (!id) {
        // Without an id there is nothing to poll and nothing to cancel, and the
        // job may well be running. Say exactly that rather than "failed".
        throw new Error("The generation backend accepted the job but did not return an id, so it cannot be tracked.");
      }
      return { id, state: STATES[payload.status] || "queued", raw: payload.status || "IN_QUEUE" };
    },

    /** Poll a job. */
    async status(jobId) {
      return read(await call("GET", `/status/${encodeURIComponent(jobId)}`));
    },

    async cancel(jobId) {
      return read(await call("POST", `/cancel/${encodeURIComponent(jobId)}`));
    }
  };
}

/**
 * Turn a RunPod status payload into what a song row needs.
 *
 * Everything unknown is carried through by name. `state` is only one of the
 * five the schema allows; `unknownStatus` is set when the mapping had to guess,
 * so a caller can log it rather than silently treating a new RunPod status as
 * "still running" for ever.
 */
function read(payload) {
  const raw = String((payload && payload.status) || "");
  const known = Object.prototype.hasOwnProperty.call(STATES, raw);
  const output = payload && payload.output;

  const result = {
    raw,
    state: known ? STATES[raw] : "running",
    unknownStatus: known ? null : raw,
    progress: null,
    audioBase64: null,
    audioUrl: null,
    durationMs: null,
    error: ""
  };

  // Only a number the backend actually sent. See the note at the top.
  const reported = output && typeof output === "object" ? output.progress : null;
  if (typeof reported === "number" && Number.isFinite(reported)) {
    result.progress = Math.max(0, Math.min(100, Math.round(reported)));
  }

  if (raw === "FAILED" || raw === "TIMED_OUT") {
    const detail = (payload && (payload.error || (output && output.error))) || "";
    result.error = raw === "TIMED_OUT"
      ? `The generation backend timed out.${detail ? ` ${detail}` : ""}`
      : String(detail || "The generation backend reported a failure with no detail.");
  }

  if (result.state === "ready") {
    if (output && typeof output === "object") {
      if (typeof output.audio_base64 === "string" && output.audio_base64) result.audioBase64 = output.audio_base64;
      else if (typeof output.audio === "string" && output.audio) result.audioBase64 = output.audio;
      else if (typeof output.audio_url === "string" && output.audio_url) result.audioUrl = output.audio_url;
      if (typeof output.duration_ms === "number") result.durationMs = Math.round(output.duration_ms);
      else if (typeof output.duration === "number") result.durationMs = Math.round(output.duration * 1000);
    }
    if (!result.audioBase64 && !result.audioUrl) {
      // COMPLETED with nothing to play is a failure, and it must be recorded as
      // one. A song row left in `ready` with an empty `audio_path` is a play
      // button that does nothing and a state nothing will ever retry.
      result.state = "failed";
      result.error = "The generation backend reported the job complete but returned no audio.";
    }
  }

  return result;
}

module.exports = { createClient, read, STATES, NotConfigured, DEFAULT_BASE };

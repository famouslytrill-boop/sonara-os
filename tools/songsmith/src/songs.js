"use strict";

// Between "somebody pressed generate" and "there is a file to play".
//
// ## The order of writes
//
// Row first, then submit, then **store the job id before anything else**. Every
// other order loses something real:
//
//   - submitting before the row exists means a crash leaves a paid job running
//     with nothing on this side that knows about it
//   - doing any further work between the submit returning and the id being
//     written widens the window in which that same thing can happen
//
// ## Polling, not webhooks
//
// RunPod can call a webhook, and a self-hosted install behind somebody's router
// usually cannot receive one. Polling works from anywhere, so polling is the
// default and the only path. Every open job is asked about on a timer; a job
// that has been open far too long is failed by name rather than left spinning
// in front of somebody who is waiting.

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const db = require("./db.js");
const audio = require("./audio.js");

// After this long with no terminal status, stop asking. RunPod keeps results
// for about thirty minutes; past that there is nothing left to collect even if
// the job did finish, so continuing to poll only keeps a spinner turning.
const GIVE_UP_AFTER_MS = 45 * 60 * 1000;

// A generated song is a few megabytes. 64 is generous and it is a limit rather
// than an expectation -- without one, a backend that answers with a video fills
// the disk.
const MAX_AUDIO_BYTES = 64 * 1024 * 1024;

function newSeed() {
  // 31 bits, positive, and comfortably inside what a JSON number and an SQLite
  // integer both hold exactly.
  return crypto.randomBytes(4).readUInt32BE(0) % 0x7fffffff;
}

function audioPathFor(dataDir, songId) {
  return path.join(dataDir, "audio", `${songId}.m4a`);
}

/**
 * Start a song.
 *
 * A backend that is not configured, or not reachable, produces a `failed` song
 * with the reason on it rather than a thrown error -- the person pressed a
 * button and is entitled to see what happened to it.
 */
async function start(ctx, { user, title, prompt, lyrics, style, seed }) {
  const id = crypto.randomUUID();
  const chosenSeed = Number.isInteger(seed) && seed >= 0 ? seed : newSeed();

  const song = db.createSong(ctx.db, {
    id,
    userId: user.id,
    title: String(title || "").trim().slice(0, 120) || "Untitled",
    prompt: String(prompt || "").slice(0, 4000),
    lyrics: String(lyrics || "").slice(0, 20000),
    style: String(style || "").slice(0, 1000),
    seed: chosenSeed
  });

  let submitted;
  try {
    submitted = await ctx.backend.submit({
      prompt: song.prompt,
      lyrics: song.lyrics,
      style: song.style,
      seed: chosenSeed,
      // Asked for explicitly rather than left to the backend's default, because
      // the whole application says "stereo M4A" to the person using it.
      format: "m4a",
      channels: 2
    });
  } catch (error) {
    db.updateSong(ctx.db, id, {
      state: "failed",
      error: error.notConfigured
        ? "No generation backend is configured, so this song was never submitted. Nothing has been charged."
        : String(error.message)
    });
    return { ok: false, problem: error.message, song: db.findSong(ctx.db, id) };
  }

  // Immediately, before anything else. See the note at the top.
  db.updateSong(ctx.db, id, { job_id: submitted.id, state: submitted.state === "ready" ? "running" : submitted.state });
  return { ok: true, song: db.findSong(ctx.db, id) };
}

/**
 * Ask about one open job and write down what it said.
 *
 * Returns the reason it did something, for the log, or null when nothing
 * changed. Never throws for an unreachable backend: one bad endpoint must not
 * stop every other song from being asked about.
 */
async function pollOne(ctx, song, now = Date.now()) {
  if (!song.job_id) {
    // A row with no job id and an open state can only come from a crash between
    // the submit and the write. There is nothing to poll, and pretending
    // otherwise leaves it queued for ever.
    if (now - song.created_at > 60000) {
      db.updateSong(ctx.db, song.id, {
        state: "failed",
        error: "This song was never registered with the generation backend, so there is nothing to collect."
      });
      return "no job id";
    }
    return null;
  }

  let status;
  try {
    status = await ctx.backend.status(song.job_id);
  } catch (error) {
    if (now - song.created_at > GIVE_UP_AFTER_MS) {
      db.updateSong(ctx.db, song.id, { state: "failed", error: `Gave up asking about this job: ${error.message}` });
      return "gave up";
    }
    // Otherwise leave it alone. An unreachable backend is news about the
    // network, not about the song, and marking it failed would throw away a job
    // that is very likely still running.
    return null;
  }

  if (status.unknownStatus) {
    ctx.log(`songsmith: RunPod reported a status this does not know about: ${status.unknownStatus}`);
  }

  if (status.state === "queued" || status.state === "running") {
    if (now - song.created_at > GIVE_UP_AFTER_MS) {
      db.updateSong(ctx.db, song.id, {
        state: "failed",
        error: "This job never finished. RunPod discards results after about thirty minutes, so there is nothing left to collect."
      });
      return "timed out locally";
    }
    const fields = { state: status.state };
    // Only written when the backend said a number. A progress bar that moves on
    // its own is a claim about work nobody observed.
    if (status.progress !== null) fields.progress = status.progress;
    db.updateSong(ctx.db, song.id, fields);
    return null;
  }

  if (status.state !== "ready") {
    db.updateSong(ctx.db, song.id, { state: status.state, error: status.error || "" });
    return status.state;
  }

  // --- it says it is done -------------------------------------------------

  let bytes;
  try {
    bytes = await collect(ctx, status);
  } catch (error) {
    db.updateSong(ctx.db, song.id, { state: "failed", error: `The song finished but could not be collected: ${error.message}` });
    return "uncollectable";
  }

  const checked = audio.check(bytes);
  if (!checked.ok) {
    db.updateSong(ctx.db, song.id, { state: "failed", error: `The backend returned something that is not playable audio. ${checked.problem}` });
    return "not audio";
  }

  const file = audioPathFor(ctx.dataDir, song.id);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, bytes);

  db.updateSong(ctx.db, song.id, {
    state: "ready",
    progress: 100,
    audio_path: file,
    duration_ms: status.durationMs === null ? null : status.durationMs,
    // Notes rather than an error: the song plays, and the person should still
    // be told it came back mono when they asked for stereo.
    error: checked.notes.join(" ")
  });
  return "ready";
}

async function collect(ctx, status) {
  if (status.audioBase64) {
    const bytes = Buffer.from(status.audioBase64, "base64");
    if (bytes.length > MAX_AUDIO_BYTES) throw new Error(`the audio is over ${MAX_AUDIO_BYTES} bytes`);
    if (!bytes.length) throw new Error("the base64 audio decoded to nothing");
    return bytes;
  }
  const url = new URL(status.audioUrl);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`the audio URL uses ${url.protocol}, which is not fetched`);
  }
  const response = await (ctx.fetchImpl || globalThis.fetch)(url.href, { redirect: "follow" });
  if (!response.ok) throw new Error(`downloading it answered ${response.status}`);
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_AUDIO_BYTES) {
    throw new Error(`it is ${declared} bytes, over the ${MAX_AUDIO_BYTES} limit`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  // Checked again after the fact: content-length is a claim, not a measurement.
  if (bytes.length > MAX_AUDIO_BYTES) throw new Error(`it is ${bytes.length} bytes, over the limit`);
  return bytes;
}

/** Every open job, once. */
async function pollAll(ctx, now = Date.now()) {
  const reasons = [];
  for (const song of db.openJobs(ctx.db)) {
    try {
      const reason = await pollOne(ctx, song, now);
      if (reason) reasons.push({ id: song.id, reason });
    } catch (error) {
      ctx.log(`songsmith: polling ${song.id} threw: ${error.stack || error.message}`);
    }
  }
  return reasons;
}

/** Delete a song, and its file with it. */
function remove(ctx, song) {
  if (song.audio_path) {
    try {
      fs.rmSync(song.audio_path, { force: true });
    } catch (error) {
      // The row still goes. A file that could not be removed is a tidiness
      // problem; a row that survives a delete is the person's song still being
      // listed after they deleted it.
      ctx.log(`songsmith: could not remove ${song.audio_path}: ${error.message}`);
    }
  }
  return db.deleteSong(ctx.db, song.id);
}

/** Same words, same style, same seed: the same song again. */
async function replay(ctx, song, user) {
  return start(ctx, {
    user,
    title: `${song.title} (again)`,
    prompt: song.prompt,
    lyrics: song.lyrics,
    style: song.style,
    seed: song.seed
  });
}

module.exports = { start, pollOne, pollAll, remove, replay, newSeed, audioPathFor, GIVE_UP_AFTER_MS, MAX_AUDIO_BYTES };

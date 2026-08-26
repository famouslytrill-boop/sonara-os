"use strict";

// The page shell, and the escaping.
//
// ## One escape function, and a tag that cannot be forgotten
//
// `html` is a template tag: every interpolated value is escaped unless it is
// explicitly wrapped in `raw()`. That is the way round that fails safe. The
// alternative -- escape at each call site -- works until the one place somebody
// forgets, and that place is indistinguishable from the rest by reading.
//
// ## No inline script, because the CSP says so and means it
//
// `script-src 'self'` with no `unsafe-inline`. The one script this application
// has is served as a file. That rules out `onclick=` attributes entirely, so
// every action is a form post -- which is also why the whole thing works with
// JavaScript switched off.

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

function escape(value) {
  return String(value === null || value === undefined ? "" : value).replace(/[&<>"']/g, (character) => ESCAPES[character]);
}

class Raw {
  constructor(text) {
    this.text = text;
  }
  toString() {
    return this.text;
  }
}

function raw(text) {
  return new Raw(String(text));
}

function render(value) {
  if (value instanceof Raw) return value.text;
  if (Array.isArray(value)) return value.map(render).join("");
  if (value === null || value === undefined || value === false) return "";
  return escape(value);
}

function html(strings, ...values) {
  let out = strings[0];
  for (let index = 0; index < values.length; index += 1) {
    out += render(values[index]) + strings[index + 1];
  }
  return raw(out);
}

// --- the shell ------------------------------------------------------------

function layout({ title, user, body, problem = "", notice = "" }) {
  const links = [];
  if (user) {
    links.push(["/songs", "My songs"]);
    links.push(["/new", "Write a song"]);
    links.push(["/community", "Shared"]);
    if (user.is_admin) links.push(["/admin", "People"]);
  }

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escape(title)} &middot; Songsmith</title>
<link rel="stylesheet" href="/app.css">
</head>
<body>
<header class="bar">
  <a class="mark" href="${user ? "/songs" : "/"}">Songsmith</a>
  ${links.length ? `<nav>${links.map(([href, label]) => `<a href="${escape(href)}">${escape(label)}</a>`).join("")}</nav>` : ""}
  ${user ? `<form method="post" action="/sign-out" class="inline">
    <input type="hidden" name="csrf" value="${escape(user.csrf)}">
    <button class="quiet" type="submit">Sign out</button>
  </form>` : ""}
</header>
<main>
${problem ? `<p class="problem" role="alert">${escape(problem)}</p>` : ""}
${notice ? `<p class="notice">${escape(notice)}</p>` : ""}
${render(body)}
</main>
<footer><p>Songsmith runs on your own machine. Songs are private unless you share them.</p></footer>
<script src="/app.js" defer></script>
</body>
</html>`;
}

// --- small pieces used by more than one page ------------------------------

function when(milliseconds) {
  if (!Number.isFinite(Number(milliseconds))) return "";
  return `${new Date(Number(milliseconds)).toISOString().replace("T", " ").slice(0, 16)} UTC`;
}

function duration(milliseconds) {
  // null is "nobody said", and it renders as nothing rather than as 0:00 --
  // which would be a claim that the song is empty.
  if (milliseconds === null || milliseconds === undefined || !Number.isFinite(Number(milliseconds))) return "";
  const total = Math.round(Number(milliseconds) / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * The progress line for a song being made.
 *
 * Three states rather than two, and the middle one is the honest one: a job
 * that is running and has reported no percentage says so, instead of showing a
 * bar at a number nobody measured.
 */
function progressOf(song) {
  if (song.state === "queued") return { label: "Waiting for a worker", value: null };
  if (song.state !== "running") return { label: "", value: null };
  if (song.progress === null || song.progress === undefined) return { label: "Working on it", value: null };
  return { label: `${song.progress}%`, value: Number(song.progress) };
}

const STATE_WORDS = {
  queued: "Queued",
  running: "Being made",
  ready: "Ready",
  failed: "Did not work",
  cancelled: "Cancelled"
};

module.exports = { html, raw, escape, render, layout, when, duration, progressOf, STATE_WORDS, Raw };

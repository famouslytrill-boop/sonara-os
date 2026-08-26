"use strict";

// The pages.
//
// Every action is a form post carrying a CSRF token, and there is no client
// script that is required for anything to work -- `public/app.js` refreshes a
// song that is still being made and nothing else. A person with JavaScript
// switched off can still write, generate, play, rename, share and delete; they
// press reload instead of watching a number change.

const { html, raw, layout, when, duration, progressOf, STATE_WORDS } = require("./html.js");
const { structureOf, STYLES } = require("./lyrics.js");

function csrf(user) {
  return html`<input type="hidden" name="csrf" value="${user.csrf}">`;
}

// --- signed out -----------------------------------------------------------

function landing({ problem, notice, openToRequests, firstRun }) {
  const body = html`
<section class="hero">
  <h1>Turn an idea into a song</h1>
  <p class="lead">Write a few lines, or a sentence about what the song should be.
     Pick a style. Songsmith sends it to your own generation backend and gives you
     back a stereo track you can play here.</p>
</section>

<div class="split">
  <section class="card">
    <h2>Sign in</h2>
    <form method="post" action="/sign-in">
      <label>Email <input type="email" name="email" autocomplete="username" required></label>
      <label>Password <input type="password" name="password" autocomplete="current-password" required></label>
      <button type="submit">Sign in</button>
    </form>
  </section>

  <section class="card">
    <h2>${firstRun ? "Create the first account" : "Ask for an account"}</h2>
    ${firstRun
      ? html`<p class="fine">Nobody has an account here yet. The first one is created straight away and can
             approve everybody after it.</p>`
      : html`<p class="fine">Accounts are approved by hand. You will be able to sign in once somebody
             has said yes.</p>`}
    ${openToRequests || firstRun
      ? html`<form method="post" action="/request">
          <label>Name <input type="text" name="display_name" autocomplete="name" maxlength="60"></label>
          <label>Email <input type="email" name="email" autocomplete="username" required></label>
          <label>Password <input type="password" name="password" autocomplete="new-password" minlength="10" required>
            <span class="fine">At least 10 characters.</span></label>
          ${firstRun ? "" : html`<label>Why you would like an account
            <textarea name="reason" rows="3" maxlength="500"></textarea></label>`}
          <button type="submit">${firstRun ? "Create it" : "Ask"}</button>
        </form>`
      : html`<p>This installation is not taking new requests at the moment.</p>`}
  </section>
</div>`;

  return layout({ title: "Songsmith", user: null, body, problem, notice });
}

// --- writing --------------------------------------------------------------

function compose({ user, draft = {}, problem, notice, backendReady, drafterConfigured }) {
  const body = html`
<h1>Write a song</h1>

${backendReady ? "" : html`<p class="problem">No generation backend is configured, so nothing can be
  submitted yet. Set <code>RUNPOD_API_KEY</code> and <code>RUNPOD_ENDPOINT_ID</code> and restart.</p>`}

${draft.source
  ? html`<p class="notice">${draft.source === "model"
      ? "Drafted by the writing model. Edit it before you generate."
      : "This is a structure to write into, not a written draft — no writing model is configured, so nothing has written any words. Replace every line in brackets."}</p>`
  : ""}

<form method="post" action="/draft" class="card">
  <h2>Get a draft</h2>
  <p class="fine">Describe the song and Songsmith fills the boxes below.
    ${drafterConfigured ? "A writing model is configured." : "No writing model is configured, so this gives you the section headings only."}</p>
  ${csrf(user)}
  <label>What is it about
    <input type="text" name="idea" maxlength="500" value="${draft.idea || ""}"
           placeholder="driving home at four in the morning, nobody else awake"></label>
  <button type="submit" class="quiet">Draft it</button>
</form>

<form method="post" action="/new">
  ${csrf(user)}
  <label>Title <input type="text" name="title" maxlength="120" value="${draft.title || ""}"></label>

  <label>Style
    <input type="text" name="style" maxlength="500" list="styles" value="${draft.style || ""}"
           placeholder="synthwave, mid tempo, analogue pads, breathy vocal"></label>
  <datalist id="styles">${STYLES.map((name) => html`<option value="${name}"></option>`)}</datalist>

  <label>Lyrics
    <textarea name="lyrics" rows="18" maxlength="20000"
      placeholder="[Verse 1]&#10;...&#10;&#10;[Chorus]&#10;...">${draft.lyrics || ""}</textarea>
    <span class="fine">Section headings in square brackets — [Verse 1], [Chorus] — tell the backend
      where the structure is.</span></label>

  <label>Notes for the backend
    <textarea name="prompt" rows="3" maxlength="4000">${draft.prompt || ""}</textarea>
    <span class="fine">Anything that is not lyrics and not style. Optional.</span></label>

  <button type="submit"${backendReady ? "" : raw(" disabled")}>Generate</button>
</form>`;

  return layout({ title: "Write a song", user, body, problem, notice });
}

// --- lists ----------------------------------------------------------------

function songRow(song, { showOwner = false } = {}) {
  const progress = progressOf(song);
  return html`<li class="song ${song.state}">
    <a class="song-title" href="/songs/${song.id}">${song.title}</a>
    <span class="badge ${song.state}">${STATE_WORDS[song.state] || song.state}</span>
    ${progress.label ? html`<span class="fine">${progress.label}</span>` : ""}
    ${song.duration_ms ? html`<span class="fine">${duration(song.duration_ms)}</span>` : ""}
    ${showOwner ? html`<span class="fine">by ${song.owner_name || song.owner_email || "somebody"}</span>` : ""}
    ${song.visibility === "shared" ? html`<span class="fine">shared</span>` : ""}
    <span class="fine">${when(song.created_at)}</span>
  </li>`;
}

function mySongs({ user, songs, problem, notice }) {
  const body = html`
<h1>My songs</h1>
<p><a class="button" href="/new">Write a song</a></p>
${songs.length
  ? html`<ul class="songs">${songs.map((song) => songRow(song))}</ul>`
  : html`<p class="empty">Nothing here yet. <a href="/new">Write the first one.</a></p>`}`;
  return layout({ title: "My songs", user, body, problem, notice });
}

function community({ user, songs, problem, notice }) {
  const body = html`
<h1>Shared songs</h1>
<p class="fine">Songs other people here have chosen to share. Everything else stays private to whoever made it.</p>
${songs.length
  ? html`<ul class="songs">${songs.map((song) => songRow(song, { showOwner: true }))}</ul>`
  : html`<p class="empty">Nobody has shared a song yet.</p>`}`;
  return layout({ title: "Shared songs", user, body, problem, notice });
}

// --- one song -------------------------------------------------------------

function songPage({ user, song, mine, ownerName, problem, notice }) {
  const sections = structureOf(song.lyrics);
  const progress = progressOf(song);
  const working = song.state === "queued" || song.state === "running";

  const body = html`
<article class="song-page"${working ? raw(` data-refresh="/songs/${song.id}"`) : ""}>
  <p class="crumb"><a href="${mine ? "/songs" : "/community"}">${mine ? "My songs" : "Shared songs"}</a></p>
  <h1>${song.title}</h1>
  <p class="fine">
    <span class="badge ${song.state}">${STATE_WORDS[song.state] || song.state}</span>
    ${mine ? "" : html`by ${ownerName || "somebody"}`}
    ${when(song.created_at)}
    ${song.duration_ms ? html`&middot; ${duration(song.duration_ms)}` : ""}
    &middot; seed ${song.seed}
  </p>

  ${working
    ? html`<div class="working">
        <p>${progress.label}</p>
        ${progress.value === null
          ? html`<p class="fine">The backend has not reported a percentage, so there is no bar to show —
                 this page checks again every few seconds.</p>`
          : html`<progress max="100" value="${progress.value}">${progress.value}%</progress>`}
      </div>`
    : ""}

  ${song.state === "ready"
    ? html`<audio controls preload="metadata" src="/songs/${song.id}/audio"></audio>
           <p class="fine"><a href="/songs/${song.id}/audio?download=1">Download the M4A</a></p>`
    : ""}

  ${song.error
    ? html`<p class="${song.state === "ready" ? "notice" : "problem"}">${song.error}</p>`
    : ""}

  <div class="split">
    <section>
      <h2>Lyrics</h2>
      ${song.lyrics ? html`<pre class="lyrics">${song.lyrics}</pre>` : html`<p class="fine">No lyrics were written for this one.</p>`}
    </section>
    <section>
      <h2>Style</h2>
      <p>${song.style || raw('<span class="fine">Nothing was said about the style.</span>')}</p>
      <h2>Structure</h2>
      ${sections.length
        ? html`<ol class="structure">${sections.map((name) => html`<li>${name}</li>`)}</ol>`
        : html`<p class="fine">No sections were marked in the lyrics.</p>`}
      ${song.prompt ? html`<h2>Notes</h2><p>${song.prompt}</p>` : ""}
    </section>
  </div>

  ${mine
    ? html`<div class="actions">
        <form method="post" action="/songs/${song.id}/rename" class="inline">
          ${csrf(user)}
          <label class="inline">Rename <input type="text" name="title" maxlength="120" value="${song.title}"></label>
          <button type="submit" class="quiet">Save</button>
        </form>

        <form method="post" action="/songs/${song.id}/visibility" class="inline">
          ${csrf(user)}
          <input type="hidden" name="visibility" value="${song.visibility === "shared" ? "private" : "shared"}">
          <button type="submit" class="quiet"${song.state === "ready" ? "" : raw(" disabled")}>
            ${song.visibility === "shared" ? "Stop sharing" : "Share with everybody here"}</button>
          ${song.state === "ready" ? "" : html`<span class="fine">A song can be shared once it is ready.</span>`}
        </form>

        ${song.state === "queued" || song.state === "running"
          ? html`<form method="post" action="/songs/${song.id}/cancel" class="inline">
              ${csrf(user)}
              <button type="submit" class="quiet">Stop making it</button>
              <span class="fine">A job that keeps running keeps costing.</span>
            </form>`
          : ""}

        <form method="post" action="/songs/${song.id}/replay" class="inline">
          ${csrf(user)}
          <button type="submit" class="quiet">Make it again with the same seed</button>
        </form>

        <form method="post" action="/songs/${song.id}/delete" class="inline danger">
          ${csrf(user)}
          <button type="submit" class="quiet">Delete</button>
        </form>
      </div>`
    : ""}
</article>`;

  return layout({ title: song.title, user, body, problem, notice });
}

// --- admin ----------------------------------------------------------------

function adminPage({ user, users, problem, notice, adminCount }) {
  const waiting = users.filter((row) => row.status === "pending");

  const row = (person) => {
    const self = person.id === user.id;
    const lastAdmin = person.is_admin && person.status === "active" && adminCount <= 1;
    return html`<tr class="${person.status}">
      <td>
        <strong>${person.display_name || person.email}</strong>
        ${person.is_admin ? html`<span class="badge">admin</span>` : ""}
        <div class="fine">${person.email}</div>
        ${person.reason ? html`<div class="fine reason">${person.reason}</div>` : ""}
      </td>
      <td>${person.status}<div class="fine">asked ${when(person.created_at)}</div></td>
      <td class="row-actions">
        ${person.status === "pending"
          ? html`<form method="post" action="/admin/users/${person.id}/status" class="inline">
              ${csrf(user)}<input type="hidden" name="status" value="active">
              <button type="submit">Approve</button></form>`
          : ""}
        ${person.status === "active" && !self && !lastAdmin
          ? html`<form method="post" action="/admin/users/${person.id}/status" class="inline">
              ${csrf(user)}<input type="hidden" name="status" value="disabled">
              <button type="submit" class="quiet">Disable</button></form>`
          : ""}
        ${person.status === "disabled"
          ? html`<form method="post" action="/admin/users/${person.id}/status" class="inline">
              ${csrf(user)}<input type="hidden" name="status" value="active">
              <button type="submit" class="quiet">Enable</button></form>`
          : ""}
        ${self ? html`<span class="fine">this is you</span>` : ""}
        ${lastAdmin && !self ? html`<span class="fine">the only admin</span>` : ""}
        ${!self && !lastAdmin
          ? html`<form method="post" action="/admin/users/${person.id}/delete" class="inline danger">
              ${csrf(user)}<button type="submit" class="quiet">Delete</button></form>`
          : ""}
      </td>
    </tr>`;
  };

  const body = html`
<h1>People</h1>
<p class="fine">${waiting.length
  ? `${waiting.length} ${waiting.length === 1 ? "person is" : "people are"} waiting to be approved.`
  : "Nobody is waiting."}
  Deleting somebody deletes their songs with them.</p>

<table class="people">
  <thead><tr><th>Who</th><th>State</th><th>Do</th></tr></thead>
  <tbody>${users.map(row)}</tbody>
</table>`;

  return layout({ title: "People", user, body, problem, notice });
}

function notFound({ user }) {
  return layout({
    title: "Not found",
    user,
    body: html`<h1>Not found</h1><p>There is nothing at this address.
      ${user ? html`<a href="/songs">Back to your songs.</a>` : html`<a href="/">Back to the front.</a>`}</p>`
  });
}

/**
 * The page for an error nobody expected.
 *
 * It carries the log id and nothing else. A stack trace here is a map of the
 * installation handed to whoever provoked it.
 */
function oops({ id }) {
  return layout({
    title: "Something went wrong",
    user: null,
    body: html`<h1>Something went wrong</h1>
      <p>That did not work, and it is not your fault.</p>
      <p class="fine">If you are the person running this, the log calls it <code>${id}</code>.</p>
      <p><a href="/">Back to the front.</a></p>`
  });
}

function tooBig() {
  return layout({
    title: "Too much",
    user: null,
    body: html`<h1>That was too much to send</h1>
      <p>A set of lyrics is text, and this refuses anything over 256KB rather than
        holding it in memory to find out what it was.</p>
      <p><a href="/new">Back to the editor.</a></p>`
  });
}

module.exports = { landing, compose, mySongs, community, songPage, adminPage, notFound, oops, tooBig, songRow };

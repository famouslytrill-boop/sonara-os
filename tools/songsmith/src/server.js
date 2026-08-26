"use strict";

// The web server. `node:http` and nothing else.
//
// ## Everything is a form post
//
// No fetch, no JSON API, no client-side router. That is what makes the CSP
// below enforceable and what makes the whole application work with JavaScript
// switched off. `public/app.js` reloads a page while a song is being made, and
// removing it would cost a person nothing but pressing reload.
//
// ## What the headers are for
//
//   - `Content-Security-Policy` with `script-src 'self'`: an injected string
//     cannot run even if the escaping in `html.js` were wrong somewhere.
//     `media-src 'self'` keeps audio local. `form-action 'self'` means a
//     rewritten form cannot post somewhere else.
//   - `frame-ancestors 'none'`: nobody frames this and clickjacks the delete
//     button.
//   - `Referrer-Policy: same-origin`: a song id is not leaked to whatever a
//     person clicks through to.
//
// ## Rate limits
//
// Sign-in and generation are limited per address. Both matter for different
// reasons: sign-in because a password is guessable, and generation because
// every submitted job costs the owner real money on RunPod.

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const db = require("./db.js");
const auth = require("./auth.js");
const songs = require("./songs.js");
const pages = require("./pages.js");
const { createClient } = require("./runpod.js");
const { createDrafter } = require("./lyrics.js");

const PUBLIC = path.join(__dirname, "..", "public");

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "media-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "object-src 'none'"
].join("; ");

// A form post is text. 256KB is far more than 20,000 characters of lyrics and
// far less than anything that would trouble the process.
const MAX_BODY = 256 * 1024;

const LIMITS = {
  "sign-in": { windowMs: 15 * 60 * 1000, max: 10 },
  request: { windowMs: 60 * 60 * 1000, max: 5 },
  generate: { windowMs: 60 * 60 * 1000, max: 30 },
  draft: { windowMs: 60 * 60 * 1000, max: 60 }
};

/**
 * A fixed-window limiter, in memory.
 *
 * In memory because this is one process on one machine by design. If that ever
 * stops being true the limiter stops being a limit -- so it is written down
 * here rather than discovered later.
 */
function createLimiter() {
  const seen = new Map();
  return {
    check(key, rule, now = Date.now()) {
      const found = seen.get(key);
      if (!found || now - found.start > rule.windowMs) {
        seen.set(key, { start: now, count: 1 });
        return { ok: true, remaining: rule.max - 1 };
      }
      found.count += 1;
      if (found.count > rule.max) {
        return { ok: false, retryAfter: Math.ceil((found.start + rule.windowMs - now) / 1000) };
      }
      return { ok: true, remaining: rule.max - found.count };
    },
    sweep(now = Date.now()) {
      for (const [key, found] of seen) {
        if (now - found.start > 2 * 60 * 60 * 1000) seen.delete(key);
      }
      return seen.size;
    },
    size() {
      return seen.size;
    }
  };
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    request.on("data", (chunk) => {
      total += chunk.length;
      if (total > MAX_BODY) {
        // Paused rather than destroyed. Destroying the request tears the socket
        // down before the reply is written, so the caller sees a connection
        // reset instead of the 413 that would have told them what was wrong --
        // which is how this was found.
        request.pause();
        reject(Object.assign(new Error("body too large"), { tooLarge: true }));
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

function form(bytes) {
  const out = {};
  for (const [key, value] of new URLSearchParams(bytes.toString("utf8"))) out[key] = value;
  return out;
}

/**
 * The secret the CSRF tokens are derived from.
 *
 * Read from the environment when it is set. Otherwise generated once and kept
 * in the data directory -- a secret regenerated at every restart would make
 * every open form fail after a restart with an error nobody could act on.
 */
function secretFor(dataDir) {
  if (process.env.SONGSMITH_SECRET) return process.env.SONGSMITH_SECRET;
  const file = path.join(dataDir, "secret");
  try {
    const existing = fs.readFileSync(file, "utf8").trim();
    if (existing) return existing;
  } catch {
    // Not there yet.
  }
  const made = crypto.randomBytes(32).toString("base64url");
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(file, made, { mode: 0o600 });
  return made;
}

function createApp({
  dataDir = process.env.SONGSMITH_DATA_DIR || path.join(process.cwd(), "data"),
  database = null,
  backend = null,
  drafter = null,
  fetchImpl = globalThis.fetch,
  log = (line) => process.stdout.write(`${line}\n`),
  openToRequests = process.env.SONGSMITH_OPEN_REQUESTS !== "false",
  trustProxy = process.env.SONGSMITH_TRUST_PROXY === "true"
} = {}) {
  fs.mkdirSync(dataDir, { recursive: true });
  const store = database || db.open(path.join(dataDir, "songsmith.sqlite"));
  const secret = secretFor(dataDir);
  const limiter = createLimiter();

  const ctx = {
    db: store,
    dataDir,
    fetchImpl,
    log,
    backend: backend || createClient({ fetchImpl }),
    drafter: drafter || createDrafter({ fetchImpl })
  };

  // --- the reply helpers --------------------------------------------------

  function send(res, status, body, headers = {}) {
    const payload = Buffer.isBuffer(body) ? body : Buffer.from(String(body), "utf8");
    res.writeHead(status, {
      "content-length": String(payload.length),
      "content-security-policy": CSP,
      "referrer-policy": "same-origin",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      ...headers
    });
    res.end(payload);
  }

  function page(res, status, markup, headers = {}) {
    send(res, status, markup, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", ...headers });
  }

  function goTo(res, where, headers = {}) {
    send(res, 303, "", { location: where, ...headers });
  }

  // A message carried across a redirect in the query string rather than in a
  // flash cookie: one fewer piece of state, and it survives the person pressing
  // reload. The rendered text is looked up from this table rather than taken
  // from the URL, so nobody can put words on the page by sending a link.
  const MESSAGES = {
    approved: "Approved.",
    disabled: "That account is disabled and its sessions are gone.",
    enabled: "That account can sign in again.",
    deleted: "Deleted, along with their songs.",
    renamed: "Renamed.",
    shared: "Shared. Anybody signed in here can now play it.",
    unshared: "Not shared any more.",
    "song-deleted": "Song deleted.",
    asked: "Asked. You will be able to sign in once somebody approves it.",
    created: "Account created. You are the first one here, so you are signed in and can approve everybody else.",
    "signed-out": "Signed out.",
    "not-yours": "That song is not yours.",
    "no-backend": "No generation backend is configured, so nothing was submitted.",
    "too-many": "That is more than this is willing to do for now. Try again later.",
    "bad-form": "That form had gone stale. Try again.",
    "not-ready": "A song can only be shared once it is ready."
  };

  function messageFrom(url, key) {
    const value = url.searchParams.get(key);
    return value && Object.prototype.hasOwnProperty.call(MESSAGES, value) ? MESSAGES[value] : "";
  }

  // --- the request --------------------------------------------------------

  async function handle(req, res) {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const method = req.method.toUpperCase();
    const secure = trustProxy
      ? String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim() === "https"
      : Boolean(req.socket.encrypted);
    // Only when a proxy is explicitly trusted. Reading `x-forwarded-for`
    // otherwise lets anybody set their own rate-limit bucket by sending a
    // header, which is a limiter that does nothing.
    const from = trustProxy
      ? String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress
      : req.socket.remoteAddress;

    if (url.pathname === "/healthz") {
      return send(res, 200, JSON.stringify({
        ok: true,
        backend: ctx.backend.configured ? "configured" : "not configured",
        writingModel: ctx.drafter.configured ? "configured" : "not configured",
        openJobs: db.openJobs(store).length
      }), { "content-type": "application/json" });
    }

    if (method === "GET" && (url.pathname === "/app.css" || url.pathname === "/app.js")) {
      return serveStatic(res, url.pathname);
    }

    const cookies = auth.readCookies(req.headers.cookie);
    const token = cookies[auth.COOKIE] || "";
    const signedIn = auth.currentUser(store, token);
    const user = signedIn ? { ...signedIn, csrf: auth.csrfToken(token, secret) } : null;

    let body = {};
    if (method === "POST") {
      let bytes;
      try {
        bytes = await readBody(req);
      } catch (error) {
        if (error.tooLarge) {
          return page(res, 413, pages.tooBig(), { connection: "close" });
        }
        return page(res, 400, pages.notFound({ user }));
      }
      body = form(bytes);
      // Every POST except the two that create a session. Those two have no
      // session to derive a token from, and SameSite=Strict is what protects
      // them -- a cross-site post arrives with no cookies, so it cannot sign
      // anybody in as anybody.
      const needsToken = !["/sign-in", "/request"].includes(url.pathname);
      if (needsToken && !auth.csrfOk(token, secret, body.csrf)) {
        return goTo(res, user ? "/songs?problem=bad-form" : "/?problem=bad-form");
      }
    }

    const limited = (name) => {
      const rule = LIMITS[name];
      const outcome = limiter.check(`${name}:${from}`, rule);
      if (outcome.ok) return null;
      log(`songsmith: rate limit ${name} for ${from}, ${outcome.retryAfter}s left`);
      return outcome;
    };

    const problem = messageFrom(url, "problem");
    const notice = messageFrom(url, "notice");

    // --- signed out -------------------------------------------------------

    if (url.pathname === "/" && method === "GET") {
      if (user) return goTo(res, "/songs");
      return page(res, 200, pages.landing({
        problem, notice, openToRequests, firstRun: db.listUsers(store).length === 0
      }));
    }

    if (url.pathname === "/sign-in" && method === "POST") {
      const stopped = limited("sign-in");
      if (stopped) return goTo(res, "/?problem=too-many", { "retry-after": String(stopped.retryAfter) });
      const outcome = auth.signIn(store, { email: body.email, password: body.password });
      if (!outcome.ok) {
        // Rendered rather than redirected, because the reason a pending account
        // cannot sign in is worth more than one word in a query string.
        return page(res, 401, pages.landing({
          problem: outcome.problem, openToRequests, firstRun: false
        }));
      }
      return goTo(res, "/songs", { "set-cookie": auth.sessionCookie(outcome.token, { secure }) });
    }

    if (url.pathname === "/request" && method === "POST") {
      const stopped = limited("request");
      if (stopped) return goTo(res, "/?problem=too-many", { "retry-after": String(stopped.retryAfter) });
      if (!openToRequests && db.listUsers(store).length > 0) {
        return page(res, 403, pages.landing({ problem: "This installation is not taking new requests.", openToRequests: false, firstRun: false }));
      }
      const outcome = auth.requestAccount(store, {
        email: body.email, password: body.password, displayName: body.display_name, reason: body.reason
      });
      if (!outcome.ok) {
        return page(res, 400, pages.landing({ problem: outcome.problem, openToRequests, firstRun: db.listUsers(store).length === 0 }));
      }
      if (outcome.first) {
        // The first account is signed in straight away. Everybody after it
        // waits, and gets the same words whether or not the address was
        // already taken.
        const session = auth.signIn(store, { email: body.email, password: body.password });
        return goTo(res, "/songs?notice=created", { "set-cookie": auth.sessionCookie(session.token, { secure }) });
      }
      log(`songsmith: somebody asked for an account${outcome.existing ? " (address already known)" : ""}`);
      return goTo(res, "/?notice=asked");
    }

    if (url.pathname === "/sign-out" && method === "POST") {
      auth.signOut(store, token);
      return goTo(res, "/?notice=signed-out", { "set-cookie": auth.clearedCookie(secure) });
    }

    // --- everything past here needs an account ----------------------------

    if (!user) {
      if (method === "GET") return goTo(res, "/");
      return page(res, 401, pages.landing({ problem: "Sign in first.", openToRequests, firstRun: false }));
    }

    if (url.pathname === "/songs" && method === "GET") {
      return page(res, 200, pages.mySongs({ user, songs: db.listSongsFor(store, user.id), problem, notice }));
    }

    if (url.pathname === "/community" && method === "GET") {
      return page(res, 200, pages.community({ user, songs: db.listSharedSongs(store), problem, notice }));
    }

    if (url.pathname === "/new" && method === "GET") {
      return page(res, 200, pages.compose({
        user, problem, notice,
        backendReady: ctx.backend.configured,
        drafterConfigured: ctx.drafter.configured,
        draft: { idea: url.searchParams.get("idea") || "" }
      }));
    }

    if (url.pathname === "/draft" && method === "POST") {
      const stopped = limited("draft");
      if (stopped) return goTo(res, "/new?problem=too-many", { "retry-after": String(stopped.retryAfter) });
      const drafted = await ctx.drafter.draft({ prompt: body.idea, style: body.style });
      if (!drafted.ok) {
        return page(res, 400, pages.compose({
          user, problem: drafted.problem, backendReady: ctx.backend.configured,
          drafterConfigured: ctx.drafter.configured, draft: { idea: body.idea || "" }
        }));
      }
      return page(res, 200, pages.compose({
        user,
        problem: drafted.problem || "",
        backendReady: ctx.backend.configured,
        drafterConfigured: ctx.drafter.configured,
        draft: { ...drafted, idea: body.idea || "", prompt: body.idea || "" }
      }));
    }

    if (url.pathname === "/new" && method === "POST") {
      const stopped = limited("generate");
      if (stopped) return goTo(res, "/new?problem=too-many", { "retry-after": String(stopped.retryAfter) });
      if (!String(body.lyrics || "").trim() && !String(body.prompt || "").trim()) {
        return page(res, 400, pages.compose({
          user, problem: "Write some lyrics, or say what the song should be about.",
          backendReady: ctx.backend.configured, drafterConfigured: ctx.drafter.configured, draft: body
        }));
      }
      const outcome = await songs.start(ctx, { user, ...body });
      // Even a failure has a song row with the reason on it, so the person is
      // sent to the song rather than to an error page they cannot come back to.
      return goTo(res, `/songs/${outcome.song.id}`);
    }

    const songMatch = url.pathname.match(/^\/songs\/([0-9a-f-]{36})(\/[a-z]+)?$/);
    if (songMatch) return songRoute(songMatch, { req, res, url, method, body, user, problem, notice, limited });

    // --- admin ------------------------------------------------------------

    if (url.pathname.startsWith("/admin")) {
      if (!user.is_admin) return page(res, 403, pages.notFound({ user }));

      if (url.pathname === "/admin" && method === "GET") {
        return page(res, 200, pages.adminPage({
          user, users: db.listUsers(store), problem, notice, adminCount: db.countAdmins(store)
        }));
      }

      const adminMatch = url.pathname.match(/^\/admin\/users\/([0-9a-f-]{36})\/(status|delete)$/);
      if (adminMatch && method === "POST") {
        const [, id, what] = adminMatch;
        const person = db.findUserById(store, id);
        if (!person) return goTo(res, "/admin");
        // The last active admin cannot be disabled or deleted, including by
        // themselves. An installation with no admin has no way back short of
        // editing the database by hand.
        const lastAdmin = person.is_admin && person.status === "active" && db.countAdmins(store) <= 1;
        if (lastAdmin) {
          return page(res, 400, pages.adminPage({
            user, users: db.listUsers(store), adminCount: db.countAdmins(store),
            problem: "That is the only admin left. Make somebody else an admin first."
          }));
        }
        if (what === "delete") {
          for (const song of db.listSongsFor(store, id)) songs.remove(ctx, song);
          db.deleteUser(store, id);
          log(`songsmith: ${user.email} deleted the account ${person.email}`);
          return goTo(res, "/admin?notice=deleted");
        }
        const status = body.status === "active" ? "active" : "disabled";
        db.setUserStatus(store, { id, status, decidedBy: user.id });
        log(`songsmith: ${user.email} set ${person.email} to ${status}`);
        return goTo(res, `/admin?notice=${status === "active" ? (person.status === "pending" ? "approved" : "enabled") : "disabled"}`);
      }
    }

    return page(res, 404, pages.notFound({ user }));
  }

  // --- one song's routes --------------------------------------------------

  async function songRoute([, id, action], { req, res, method, body, user, problem, notice }) {
    const song = db.findSong(store, id);
    if (!song) return page(res, 404, pages.notFound({ user }));

    const mine = song.user_id === user.id;
    // A shared song is readable by anybody signed in here. A private one is
    // readable by its owner only -- and an admin is not an exception, because
    // "keep songs private by default" would mean very little if the person who
    // approves accounts could read them all.
    const mayRead = mine || song.visibility === "shared";

    if (!action) {
      if (method !== "GET") return page(res, 405, pages.notFound({ user }));
      if (!mayRead) return page(res, 404, pages.notFound({ user }));
      const owner = mine ? null : db.findUserById(store, song.user_id);
      return page(res, 200, pages.songPage({
        user, song, mine, ownerName: owner ? owner.display_name || owner.email : "", problem, notice
      }));
    }

    if (action === "/audio") {
      if (method !== "GET" && method !== "HEAD") return page(res, 405, pages.notFound({ user }));
      if (!mayRead) return page(res, 404, pages.notFound({ user }));
      return serveAudio(req, res, song);
    }

    // Everything below changes the song, so it is the owner only, and it is a
    // POST only.
    if (method !== "POST") return page(res, 405, pages.notFound({ user }));
    if (!mine) return goTo(res, "/songs?problem=not-yours");

    if (action === "/rename") {
      const title = String(body.title || "").trim().slice(0, 120);
      if (!title) return goTo(res, `/songs/${song.id}`);
      db.updateSong(store, song.id, { title });
      return goTo(res, `/songs/${song.id}?notice=renamed`);
    }

    if (action === "/visibility") {
      const wanted = body.visibility === "shared" ? "shared" : "private";
      // Sharing a song that is not ready would put a broken play button in
      // front of everybody else. Unsharing is always allowed.
      if (wanted === "shared" && song.state !== "ready") {
        return goTo(res, `/songs/${song.id}?problem=not-ready`);
      }
      db.updateSong(store, song.id, { visibility: wanted });
      return goTo(res, `/songs/${song.id}?notice=${wanted === "shared" ? "shared" : "unshared"}`);
    }

    if (action === "/replay") {
      const outcome = await songs.replay(ctx, song, user);
      return goTo(res, `/songs/${outcome.song.id}`);
    }

    if (action === "/delete") {
      songs.remove(ctx, song);
      return goTo(res, "/songs?notice=song-deleted");
    }

    return page(res, 404, pages.notFound({ user }));
  }

  /**
   * Serve the audio, with byte ranges.
   *
   * Ranges are not optional here. A browser asks for one the moment somebody
   * drags the scrubber, and a server that answers 200 with the whole file makes
   * seeking re-download the song every time.
   */
  function serveAudio(req, res, song) {
    if (!song.audio_path) return send(res, 404, "This song has no audio file.", { "content-type": "text/plain" });
    let stat;
    try {
      stat = fs.statSync(song.audio_path);
    } catch {
      // The row says ready and the file is not there. Said plainly rather than
      // as a generic 404, because it means something is wrong with the install
      // rather than with the request.
      log(`songsmith: ${song.id} is ready but ${song.audio_path} is missing`);
      return send(res, 410, "The audio file for this song is missing from disk.", { "content-type": "text/plain" });
    }

    const filename = `${String(song.title || "song").replace(/[^A-Za-z0-9._ -]/g, "").trim() || "song"}.m4a`;
    const headers = {
      "content-type": "audio/mp4",
      "accept-ranges": "bytes",
      // Private and no-store: these are somebody's songs, and a shared cache in
      // front of this must not hold one.
      "cache-control": "private, no-store",
      "content-security-policy": CSP,
      "x-content-type-options": "nosniff"
    };
    if (req.url.includes("download=1")) {
      headers["content-disposition"] = `attachment; filename="${filename}"`;
    }

    const range = String(req.headers.range || "");
    const match = range.match(/^bytes=(\d*)-(\d*)$/);
    if (match && (match[1] || match[2])) {
      let start = match[1] ? Number(match[1]) : stat.size - Number(match[2]);
      let end = match[1] && match[2] ? Number(match[2]) : stat.size - 1;
      start = Math.max(0, start);
      end = Math.min(stat.size - 1, end);
      if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
        return send(res, 416, "", { ...headers, "content-range": `bytes */${stat.size}` });
      }
      res.writeHead(206, {
        ...headers,
        "content-range": `bytes ${start}-${end}/${stat.size}`,
        "content-length": String(end - start + 1)
      });
      if (req.method === "HEAD") return res.end();
      return fs.createReadStream(song.audio_path, { start, end }).pipe(res);
    }

    res.writeHead(200, { ...headers, "content-length": String(stat.size) });
    if (req.method === "HEAD") return res.end();
    return fs.createReadStream(song.audio_path).pipe(res);
  }

  function serveStatic(res, pathname) {
    const file = path.join(PUBLIC, pathname.slice(1));
    // `pathname` comes from a two-value comparison above, so traversal is not
    // reachable -- checked anyway, because that comparison is one edit away
    // from becoming a prefix match.
    if (!file.startsWith(PUBLIC + path.sep)) return send(res, 404, "");
    let bytes;
    try {
      bytes = fs.readFileSync(file);
    } catch {
      return send(res, 404, "");
    }
    return send(res, 200, bytes, {
      "content-type": pathname.endsWith(".css") ? "text/css; charset=utf-8" : "text/javascript; charset=utf-8",
      "cache-control": "public, max-age=300"
    });
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch((error) => {
      // Every unhandled error gets an id. The person sees the id and nothing
      // else; the log holds the stack. A stack trace on the page is a map of
      // the install for whoever asked for it.
      const id = crypto.randomBytes(6).toString("hex");
      log(`songsmith: error ${id} on ${req.method} ${req.url}: ${error.stack || error.message}`);
      if (!res.headersSent) {
        page(res, 500, pages.oops({ id }));
      } else {
        res.end();
      }
    });
  });

  return { server, ctx, store, secret, limiter, handle };
}

/** Start polling open jobs, and sweeping what has expired. */
function startPolling(ctx, { intervalMs = 5000 } = {}) {
  const timer = setInterval(() => {
    songs.pollAll(ctx).catch((error) => ctx.log(`songsmith: polling threw: ${error.message}`));
  }, intervalMs);
  // Unref so the timer does not hold a test process open. The server's own
  // listening socket is what keeps the real process alive.
  timer.unref();
  return timer;
}

function start({ port = Number(process.env.PORT) || 8787, host = process.env.HOST || "0.0.0.0" } = {}) {
  const app = createApp();
  const cleanup = setInterval(() => {
    db.pruneSessions(app.store);
    app.limiter.sweep();
  }, 60 * 60 * 1000);
  cleanup.unref();
  startPolling(app.ctx);
  app.server.listen(port, host, () => {
    process.stdout.write([
      "",
      `  songsmith on http://localhost:${port}`,
      "",
      `  generation     ${app.ctx.backend.configured ? "RunPod endpoint configured" : "NOT configured — set RUNPOD_API_KEY and RUNPOD_ENDPOINT_ID"}`,
      `  writing model  ${app.ctx.drafter.configured ? "configured" : "not configured — the helper gives an outline only"}`,
      `  accounts       ${db.listUsers(app.store).length === 0 ? "none yet; the first one created becomes the admin" : `${db.listUsers(app.store).length} known`}`,
      "",
      "  songs are private unless somebody shares them.",
      ""
    ].join("\n"));
  });
  return app;
}

module.exports = { createApp, start, startPolling, createLimiter, CSP, LIMITS, MAX_BODY };

if (require.main === module) start();

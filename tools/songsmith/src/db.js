"use strict";

// Storage. SQLite, through Node's own driver.
//
// `node:sqlite` ships with Node 22, so this whole application has **no
// dependencies at all**. That is worth stating as a decision rather than a
// coincidence: this source is private and must stay that way, and every
// dependency is a licence somebody has to have read. A reciprocal licence
// (AGPL, GPL, OSL) triggers on *network use* -- serving this application over
// HTTP would oblige releasing its source under the same terms. The safest
// audit of a dependency tree is one with nothing in it.
//
// ## The schema is the security model
//
// Three things are enforced here rather than only in a route, because a route
// is one writer and a constraint is every writer:
//
//   - a user's `status` is one of three known values, so a typo cannot create
//     an account in a state nothing checks
//   - a song's `visibility` is `private` or `shared`, defaulting to private
//   - a session belongs to a user and dies with them (`on delete cascade`), so
//     deleting an account cannot leave a working session behind
//
// ## Times are stored as integers
//
// Milliseconds since the epoch, not text. SQLite compares text lexically, so
// `'2026-9-1' > '2026-10-1'` is true and an expiry check written against text
// dates silently accepts an expired session for a month every year.

const { DatabaseSync } = require("node:sqlite");
const fs = require("node:fs");
const path = require("node:path");

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name  TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  -- pending: asked for an account and nobody has decided yet
  -- active:  approved, may sign in
  -- disabled: was approved and is not any more; sessions are killed with it
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','active','disabled')),
  is_admin      INTEGER NOT NULL DEFAULT 0 CHECK (is_admin IN (0,1)),
  -- What they said when they asked. The whole point of an approval queue is
  -- that somebody reads this before deciding.
  reason        TEXT NOT NULL DEFAULT '',
  created_at    INTEGER NOT NULL,
  decided_at    INTEGER,
  decided_by    TEXT REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  -- The hash of the token, never the token. A stolen database must not be a
  -- set of working sessions.
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

CREATE TABLE IF NOT EXISTS songs (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT 'Untitled',
  prompt      TEXT NOT NULL DEFAULT '',
  lyrics      TEXT NOT NULL DEFAULT '',
  style       TEXT NOT NULL DEFAULT '',
  -- The seed is what makes "make that again" mean the same song rather than a
  -- different one. Stored on the song, not regenerated.
  seed        INTEGER NOT NULL,
  -- queued -> running -> ready | failed | cancelled
  state       TEXT NOT NULL DEFAULT 'queued'
              CHECK (state IN ('queued','running','ready','failed','cancelled')),
  -- Nought to a hundred, or NULL when nothing has said. NULL and 0 are
  -- different: one is "no news" and the other is "started and got nowhere".
  progress    INTEGER CHECK (progress IS NULL OR (progress BETWEEN 0 AND 100)),
  job_id      TEXT,
  error       TEXT NOT NULL DEFAULT '',
  audio_path  TEXT NOT NULL DEFAULT '',
  duration_ms INTEGER,
  visibility  TEXT NOT NULL DEFAULT 'private'
              CHECK (visibility IN ('private','shared')),
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS songs_user_idx ON songs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS songs_shared_idx ON songs(created_at DESC) WHERE visibility = 'shared';
CREATE INDEX IF NOT EXISTS songs_open_idx ON songs(state) WHERE state IN ('queued','running');
`;

function open(file = ":memory:") {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  // Both every time, not only at create: PRAGMAs are per-connection, and
  // foreign_keys defaults OFF -- so a process that skipped this would happily
  // orphan sessions from deleted users.
  db.exec(SCHEMA);
  return db;
}

// --- users ---------------------------------------------------------------

function createUser(db, { id, email, displayName, passwordHash, reason, isAdmin = false, status = "pending", now = Date.now() }) {
  db.prepare(`INSERT INTO users (id, email, display_name, password_hash, status, is_admin, reason, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, email, displayName || "", passwordHash, status, isAdmin ? 1 : 0, reason || "", now);
  return findUserById(db, id);
}

function findUserByEmail(db, email) {
  return db.prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE").get(String(email || "")) || null;
}

function findUserById(db, id) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(String(id || "")) || null;
}

function listUsers(db) {
  // Pending first: the whole reason an admin opens this page is to decide
  // about somebody who is waiting.
  return db.prepare(`SELECT * FROM users
                     ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'active' THEN 1 ELSE 2 END,
                              created_at DESC`).all();
}

function setUserStatus(db, { id, status, decidedBy, now = Date.now() }) {
  const changed = db.prepare("UPDATE users SET status = ?, decided_at = ?, decided_by = ? WHERE id = ?")
    .run(status, now, decidedBy || null, id);
  // A disabled account's sessions go immediately. Leaving them alive means
  // "disabled" takes effect whenever the cookie happens to expire, which is
  // not what anybody pressing that button means.
  if (status !== "active") db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
  return changed.changes > 0;
}

function deleteUser(db, id) {
  // Songs and sessions cascade. A deleted account leaving its songs in the
  // community list would be the most surprising possible outcome.
  return db.prepare("DELETE FROM users WHERE id = ?").run(id).changes > 0;
}

function countAdmins(db) {
  return db.prepare("SELECT COUNT(*) AS n FROM users WHERE is_admin = 1 AND status = 'active'").get().n;
}

// --- sessions ------------------------------------------------------------

function createSession(db, { tokenHash, userId, expiresAt, now = Date.now() }) {
  db.prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .run(tokenHash, userId, now, expiresAt);
}

// The session and its user in one query, because every request needs both and
// a user whose status changed since sign-in must not be served from a session
// that predates the change.
function findSession(db, tokenHash, now = Date.now()) {
  return db.prepare(`SELECT s.token_hash, s.expires_at, u.*
                     FROM sessions s JOIN users u ON u.id = s.user_id
                     WHERE s.token_hash = ? AND s.expires_at > ?`).get(tokenHash, now) || null;
}

function deleteSession(db, tokenHash) {
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
}

function pruneSessions(db, now = Date.now()) {
  return db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now).changes;
}

// --- songs ---------------------------------------------------------------

function createSong(db, { id, userId, title, prompt, lyrics, style, seed, now = Date.now() }) {
  db.prepare(`INSERT INTO songs (id, user_id, title, prompt, lyrics, style, seed, state, progress, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', NULL, ?, ?)`)
    .run(id, userId, title || "Untitled", prompt || "", lyrics || "", style || "", seed, now, now);
  return findSong(db, id);
}

function findSong(db, id) {
  return db.prepare("SELECT * FROM songs WHERE id = ?").get(String(id || "")) || null;
}

function listSongsFor(db, userId) {
  return db.prepare("SELECT * FROM songs WHERE user_id = ? ORDER BY created_at DESC").all(userId);
}

// The community list. Only shared songs, and the owner's display name comes
// along so the page never has to look a user up per row.
function listSharedSongs(db, limit = 100) {
  return db.prepare(`SELECT s.*, u.display_name AS owner_name, u.email AS owner_email
                     FROM songs s JOIN users u ON u.id = s.user_id
                     WHERE s.visibility = 'shared' AND s.state = 'ready'
                     ORDER BY s.created_at DESC LIMIT ?`).all(limit);
}

function openJobs(db) {
  return db.prepare("SELECT * FROM songs WHERE state IN ('queued','running')").all();
}

function updateSong(db, id, fields, now = Date.now()) {
  const allowed = ["title", "state", "progress", "job_id", "error", "audio_path", "duration_ms", "visibility", "lyrics", "style"];
  const sets = [];
  const values = [];
  for (const [key, value] of Object.entries(fields)) {
    // Built from a fixed list rather than from the caller's keys. This string
    // becomes SQL, and a caller-supplied column name is an injection point even
    // when every current caller is trustworthy.
    if (!allowed.includes(key)) continue;
    sets.push(`${key} = ?`);
    values.push(value);
  }
  if (!sets.length) return false;
  sets.push("updated_at = ?");
  values.push(now, id);
  return db.prepare(`UPDATE songs SET ${sets.join(", ")} WHERE id = ?`).run(...values).changes > 0;
}

function deleteSong(db, id) {
  return db.prepare("DELETE FROM songs WHERE id = ?").run(id).changes > 0;
}

module.exports = {
  open, SCHEMA,
  createUser, findUserByEmail, findUserById, listUsers, setUserStatus, deleteUser, countAdmins,
  createSession, findSession, deleteSession, pruneSessions,
  createSong, findSong, listSongsFor, listSharedSongs, openJobs, updateSong, deleteSong
};

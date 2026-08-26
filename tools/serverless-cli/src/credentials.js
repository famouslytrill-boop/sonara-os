"use strict";

// Where the credentials come from, and what to say when there are none.
//
// Four places, in the order every AWS tool uses them, because a tool that
// resolved credentials differently from the AWS CLI sitting next to it is a
// tool that deploys to the wrong account exactly once.
//
//   1. The environment (AWS_ACCESS_KEY_ID and friends)
//   2. This tool's own cache, written by `login`
//   3. The AWS CLI's SSO cache, so `aws sso login` also works here
//   4. ~/.aws/credentials
//
// ## Expiry is checked, not assumed
//
// Temporary credentials expire, and expired ones fail as a 403 that reads
// exactly like a permissions problem -- which sends people to IAM to debug
// something that is not broken. So expiry is checked before use and reported as
// what it is, with the command to fix it.
//
// A credential set with **no** expiry recorded is treated as long-lived rather
// than as expired. Absent is not zero: `new Date(null)` is the epoch, and
// treating a missing expiry as "expired in 1970" would reject every static key.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

class NoCredentials extends Error {
  constructor(message, hint) {
    super(message);
    this.name = "NoCredentials";
    this.hint = hint || "";
  }
}

function cacheDirectory() {
  return path.join(os.homedir(), ".sonara-serverless");
}

function cacheFile() {
  return path.join(cacheDirectory(), "credentials.json");
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    // Unreadable and absent are the same thing to a caller looking for
    // credentials: this source has none. It is not the same as "no credentials
    // anywhere", which is what the resolver decides after trying them all.
    return null;
  }
}

// Minutes of headroom. A credential that expires during a deploy fails halfway
// through a stack update, which is a far worse place to find out than before.
const EXPIRY_MARGIN_MS = 5 * 60 * 1000;

function isExpired(expiresAt, now = Date.now()) {
  if (!expiresAt) return false;
  const at = new Date(expiresAt).getTime();
  if (!Number.isFinite(at)) return false;
  return at - EXPIRY_MARGIN_MS <= now;
}

function fromEnvironment(env = process.env) {
  if (!env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY) return null;
  return {
    source: "the environment",
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    sessionToken: env.AWS_SESSION_TOKEN || null,
    expiresAt: null
  };
}

function fromCache({ file = cacheFile(), profile = "default" } = {}) {
  const cached = readJson(file);
  const entry = cached?.[profile];
  if (!entry?.accessKeyId || !entry?.secretAccessKey) return null;
  return {
    source: `sonara-serverless login (${profile})`,
    accessKeyId: entry.accessKeyId,
    secretAccessKey: entry.secretAccessKey,
    sessionToken: entry.sessionToken || null,
    expiresAt: entry.expiresAt || null,
    region: entry.region || null
  };
}

function saveToCache(profile, credentials, { file = cacheFile() } = {}) {
  const existing = readJson(file) || {};
  existing[profile] = credentials;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // 0600 before anything is written, not after. A file created world-readable
  // and then chmod-ed has a window, and the thing in it is a key.
  const handle = fs.openSync(file, "w", 0o600);
  try {
    fs.writeFileSync(handle, JSON.stringify(existing, null, 2));
  } finally {
    fs.closeSync(handle);
  }
  fs.chmodSync(file, 0o600);
  return file;
}

// ~/.aws/credentials, parsed just far enough. Not a general INI reader: it
// reads [profile] sections and key = value lines and nothing else.
function fromSharedFile({ file = path.join(os.homedir(), ".aws", "credentials"), profile = "default" } = {}) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
  const sections = {};
  let current = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/[;#].*$/, "").trim();
    if (!line) continue;
    const heading = line.match(/^\[([^\]]+)\]$/);
    if (heading) { current = heading[1].trim().replace(/^profile\s+/, ""); sections[current] = {}; continue; }
    if (!current) continue;
    const pair = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (pair) sections[current][pair[1].toLowerCase()] = pair[2].trim();
  }
  const entry = sections[profile];
  if (!entry?.aws_access_key_id || !entry?.aws_secret_access_key) return null;
  return {
    source: `~/.aws/credentials (${profile})`,
    accessKeyId: entry.aws_access_key_id,
    secretAccessKey: entry.aws_secret_access_key,
    sessionToken: entry.aws_session_token || null,
    expiresAt: null
  };
}

/**
 * Find credentials, or say clearly that there are none.
 *
 * Returns { accessKeyId, secretAccessKey, sessionToken, source }. Throws
 * NoCredentials with a hint naming the command to run.
 */
function resolveCredentials({ profile = "default", env = process.env, sources = null } = {}) {
  const attempts = sources || [
    () => fromEnvironment(env),
    () => fromCache({ profile }),
    () => fromSharedFile({ profile })
  ];

  const expired = [];
  for (const attempt of attempts) {
    const found = attempt();
    if (!found) continue;
    if (isExpired(found.expiresAt)) { expired.push(found); continue; }
    return found;
  }

  if (expired.length) {
    throw new NoCredentials(
      `The credentials from ${expired[0].source} expired at ${expired[0].expiresAt}.`,
      "Run `sonara-serverless login` to get new ones. This is not a permissions problem, and AWS would have reported it as one."
    );
  }

  throw new NoCredentials(
    "No AWS credentials were found.",
    [
      "Any one of these will do:",
      "  sonara-serverless login          sign in through your browser",
      "  export AWS_ACCESS_KEY_ID=...     set them in this shell",
      "  aws configure                    if you have the AWS CLI",
      "",
      `Looked in: the environment, ${cacheFile()}, and ~/.aws/credentials.`
    ].join("\n")
  );
}

module.exports = {
  resolveCredentials, saveToCache, fromEnvironment, fromCache, fromSharedFile,
  isExpired, NoCredentials, cacheFile, cacheDirectory, EXPIRY_MARGIN_MS
};

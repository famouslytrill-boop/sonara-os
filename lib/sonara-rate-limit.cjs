"use strict";

// Durable rate limiting for authentication routes.
//
// Counters live in Postgres (see 20260727171000_phase0_auth_rate_limits.sql)
// because the application runs as serverless functions: an in-process counter
// would give each concurrent instance its own budget, which is not a limit.
//
// Identifiers are hashed before they leave this module, so the database stores
// no raw client IP addresses or email addresses.

const crypto = require("node:crypto");

const MEMORY_BUCKETS = new Map();
const MEMORY_BUCKET_CEILING = 10000;

function hashIdentifier(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 32);
}

// Vercel terminates TLS upstream, so the socket address is a proxy hop. Take the
// first entry of x-forwarded-for, which is the client as recorded at the edge.
// We deliberately do not enable Express `trust proxy` here: that would also
// change req.protocol and req.secure, which other code reads.
function getClientIdentifier(req) {
  const forwarded = String(req.headers?.["x-forwarded-for"] || "").split(",")[0].trim();
  if (forwarded) return forwarded;
  const real = String(req.headers?.["x-real-ip"] || "").trim();
  if (real) return real;
  return String(req.ip || req.socket?.remoteAddress || "unknown");
}

// Fixed-window counter used only when Supabase is not configured, i.e. local
// development and tests. It is per-instance and therefore NOT a real limit in
// production; consumeRateLimit reports `durable: false` so callers can tell.
function consumeInMemory(bucketKey, windowSeconds, maxAttempts) {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const existing = MEMORY_BUCKETS.get(bucketKey);

  if (!existing || now - existing.windowStartedAt >= windowMs) {
    if (MEMORY_BUCKETS.size >= MEMORY_BUCKET_CEILING) {
      for (const [key, entry] of MEMORY_BUCKETS) {
        if (now - entry.windowStartedAt >= windowMs) MEMORY_BUCKETS.delete(key);
      }
      // Still full of live windows: refuse to grow without bound.
      if (MEMORY_BUCKETS.size >= MEMORY_BUCKET_CEILING) MEMORY_BUCKETS.clear();
    }
    MEMORY_BUCKETS.set(bucketKey, { windowStartedAt: now, attemptCount: 1 });
    return { allowed: true, remaining: Math.max(maxAttempts - 1, 0), retryAfterSeconds: 0, durable: false };
  }

  existing.attemptCount += 1;
  const allowed = existing.attemptCount <= maxAttempts;
  return {
    allowed,
    remaining: Math.max(maxAttempts - existing.attemptCount, 0),
    retryAfterSeconds: allowed ? 0 : Math.max(Math.ceil((existing.windowStartedAt + windowMs - now) / 1000), 1),
    durable: false
  };
}

async function consumeRateLimit(bucketKey, { windowSeconds, maxAttempts, getSupabaseServerConfig }) {
  const config = typeof getSupabaseServerConfig === "function" ? getSupabaseServerConfig() : { ok: false };

  if (!config?.ok) {
    return consumeInMemory(bucketKey, windowSeconds, maxAttempts);
  }

  try {
    const response = await fetch(`${config.url}/rest/v1/rpc/sonara_consume_rate_limit`, {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        p_bucket_key: bucketKey,
        p_window_seconds: windowSeconds,
        p_max_attempts: maxAttempts
      })
    });

    if (!response.ok) throw new Error(`rate limit rpc returned ${response.status}`);

    const rows = await response.json();
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row || typeof row.allowed !== "boolean") throw new Error("rate limit rpc returned an unexpected shape");

    return {
      allowed: row.allowed,
      remaining: Number(row.remaining) || 0,
      retryAfterSeconds: Number(row.retry_after_seconds) || 0,
      durable: true
    };
  } catch (error) {
    // Fail open, but say so.
    //
    // This is a deliberate trade-off: failing closed would turn any transient
    // database problem into a total authentication outage, which is a worse
    // and more likely incident than the brute-force window this opens. The
    // `degraded` flag is logged so the condition is visible rather than silent.
    return {
      allowed: true,
      remaining: 0,
      retryAfterSeconds: 0,
      durable: false,
      degraded: true,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Express middleware factory.
//
// `scopes` selects which identity the budget is charged against. Auth routes
// should use both:
//   - "ip"      throttles one host hammering many accounts
//   - "subject" throttles many hosts hammering one account (credential stuffing
//               from a botnet, where per-IP limits never trigger)
// The first scope to deny wins.
// `renderDenied` lets HTML form routes answer with a page instead of JSON. It
// receives ({ req, res, retryAfterSeconds }) and must send the response. When
// omitted, or when it declines by returning false, the JSON body is sent.
function createRateLimiter({ name, windowSeconds, maxAttempts, scopes = ["ip"], subjectFrom, getSupabaseServerConfig, onDegraded, renderDenied }) {
  if (!name) throw new Error("a rate limiter needs a name");

  return async function rateLimitMiddleware(req, res, next) {
    const candidates = [];

    if (scopes.includes("ip")) {
      candidates.push(`${name}:ip:${hashIdentifier(getClientIdentifier(req))}`);
    }
    if (scopes.includes("subject")) {
      const subject = typeof subjectFrom === "function" ? subjectFrom(req) : undefined;
      const normalized = String(subject || "").trim().toLowerCase();
      if (normalized) candidates.push(`${name}:subject:${hashIdentifier(normalized)}`);
    }

    for (const bucketKey of candidates) {
      const result = await consumeRateLimit(bucketKey, { windowSeconds, maxAttempts, getSupabaseServerConfig });

      if (result.degraded && typeof onDegraded === "function") {
        onDegraded({ name, error: result.error });
      }

      if (!result.allowed) {
        res.setHeader("Retry-After", String(result.retryAfterSeconds));
        res.setHeader("Cache-Control", "no-store");

        if (typeof renderDenied === "function") {
          const handled = renderDenied({ req, res, retryAfterSeconds: result.retryAfterSeconds });
          if (handled !== false) return handled;
        }

        return res.status(429).json({
          ok: false,
          code: "rate_limited",
          message: "Too many attempts. Wait before trying again.",
          retry_after_seconds: result.retryAfterSeconds
        });
      }
    }

    return next();
  };
}

module.exports = {
  createRateLimiter,
  consumeRateLimit,
  getClientIdentifier,
  hashIdentifier,
  __resetInMemoryBucketsForTests() {
    MEMORY_BUCKETS.clear();
  }
};

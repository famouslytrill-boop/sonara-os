// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
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
const { redactError } = require("./sonara-redaction.cjs");
const { emitEvent } = require("./sonara-structured-log.cjs");

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
      let earliestExpiryMs = Infinity;
      for (const [key, entry] of MEMORY_BUCKETS) {
        // Different route limiters may have different window lengths. Expire
        // each bucket using its own duration, not the incoming request's.
        const lifetimeMs = entry.windowMs ?? windowMs;
        const remainingMs = entry.windowStartedAt + lifetimeMs - now;
        if (remainingMs <= 0) MEMORY_BUCKETS.delete(key);
        else earliestExpiryMs = Math.min(earliestExpiryMs, remainingMs);
      }
      // Never clear live counters under saturation: that would reset the
      // budgets of every active attacker. Deny new buckets until capacity
      // becomes available, while existing buckets keep their own limits.
      if (MEMORY_BUCKETS.size >= MEMORY_BUCKET_CEILING) {
        return {
          allowed: false, remaining: 0,
          retryAfterSeconds: Math.max(1, Math.ceil(earliestExpiryMs / 1000)),
          durable: false, saturated: true
        };
      }
    }
    MEMORY_BUCKETS.set(bucketKey, { windowStartedAt: now, attemptCount: 1, windowMs });
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

async function consumeRateLimit(bucketKey, { windowSeconds, maxAttempts, degradedMaxAttempts = Math.max(maxAttempts + 20, maxAttempts * 2), getSupabaseServerConfig }) {
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
      }),
      // A hanging durable limiter must not hang every authentication or
      // public-write request. On timeout the existing bounded/degraded path
      // applies, and its counter outage is reported.
      signal: AbortSignal.timeout(4000)
    });

    if (!response.ok) throw new Error(`rate limit rpc returned ${response.status}`);

    // This PostgreSQL function RETURNS TABLE with exactly one RETURN NEXT.
    // PostgREST therefore returns an array containing one decision. Treat
    // zero, duplicate, or malformed decisions as *unavailable*, not allowed.
    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length !== 1) {
      throw new Error("rate limit rpc returned an unexpected decision count");
    }
    const row = rows[0];
    if (!row || typeof row !== "object" || Array.isArray(row) ||
        typeof row.allowed !== "boolean" ||
        !Number.isSafeInteger(row.remaining) || row.remaining < 0 || row.remaining > maxAttempts ||
        !Number.isSafeInteger(row.retry_after_seconds) ||
        (row.allowed && row.retry_after_seconds !== 0) ||
        (!row.allowed && (row.remaining !== 0 || row.retry_after_seconds < 1))) {
      throw new Error("rate limit rpc returned an invalid decision");
    }

    return {
      allowed: row.allowed,
      remaining: row.remaining,
      retryAfterSeconds: row.retry_after_seconds,
      durable: true
    };
  } catch (error) {
    // Preserve availability without becoming unlimited.
    //
    // A transient database failure must not turn authentication into a total
    // outage, but "fail open" used to mean every attempt was allowed until the
    // durable counter recovered. Fall back to the bounded in-process counter
    // instead. It is not a durable distributed limit in serverless production,
    // so callers still get degraded=true and durable=false, but each warm
    // instance keeps enforcing a finite budget rather than no budget at all.
    const fallback = consumeInMemory(bucketKey, windowSeconds, degradedMaxAttempts);
    return {
      ...fallback,
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
// A degraded durable counter has to be loud, and it used to be loud in exactly one place out of four.
//
// consumeRateLimit's comment above says the degraded flag "is logged so the
// condition is visible rather than silent". That held only where a caller
// remembered to pass `onDegraded`, and of the four limiters in this repository
// only the authenticated one did. Lead capture, public booking and the public
// scroll routes -- the three reachable with no account, which is the entire
// abuse surface -- once degraded to no limit at all and said nothing about it.
//
// An optional hook fails silent exactly when somebody adds a limiter, which is
// the moment nobody is reading this file. Same reasoning as the deny-by-default
// classifier in lib/sonara-agent-authority.cjs. So reporting is the default: a
// caller may replace it, and cannot switch it off by forgetting.
//
// Redacted, and not decoratively. The error carries the PostgREST URL the call
// failed to reach, and that URL carries an apikey parameter, so interpolating it
// raw prints the service-role credential into the log on exactly the path taken
// when the database is already struggling. server.js records finding that.
function defaultDegradedReport({ name, error }) {
  const safeError = redactError(error, { includeStack: false });
  // Keep the readable line for incident response and emit the countable event
  // beside it. The structured emitter applies its own field-wise redaction.
  console.error(`[rate-limit] ${name} degraded to in-memory fallback: ${safeError}`);
  emitEvent({
    event: "rate_limit.degraded",
    scope: "process",
    capability: "rate_limit",
    outcome: "degraded",
    reason: "durable_counter_unavailable",
    detail: { limiter: name, error: safeError }
  }, { write: (line) => console.error(line) });
}

function createRateLimiter({ name, windowSeconds, maxAttempts, degradedMaxAttempts = Math.max(maxAttempts + 20, maxAttempts * 2), scopes = ["ip"], subjectFrom, getSupabaseServerConfig, onDegraded = defaultDegradedReport, renderDenied, requireDurable = false, renderUnavailable }) {
  if (!name) throw new Error("a rate limiter needs a name");
  // A typo, duplicate, or empty scope list would otherwise produce no buckets
  // and silently admit every request. Fail configuration at startup.
  if (!Array.isArray(scopes) || scopes.length === 0 ||
      scopes.some((scope) => scope !== "ip" && scope !== "subject") ||
      new Set(scopes).size !== scopes.length) {
    throw new Error("a rate limiter needs unique ip/subject scopes");
  }

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

    // A subject-only limiter cannot silently disappear when a malformed
    // request contains no email/account identifier. Charge a fallback IP budget.
    if (candidates.length === 0) {
      candidates.push(`${name}:ip:${hashIdentifier(getClientIdentifier(req))}`);
    }

    for (const bucketKey of candidates) {
      const result = await consumeRateLimit(bucketKey, { windowSeconds, maxAttempts, degradedMaxAttempts, getSupabaseServerConfig });

      if (result.degraded && typeof onDegraded === "function") {
        onDegraded({ name, error: result.error });
      }

      // Public email-triggering writes and similarly expensive endpoints can
      // demand a distributed counter in production. A per-instance fallback
      // cannot enforce a global ceiling under serverless concurrency; deny the
      // sensitive operation rather than silently permitting unmetered sends.
      // Existing authentication/booking callers keep their bounded fallback
      // unless they explicitly opt into this stricter availability trade-off.
      const needsDurability = typeof requireDurable === "function" ? requireDurable(req) === true : requireDurable === true;
      if (needsDurability && result.durable !== true) {
        res.setHeader("Retry-After", "60");
        res.setHeader("Cache-Control", "no-store");
        emitEvent({
          event: "rate_limit.unavailable",
          scope: "process",
          capability: "rate_limit",
          outcome: "refused",
          reason: "durable_counter_required",
          detail: { limiter: name }
        });
        if (typeof renderUnavailable === "function") {
          const handled = renderUnavailable({ req, res, retryAfterSeconds: 60 });
          if (handled !== false) return handled;
        }
        return res.status(503).json({
          ok: false,
          code: "rate_limit_unavailable",
          message: "This service is temporarily unable to accept requests safely. No request was recorded or sent.",
          retry_after_seconds: 60
        });
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

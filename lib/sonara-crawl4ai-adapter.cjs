"use strict";

// Crawl4AI — fetch a page and get readable text back.
//
// Apache-2.0, verified from the repository. The README asks for badge
// attribution, which is a request rather than a licence term; the binding
// obligation is Apache's NOTICE requirement, and no Crawl4AI code is copied
// here in any case -- this calls a service the owner runs.
//
// Why it is worth adapting: Growth Studio and the market-intelligence surfaces
// are about what is happening outside the business, and every one of them
// currently depends on somebody pasting text in. This is the difference between
// "record what you found" and "go and look".
//
// ## The rule that makes this different from the model adapters
//
// A model adapter sends text the owner already had. **This one makes this
// server fetch a URL somebody supplied**, which turns it into a request
// forwarder if the URL is not checked. A URL pointing at a cloud metadata
// endpoint, or at a private address on the same network as the crawler, is a
// server-side request forgery with this application's own network position
// behind it.
//
// So the target is validated here, before it is handed on, and the checks are
// deliberately strict rather than clever: http and https only, no credentials
// in the URL, and no host that resolves by name to a private range. Hostnames
// that are literal private addresses are rejected outright; a name that
// resolves to one is the case this cannot see from here, and it is stated
// rather than implied.

const base = require("./sonara-service-adapter.cjs");

const LABEL = "Crawl4AI";
const PREFIX = "SONARA_CRAWL4AI";

const ENV_KEYS = base.envKeysFor(PREFIX);

// Literal addresses that must never be fetched: loopback, link-local, cloud
// metadata, and the three private IPv4 ranges.
const FORBIDDEN_HOST = /^(localhost|127\.|0\.0\.0\.0$|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$|\[?fe80:|\[?fc00:|\[?fd)/i;

function getCrawl4aiReadiness(options = {}) {
  return base.readinessFor({ label: LABEL, prefix: PREFIX, ...options });
}

/**
 * Whether a URL may be fetched, and why not if it may not.
 *
 * Returns null when it is allowed, so a caller reads `if (reason) refuse`.
 */
function reasonNotCrawlable(target) {
  let url;
  try {
    url = new URL(String(target || ""));
  } catch {
    return "That is not a valid web address.";
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return `Only http and https addresses can be fetched, not ${url.protocol.replace(":", "")}.`;
  }

  // A URL carrying credentials would send them from this server.
  if (url.username || url.password) return "That address carries a username or password, which this will not send.";

  if (FORBIDDEN_HOST.test(url.hostname)) {
    return "That address is on a private or loopback network. This server will not fetch it, because doing so would use its own network position on someone else's behalf.";
  }

  return null;
}

/**
 * Fetch a page through the owner's Crawl4AI and return its text.
 *
 * Returns { ok: true, text, url } or { ok: false, code, detail }.
 */
async function fetchPage(target, { readiness = getCrawl4aiReadiness(), fetchImpl = fetch } = {}) {
  const refusal = reasonNotCrawlable(target);
  if (refusal) return { ok: false, code: "refused_target", detail: refusal };

  const called = await base.postJson(readiness, "/crawl", { urls: [String(target)], priority: 10 }, { fetchImpl });
  if (!called.ok) return called;

  const first = Array.isArray(called.data?.results) ? called.data.results[0] : called.data;
  const text = String(first?.markdown || first?.cleaned_html || first?.extracted_content || "").trim();
  if (!text) return { ok: false, code: "empty_response", detail: "The page was fetched and no readable text came back." };

  // Bounded, because this is somebody else's page and the caller renders it.
  return { ok: true, text: text.slice(0, 200000), url: String(target) };
}

module.exports = { ENV_KEYS, FORBIDDEN_HOST, getCrawl4aiReadiness, reasonNotCrawlable, fetchPage };

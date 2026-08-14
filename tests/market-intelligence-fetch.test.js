"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const SOURCE = fs.readFileSync(path.join(__dirname, "..", "routes", "market-intelligence-routes.cjs"), "utf8");
const crawl = require("../lib/sonara-crawl4ai-adapter.cjs");

function handlerSource() {
  const start = SOURCE.indexOf('app.post("/api/market-intelligence/fetch-source"');
  const end = SOURCE.indexOf('app.get("/api/market-intelligence/signals"');
  assert.ok(start > 0 && end > start, "the fetch handler was not found; this test would check nothing");
  return SOURCE.slice(start, end);
}

// The first place an adapter does work rather than report its own readiness.
// What it must not do is the interesting part.
describe("fetching a source page for market intelligence", () => {
  it("writes nothing", () => {
    // A signal is evidence somebody judged. A summary this server invented
    // would enter the record indistinguishable from one an owner wrote.
    const handler = handlerSource();
    assert.ok(handler.length > 500, "the handler was not found; this test is checking nothing");
    assert.doesNotMatch(handler, /\binsert\s*\(/, "the fetch handler must not write a row");
    assert.doesNotMatch(handler, /recordEvent/, "it must not record an event either");
    assert.doesNotMatch(handler, /TABLES\./, "it must not name a table at all");
  });

  it("does not invent any field the signal form requires", () => {
    const handler = handlerSource();
    for (const field of ["signal_type", "confidence", "summary", "title", "observed_at"]) {
      assert.doesNotMatch(handler, new RegExp(`${field}\\s*:`), `the fetch must not produce a ${field}`);
    }
  });

  it("reports an unconfigured service as a normal answer, not a failure", () => {
    // The page worked before this existed and has to keep working. A 503 here
    // would make an optional capability look like a broken one.
    const handler = handlerSource();
    assert.match(handler, /status\(200\)[\s\S]*fetched: false/, "an unconfigured service must answer 200 with fetched: false");
    assert.match(handler, /Paste the text yourself/, "and must say what to do instead");
  });

  it("refuses a target the crawler would not fetch, before any request is made", () => {
    // The adapter owns this and the route inherits it. Asserted here because
    // this is the first caller and the guarantee is what makes it safe.
    for (const target of ["http://169.254.169.254/latest/meta-data/", "http://10.0.0.1/x", "http://localhost:8080/x"]) {
      assert.ok(crawl.reasonNotCrawlable(target), `${target} must be refused`);
    }
    assert.equal(crawl.reasonNotCrawlable("https://example.com/report"), null);
  });

  it("only accepts an https source, matching what a signal row will store", () => {
    // market_intelligence_signals.source_url has a check constraint requiring
    // https, so accepting http here would produce text nobody could file.
    assert.match(handlerSource(), /safeHttpsUrl/, "the same https check the signal route uses");
  });

  it("says when it truncated rather than returning a short page silently", () => {
    assert.match(handlerSource(), /truncated:/, "a cut page must say it was cut");
  });
});

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const crypto = require("node:crypto");
const signalling = require("../lib/sonara-call-signalling.cjs");
const store = require("../lib/sonara-call-sessions.cjs");
const routes = require("../routes/sonara-call-routes.cjs");

const ORG = "11111111-1111-4111-8111-111111111111";
const CALL = "22222222-2222-4222-8222-222222222222";

function env(values) {
  return { getEnv: (name) => values[name] || "" };
}

describe("whether a call can be placed at all", () => {
  it("reports setup_required, not an error, when nothing is configured", () => {
    const readiness = signalling.callReadiness(env({}));
    assert.equal(readiness.ok, false);
    assert.equal(readiness.status, "setup_required");
    // The name of the variable, because the person reading this has to set it.
    assert.match(readiness.detail, /SONARA_STUN_URLS/);
    assert.deepEqual(readiness.iceServers, []);
  });

  // A hardcoded public STUN address would make calling work with no
  // configuration and make it somebody else's decision when it stops.
  it("has no default STUN address anywhere in the source", () => {
    for (const file of ["../lib/sonara-call-signalling.cjs", "../public/sonara-call.js", "../routes/sonara-call-routes.cjs"]) {
      const source = fs.readFileSync(require.resolve(file), "utf8");
      const code = source.replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/[^\n]*/g, (match, before) => (before === undefined ? " " : `${before} `));
      assert.doesNotMatch(code, /stun:[a-z0-9.]+/i, `${file} carries a hardcoded STUN address`);
      assert.doesNotMatch(code, /turn:[a-z0-9.]+/i, `${file} carries a hardcoded TURN address`);
    }
  });

  it("builds ICE servers from configuration when it has one", () => {
    const readiness = signalling.callReadiness(env({ SONARA_STUN_URLS: "stun:one.example:3478, stun:two.example:3478" }));
    assert.equal(readiness.ok, true);
    assert.deepEqual(readiness.iceServers, [{ urls: ["stun:one.example:3478", "stun:two.example:3478"] }]);
    // Said plainly, because it is the difference between most calls connecting
    // and every call connecting.
    assert.equal(readiness.relay, false);
  });

  it("refuses an address that is not a STUN address rather than passing it through", () => {
    const readiness = signalling.callReadiness(env({ SONARA_STUN_URLS: "https://example.com" }));
    assert.equal(readiness.status, "misconfigured");
    assert.deepEqual(readiness.iceServers, []);
  });

  // Either alone is a half-configured relay, and running silently without one
  // is the version of that nobody notices.
  it("refuses a relay address with no secret, and a secret with no address", () => {
    assert.equal(signalling.callReadiness(env({ SONARA_STUN_URLS: "stun:a.example:3478", SONARA_TURN_URL: "turn:b.example:3478" })).status, "misconfigured");
    assert.equal(signalling.callReadiness(env({ SONARA_STUN_URLS: "stun:a.example:3478", SONARA_TURN_SECRET: "s" })).status, "misconfigured");
  });
});

describe("TURN credentials handed to a browser", () => {
  const secret = "a-long-shared-secret";

  it("expire, and say when", () => {
    const now = 1_800_000_000_000;
    const minted = signalling.turnCredentials(secret, { now, ttlSeconds: 3600, name: "x" });
    const [expiry] = minted.username.split(":");
    assert.equal(Number(expiry), Math.floor(now / 1000) + 3600);
    assert.equal(minted.expiresAt, new Date((Math.floor(now / 1000) + 3600) * 1000).toISOString());
  });

  it("are an HMAC of the username under the shared secret, as a TURN relay verifies them", () => {
    const minted = signalling.turnCredentials(secret, { now: 1_800_000_000_000, name: "x" });
    const expected = crypto.createHmac("sha1", secret).update(minted.username).digest("base64");
    assert.equal(minted.credential, expected);
  });

  // The expiry is the first field and a colon is its terminator. A name
  // carrying one moves the boundary, and a relay would then read a different
  // expiry from the one that was signed for.
  it("cannot have their expiry moved by a name containing a colon", () => {
    const minted = signalling.turnCredentials(secret, { now: 1_800_000_000_000, name: "9999999999:admin" });
    assert.equal(minted.username.split(":").length, 2);
    assert.equal(Number(minted.username.split(":")[0]), 1_800_000_000 + signalling.TURN_TTL_SECONDS);
  });

  it("are never the same for two different expiries", () => {
    const one = signalling.turnCredentials(secret, { now: 1_800_000_000_000 });
    const two = signalling.turnCredentials(secret, { now: 1_800_003_600_000 });
    assert.notEqual(one.credential, two.credential);
  });

  it("never puts the signing secret in what a browser is handed", () => {
    const readiness = signalling.callReadiness(env({
      SONARA_STUN_URLS: "stun:a.example:3478",
      SONARA_TURN_URL: "turn:b.example:3478",
      SONARA_TURN_SECRET: secret
    }));
    assert.equal(readiness.ok, true);
    assert.equal(readiness.relay, true);
    assert.doesNotMatch(JSON.stringify(readiness), new RegExp(secret), "the shared secret reached the browser payload");
  });
});

describe("a join token", () => {
  it("is 32 random bytes, and no two are alike", () => {
    const tokens = new Set();
    for (let i = 0; i < 200; i += 1) tokens.add(signalling.newJoinToken());
    assert.equal(tokens.size, 200);
    assert.equal(Buffer.from(signalling.newJoinToken(), "base64url").length, 32);
  });

  it("matches the shape the table's own constraint allows", () => {
    const migration = fs.readFileSync(require.resolve("../supabase/migrations/20260827090000_call_sessions.sql"), "utf8");
    const constraint = migration.match(/check \(join_token ~ '(\^\[A-Za-z0-9_-\]\{\d+,\d+\}\$)'\)/);
    assert.ok(constraint, "the join_token constraint has moved; this check has gone blind");
    const pattern = new RegExp(constraint[1]);
    for (let i = 0; i < 50; i += 1) {
      assert.match(signalling.newJoinToken(), pattern);
    }
  });
});

describe("whether a call may still be joined", () => {
  const future = () => new Date(Date.now() + 60_000).toISOString();

  it("opens a ringing call whose link has not expired", () => {
    assert.equal(signalling.joinable({ status: "ringing", expires_at: future() }).ok, true);
  });

  it("refuses one whose link has expired", () => {
    assert.equal(signalling.joinable({ status: "ringing", expires_at: new Date(Date.now() - 1).toISOString() }).code, "link_expired");
  });

  // The column is not null, so a missing value means the row was not read
  // properly -- and reading "no expiry" out of that turns a bearer token
  // permanent.
  it("treats a missing expiry as expired rather than as no expiry", () => {
    assert.equal(signalling.joinable({ status: "ringing" }).code, "no_expiry");
    assert.equal(signalling.joinable({ status: "ringing", expires_at: "not a date" }).code, "no_expiry");
  });

  it("refuses a call that is over", () => {
    assert.equal(signalling.joinable({ status: "ended", expires_at: future() }).code, "call_over");
    assert.equal(signalling.joinable({ status: "missed", expires_at: future() }).code, "call_over");
  });

  it("refuses a status it does not recognise instead of assuming it is fine", () => {
    assert.equal(signalling.joinable({ status: "whatever", expires_at: future() }).code, "unknown_status");
  });
});

describe("what one browser may send the other", () => {
  const offer = { type: "offer", sdp: "v=0" };

  it("accepts the four kinds a call is made of", () => {
    for (const kind of signalling.KINDS) {
      assert.equal(signalling.validateSignal({ role: "business", kind, payload: offer }).ok, true, kind);
    }
  });

  it("refuses a kind that is not part of a call", () => {
    assert.equal(signalling.validateSignal({ role: "business", kind: "record", payload: offer }).code, "unknown_kind");
  });

  it("refuses a role it did not derive", () => {
    assert.equal(signalling.validateSignal({ role: "admin", kind: "offer", payload: offer }).code, "unknown_role");
  });

  it("bounds the payload rather than storing whatever arrives", () => {
    const huge = { sdp: "x".repeat(signalling.MAX_PAYLOAD_BYTES + 1) };
    assert.equal(signalling.validateSignal({ role: "business", kind: "offer", payload: huge }).code, "payload_too_large");
  });

  // An SDP is opaque here on purpose. A validator that half-understood one
  // would refuse working calls while protecting nothing.
  it("never inspects the payload beyond its size", () => {
    const source = fs.readFileSync(require.resolve("../lib/sonara-call-signalling.cjs"), "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/[^\n]*/g, (match, before) => (before === undefined ? " " : `${before} `));
    assert.doesNotMatch(code, /\bsdp\b/, "the validator has started reading SDP");
  });
});

describe("reading and writing calls", () => {
  function supabase(handler) {
    const calls = [];
    return {
      calls,
      fetchImpl: async (url, init = {}) => {
        calls.push({ url, method: init.method || "GET" });
        return handler(url, init) || { ok: true, json: async () => [] };
      }
    };
  }

  const deps = { supabaseUrl: "https://example.supabase.co", serviceRoleHeaders: () => ({ apikey: "k" }) };

  it("generates the token and the expiry itself rather than taking them from a caller", async () => {
    let written = null;
    const db = supabase((url, init) => {
      written = JSON.parse(init.body);
      return { ok: true, json: async () => [{ id: CALL, ...written }] };
    });
    const placed = await store.place(deps, { organizationId: ORG }, { fetchImpl: db.fetchImpl });
    assert.equal(placed.ok, true);
    assert.match(written.join_token, /^[A-Za-z0-9_-]{43}$/);
    assert.ok(Date.parse(written.expires_at) > Date.now(), "a call was written with an expiry in the past");
    assert.equal(written.status, "ringing");
  });

  it("re-checks the token on the row it got back", async () => {
    // A query written or edited wrongly on this path hands a stranger somebody
    // else's call, and no test of the happy path would notice.
    const token = signalling.newJoinToken();
    const db = supabase(() => ({ ok: true, json: async () => [{ id: CALL, join_token: signalling.newJoinToken() }] }));
    const found = await store.byToken(deps, token, db.fetchImpl);
    assert.equal(found.ok, false);
    assert.equal(found.code, "no_such_call");
  });

  it("does not go to the database for a token that cannot be one", async () => {
    const db = supabase(() => ({ ok: true, json: async () => [] }));
    const found = await store.byToken(deps, "short", db.fetchImpl);
    assert.equal(found.code, "no_such_call");
    assert.equal(db.calls.length, 0, "a malformed token should not become a query");
  });

  it("hands each end only what the other end sent", async () => {
    const db = supabase(() => ({ ok: true, json: async () => [] }));
    await store.signalsFor(deps, { callId: CALL, organizationId: ORG, role: "customer" }, db.fetchImpl);
    assert.match(db.calls[0].url, /from_role=eq\.business/);
    db.calls.length = 0;
    await store.signalsFor(deps, { callId: CALL, organizationId: ORG, role: "business" }, db.fetchImpl);
    assert.match(db.calls[0].url, /from_role=eq\.customer/);
  });

  it("scopes every read to the organization", async () => {
    const db = supabase(() => ({ ok: true, json: async () => [{ id: CALL }] }));
    await store.byId(deps, { organizationId: ORG, callId: CALL }, db.fetchImpl);
    await store.signalsFor(deps, { callId: CALL, organizationId: ORG, role: "business" }, db.fetchImpl);
    await store.forCustomer(deps, { organizationId: ORG, customerId: CALL }, db.fetchImpl);
    assert.ok(db.calls.length >= 3, "the reads did not happen; this check measures nothing");
    for (const call of db.calls) {
      assert.match(call.url, new RegExp(`organization_id=eq\\.${ORG}`), `unscoped read: ${call.url}`);
    }
  });

  // "Nothing yet" and "we could not look" are the same shape and different
  // facts, a hundred times per call.
  it("reports a failed poll as a failure rather than as no signals", async () => {
    const db = supabase(() => ({ ok: false, status: 500 }));
    const found = await store.signalsFor(deps, { callId: CALL, organizationId: ORG, role: "business" }, db.fetchImpl);
    assert.equal(found.ok, false);
    assert.deepEqual(found.rows, []);
    assert.equal(found.code, "unreadable");
  });

  it("never returns the join token on a customer's own call history", () => {
    assert.doesNotMatch(store.SAFE_SESSION_COLUMNS, /join_token/);
  });

  // The table's constraint requires an ended call to have an ending. Setting it
  // here is what keeps that constraint from being the thing that reports the bug.
  it("stamps an ending when a call ends", async () => {
    let patched = null;
    const db = supabase((url, init) => {
      patched = JSON.parse(init.body);
      return { ok: true, json: async () => [] };
    });
    await store.setStatus(deps, { callId: CALL, organizationId: ORG, status: "ended" }, { fetchImpl: db.fetchImpl });
    assert.ok(patched.ended_at, "an ended call was written with no ending");
    await store.setStatus(deps, { callId: CALL, organizationId: ORG, status: "connected" }, { fetchImpl: db.fetchImpl });
    assert.ok(patched.connected_at);
  });

  it("refuses a status the table would reject rather than sending it", async () => {
    const db = supabase(() => ({ ok: true, json: async () => [] }));
    const moved = await store.setStatus(deps, { callId: CALL, organizationId: ORG, status: "recording" }, { fetchImpl: db.fetchImpl });
    assert.equal(moved.code, "unknown_status");
    assert.equal(db.calls.length, 0);
  });
});

describe("the routes and the pages", () => {
  const source = fs.readFileSync(require.resolve("../routes/sonara-call-routes.cjs"), "utf8");
  const code = source.replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/[^\n]*/g, (match, before) => (before === undefined ? " " : `${before} `));
  const client = fs.readFileSync(require.resolve("../public/sonara-call.js"), "utf8");
  const clientCode = client.replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/[^\n]*/g, (match, before) => (before === undefined ? " " : `${before} `));

  it("refuses to register without the helpers it depends on", () => {
    for (const missing of routes.REQUIRED) {
      const deps = Object.fromEntries(routes.REQUIRED.map((name) => [name, () => {}]));
      delete deps[missing];
      assert.throws(() => routes({ get: () => {}, post: () => {} }, deps), new RegExp(missing), `registering without ${missing} should say which one is missing`);
    }
  });

  // The field that would let one end post as the other.
  it("derives which end is asking instead of reading it from the request", () => {
    assert.doesNotMatch(code, /req\.body\??\.?\.role/, "the role is being read from the request body");
    assert.doesNotMatch(code, /req\.query\.role/, "the role is being read from the query string");
    assert.match(code, /role: resolved\.role/);
  });

  // Without this a valid token reads any call's signals by changing the path.
  it("requires the call in the path to be the call the token names", () => {
    const guards = code.match(/String\(req\.params\.callId\) !== String\(resolved\.call\.id\)/g) || [];
    assert.equal(guards.length, 3, `expected the guard on all three call endpoints, found ${guards.length}`);
  });

  it("refuses to place a call before there is any way to connect one", () => {
    const place = code.slice(code.indexOf('app.post("/api/calls"'));
    const readiness = place.indexOf("callReadiness");
    const write = place.indexOf("store.place(");
    assert.ok(readiness > -1 && write > -1 && readiness < write, "readiness must be checked before a row is written");
  });

  // Hanging up is the one thing that must keep working when everything else
  // about the call has stopped.
  it("still accepts a hangup after the link has expired", () => {
    const status = code.slice(code.indexOf('app.post("/api/calls/:callId/status"'), code.indexOf('function callShell'));
    assert.doesNotMatch(status, /refuseUnjoinable/, "hanging up must not be refused for an expired call");
  });

  it("only lets a browser declare the two states a browser can know", () => {
    assert.match(code, /\["connected", "ended"\]\.includes\(wanted\)/);
  });

  describe("nothing here carries audio", () => {
    const migration = fs.readFileSync(require.resolve("../supabase/migrations/20260827090000_call_sessions.sql"), "utf8");

    // The column definitions and nothing else.
    //
    // The first version stripped `--` comments and searched the rest, which
    // matched the word "audio" inside `comment on table ... 'The audio is peer
    // to peer'` -- prose about there being none, read as a column. Measuring a
    // different population from the one it names, again, and in the check whose
    // whole job is to say what the schema holds.
    const columnBlocks = [...migration.matchAll(/create table if not exists public\.\w+ \(([\s\S]*?)\n\);/g)]
      .map((match) => match[1].replace(/^\s*--.*$/gm, ""));

    it("finds the tables at all, so the check below is not searching nothing", () => {
      assert.equal(columnBlocks.length, 2, `expected two create-table blocks, found ${columnBlocks.length}`);
      assert.match(columnBlocks.join("\n"), /join_token/);
    });

    it("has no recording, transcript or audio column", () => {
      const columns = columnBlocks.join("\n");
      for (const word of ["recording", "transcript", "audio", "media_url"]) {
        assert.doesNotMatch(columns, new RegExp(`\\b${word}\\b`, "i"), `the call schema has a ${word} column`);
      }
    });

    it("asks for a microphone and never a camera", () => {
      assert.match(clientCode, /getUserMedia\(\{ audio: true, video: false \}\)/);
    });

    it("never asks for the microphone outside a click", () => {
      const click = clientCode.indexOf('addEventListener("click"');
      assert.notEqual(click, -1);
      const declaration = clientCode.indexOf("function microphone()");
      assert.notEqual(declaration, -1, "microphone() has been renamed; this check has gone blind");
      const callSites = [...clientCode.matchAll(/microphone\(\)/g)]
        .map((match) => match.index)
        .filter((index) => index !== declaration + "function ".length);
      assert.ok(callSites.length >= 1, "nothing asks for a microphone; the button does nothing");
      // Every call site is inside startAsBusiness or the offer handler, both of
      // which only run from the click. Asserted as "after the handlers are
      // defined" rather than by tracing, and paired with the check above that
      // there is exactly one getUserMedia.
      assert.equal((clientCode.match(/getUserMedia\(/g) || []).length, 1, "there should be one place that opens a microphone");
    });

    it("stops polling once the call connects, because nothing more comes through us", () => {
      const connected = clientCode.indexOf('connection.connectionState === "connected"');
      assert.notEqual(connected, -1);
      const stop = clientCode.indexOf("stopPolling()", connected);
      assert.ok(stop > connected && stop - connected < 400, "the poll should stop when the call connects");
    });
  });

  it("holds the microphone open to this origin only, and still denies the camera", () => {
    const server = fs.readFileSync(require.resolve("../server.js"), "utf8");
    const header = server.match(/setHeader\("Permissions-Policy", "([^"]+)"\)/);
    assert.ok(header, "the Permissions-Policy header has moved; this check has gone blind");
    assert.match(header[1], /microphone=\(self\)/);
    assert.doesNotMatch(header[1], /microphone=\*/);
    assert.match(header[1], /camera=\(\)/);
  });

  it("records the reason for the header change where AGENTS.md requires it", () => {
    const notes = fs.readFileSync(require.resolve("../SECURITY_NOTES.md"), "utf8");
    assert.match(notes, /microphone=\(self\)/);
  });

  it("gives the customer's page its own ICE servers, since it never calls the create endpoint", () => {
    const customer = code.slice(code.indexOf('app.get(`${CUSTOMER_PAGE}/:token`'));
    assert.match(customer, /iceServers: readiness\.iceServers/);
  });
});

describe("the customer record links to both things you can do with it", () => {
  const pages = require("../lib/sonara-owner-record-pages.cjs");

  it("offers the contact card and the call, rather than leaving either unlinked", () => {
    const customers = pages.ALL_OWNER_PAGES.find((page) => page.path === "/business-builder/owner/customers");
    assert.ok(customers, "the customers page has moved; this check has gone blind");
    const hrefs = pages.downloadsOf(customers).map((entry) => entry.href("ID"));
    assert.deepEqual(hrefs, [
      "/business-builder/owner/customers/ID/contact",
      "/business-builder/owner/customers/ID/call"
    ]);
  });

  it("still accepts a page that declares a single action rather than a list", () => {
    // The receivables page has one -- "Download this invoice" -- written before
    // this took a list. Rewriting it as an array of one would be churn.
    const receivables = pages.ALL_OWNER_PAGES.find((page) => page.path === "/business-builder/owner/receivables");
    assert.ok(receivables, "the receivables page has moved; this check has gone blind");
    assert.equal(Array.isArray(receivables.download), false, "this no longer tests the single-object shape");
    assert.equal(pages.downloadsOf(receivables).length, 1);
  });

  it("returns nothing for a page with no actions, rather than a list with a hole in it", () => {
    assert.deepEqual(pages.downloadsOf({}), []);
    assert.deepEqual(pages.downloadsOf(null), []);
  });
});

"use strict";

// Signing in, and the two things that stop it being a phishing tool.
//
// The authorization code arrives over loopback rather than through a human, and
// redeeming it needs a verifier that never left this process. The `state` check
// is what keeps the loopback server from accepting a code somebody else started.
//
// The round trip against a real IAM Identity Center instance is not tested here
// and has never been run. What is tested is everything this process decides on
// its own: the PKCE construction, the URL, the state comparison, and what the
// callback server does with each shape of redirect.

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const {
  createPkcePair, authorizationUrl, startCallbackServer, openBrowser,
  registerClient, createToken, getRoleCredentials, oidcHost, portalHost
} = require("../src/login.js");

test("builds a PKCE pair the way RFC 7636 says", () => {
  const { verifier, challenge, method } = createPkcePair();
  assert.equal(method, "S256");
  assert.ok(verifier.length >= 43 && verifier.length <= 128, `verifier is ${verifier.length} characters, outside 43-128`);
  assert.match(verifier, /^[A-Za-z0-9\-._~]+$/, "the verifier uses characters outside the unreserved set");
  assert.equal(
    challenge,
    crypto.createHash("sha256").update(verifier).digest("base64url"),
    "the challenge is not the base64url SHA-256 of the verifier"
  );
});

test("a new pair every time, so one login cannot redeem another's code", () => {
  const seen = new Set();
  for (let i = 0; i < 50; i += 1) seen.add(createPkcePair().verifier);
  assert.equal(seen.size, 50, "the verifier repeats, which makes PKCE decorative");
});

test("sends the browser to AWS with the challenge and never the verifier", () => {
  const { verifier, challenge } = createPkcePair();
  const url = authorizationUrl({
    region: "eu-west-1", clientId: "client-1",
    redirectUri: "http://127.0.0.1:5555/oauth/callback",
    challenge, state: "state-1"
  });
  const parsed = new URL(url);
  assert.equal(parsed.host, "oidc.eu-west-1.amazonaws.com");
  assert.equal(parsed.pathname, "/authorize");
  assert.equal(parsed.searchParams.get("response_type"), "code");
  assert.equal(parsed.searchParams.get("code_challenge"), challenge);
  assert.equal(parsed.searchParams.get("code_challenge_method"), "S256");
  assert.equal(parsed.searchParams.get("redirect_uri"), "http://127.0.0.1:5555/oauth/callback");
  assert.ok(!url.includes(verifier), "the verifier was put in the URL, which hands away the whole point of PKCE");
});

test("refuses to build an authorization URL with no state", () => {
  assert.throws(
    () => authorizationUrl({ region: "eu-west-1", clientId: "c", redirectUri: "http://127.0.0.1/oauth/callback", challenge: "x" }),
    /state/,
    "a login with no state would accept a redirect that started somewhere else"
  );
});

test("listens on loopback only, on a port the system chose", async () => {
  const server = await startCallbackServer({ expectedState: "abc" });
  try {
    assert.ok(server.port > 0);
    assert.equal(server.redirectUri, `http://127.0.0.1:${server.port}/oauth/callback`);
  } finally {
    server.close();
  }
});

test("accepts the code when the state matches", async () => {
  const state = "the-expected-state";
  const server = await startCallbackServer({ expectedState: state });
  const response = await fetch(`http://127.0.0.1:${server.port}/oauth/callback?code=abc123&state=${state}`);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Signed in/);
  assert.deepEqual(await server.code, { code: "abc123" });
});

test("refuses a code whose state did not come from this login", async () => {
  const server = await startCallbackServer({ expectedState: "the-expected-state" });
  const response = await fetch(`http://127.0.0.1:${server.port}/oauth/callback?code=attacker&state=somebody-elses`);
  assert.equal(response.status, 400, "a redirect with the wrong state was accepted");
  await assert.rejects(server.code, /did not start here/);
});

test("refuses a redirect carrying no state at all", async () => {
  const server = await startCallbackServer({ expectedState: "the-expected-state" });
  const response = await fetch(`http://127.0.0.1:${server.port}/oauth/callback?code=attacker`);
  assert.equal(response.status, 400, "a redirect with no state was accepted");
  await assert.rejects(server.code, /did not start here/);
});

test("passes AWS's own error through rather than reporting a generic failure", async () => {
  const state = "s";
  const server = await startCallbackServer({ expectedState: state });
  await fetch(`http://127.0.0.1:${server.port}/oauth/callback?error=access_denied&error_description=Not+entitled&state=${state}`);
  await assert.rejects(server.code, /Not entitled/);
});

test("ignores a request to any other path", async () => {
  const server = await startCallbackServer({ expectedState: "s" });
  try {
    const response = await fetch(`http://127.0.0.1:${server.port}/`);
    assert.equal(response.status, 404);
  } finally {
    server.close();
  }
});

test("refuses to start without a state to compare against", () => {
  assert.throws(() => startCallbackServer({}), /state/);
});

test("opens the browser without putting the URL through a shell", () => {
  const calls = [];
  const fakeSpawn = (command, args) => {
    calls.push({ command, args });
    return { unref() {}, on() {} };
  };
  openBrowser("https://example.com/authorize?a=1&b=2", { platform: "linux", spawnImpl: fakeSpawn });
  assert.equal(calls[0].command, "xdg-open");
  assert.deepEqual(calls[0].args, ["https://example.com/authorize?a=1&b=2"],
    "the URL was not passed as a single argument, so a shell could read the & as a command separator");
});

test("says the browser did not open rather than throwing on a machine with none", () => {
  const opened = openBrowser("https://example.com", {
    platform: "linux",
    spawnImpl: () => { throw new Error("no such file"); }
  });
  assert.equal(opened, false, "a machine with no browser would have crashed the login");
});

test("registers a public client for the authorization code grant only", async () => {
  let sent = null;
  const fetchImpl = async (url, options) => {
    sent = { url, body: JSON.parse(options.body) };
    return { ok: true, status: 200, text: async () => JSON.stringify({ clientId: "c", clientSecret: "s" }) };
  };
  await registerClient({
    region: "eu-west-1", clientName: "sonara-serverless",
    redirectUri: "http://127.0.0.1:1234/oauth/callback"
  }, { fetchImpl });

  assert.equal(sent.url, "https://oidc.eu-west-1.amazonaws.com/client/register");
  assert.equal(sent.body.clientType, "public");
  assert.deepEqual(sent.body.redirectUris, ["http://127.0.0.1:1234/oauth/callback"]);
  assert.ok(
    !sent.body.grantTypes.some((grant) => grant.includes("device_code")),
    "the client was registered for the device code grant, which is the phishable flow this deliberately does not offer"
  );
  assert.ok(sent.body.grantTypes.includes("authorization_code"));
});

test("redeems the code with the verifier", async () => {
  let sent = null;
  const fetchImpl = async (url, options) => {
    sent = JSON.parse(options.body);
    return { ok: true, status: 200, text: async () => JSON.stringify({ accessToken: "at", expiresIn: 3600 }) };
  };
  const token = await createToken({
    region: "eu-west-1", clientId: "c", clientSecret: "s",
    code: "abc", verifier: "the-verifier", redirectUri: "http://127.0.0.1:1/oauth/callback"
  }, { fetchImpl });
  assert.equal(sent.grantType, "authorization_code");
  assert.equal(sent.codeVerifier, "the-verifier");
  assert.equal(token.accessToken, "at");
});

test("passes AWS's error text through when a token call fails", async () => {
  const fetchImpl = async () => ({
    ok: false, status: 400,
    text: async () => JSON.stringify({ error: "invalid_grant", error_description: "That code has already been used." })
  });
  await assert.rejects(
    createToken({ region: "eu-west-1", clientId: "c", clientSecret: "s", code: "x", verifier: "v", redirectUri: "u" }, { fetchImpl }),
    /already been used/
  );
});

test("exchanges the access token for role credentials at the portal", async () => {
  let seen = null;
  const fetchImpl = async (url, options) => {
    seen = { url, headers: options.headers };
    return {
      ok: true, status: 200,
      json: async () => ({ roleCredentials: { accessKeyId: "AK", secretAccessKey: "SK", sessionToken: "ST", expiration: 1700000000000 } })
    };
  };
  const credentials = await getRoleCredentials({
    region: "eu-west-1", accessToken: "at", accountId: "111122223333", roleName: "Deploy"
  }, { fetchImpl });

  assert.match(seen.url, /^https:\/\/portal\.sso\.eu-west-1\.amazonaws\.com\/federation\/credentials\?/);
  assert.equal(seen.headers["x-amz-sso_bearer_token"], "at");
  assert.equal(credentials.accessKeyId, "AK");
  assert.equal(credentials.sessionToken, "ST");
  assert.ok(credentials.expiresAt.startsWith("2023-"), `expiry did not parse: ${credentials.expiresAt}`);
});

test("refuses credentials the portal returned incomplete", async () => {
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ roleCredentials: { accessKeyId: "AK" } }) });
  await assert.rejects(
    getRoleCredentials({ region: "eu-west-1", accessToken: "at", accountId: "1", roleName: "R" }, { fetchImpl }),
    /did not return usable credentials/,
    "a half-populated credential set was accepted and would fail later as a signing error"
  );
});

test("builds the AWS hostnames from the region", () => {
  assert.equal(oidcHost("us-east-1"), "oidc.us-east-1.amazonaws.com");
  assert.equal(portalHost("ap-southeast-2"), "portal.sso.ap-southeast-2.amazonaws.com");
});

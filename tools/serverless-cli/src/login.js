"use strict";

// Signing in, through the browser, without becoming a phishing tool.
//
// There are two ways a command line tool can sign into AWS IAM Identity Center,
// and the difference between them is not a matter of taste.
//
// **Device code** is the one where the terminal prints a short code and you
// type it into a web page. It is phishable by design: an attacker runs the flow
// against *their* client, gets a genuine AWS code, sends it to you with a
// plausible story, and you approve their session against your account. Nothing
// about the page you are looking at is fake -- it is the real AWS page, the code
// is a real code, and it authorises somebody else. The only defence is a
// sentence asking the user to be careful, which is not a defence.
//
// **Authorization code with PKCE** is the one implemented here. The tool opens
// a browser, AWS redirects back to a server listening on 127.0.0.1, and the
// authorization code arrives over the loopback interface rather than through a
// human. A code phished out of somebody is worthless: redemption requires the
// `code_verifier`, which never left this process. AWS made this the default in
// the AWS CLI at v2.22.0 for exactly this reason.
//
// So there is no device-code fallback here. A fallback would be a switch that
// turns the phishable flow back on, and the people most likely to find it are
// the people being talked through a fix by a stranger.
//
// ## What is verified here and what is not
//
// The PKCE construction, the authorization URL, the state check and the
// callback parsing are all tested. The round trip against a real IAM Identity
// Center instance is **not** -- this has never been run against a live AWS
// account, and the README says so rather than implying otherwise.

const crypto = require("node:crypto");
const http = require("node:http");
const { spawn } = require("node:child_process");

// RFC 7636. A verifier is 43-128 characters of unreserved alphabet; 32 random
// bytes base64url-encoded lands at 43.
function createPkcePair() {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge, method: "S256" };
}

function oidcHost(region) {
  return `oidc.${region}.amazonaws.com`;
}

function portalHost(region) {
  return `portal.sso.${region}.amazonaws.com`;
}

/**
 * Build the URL the browser is sent to.
 *
 * `state` is not optional and is compared on the way back. Without it, any page
 * the user visits during the login could drive a request at the callback server
 * and hand this process an authorization code of somebody else's choosing.
 */
function authorizationUrl({ region, clientId, redirectUri, challenge, state, scopes = ["sso:account:access"] }) {
  for (const [name, value] of Object.entries({ region, clientId, redirectUri, challenge, state })) {
    if (!value) throw new TypeError(`authorizationUrl needs ${name}`);
  }
  const query = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    scopes: scopes.join(" ")
  });
  return `https://${oidcHost(region)}/authorize?${query.toString()}`;
}

// What the browser lands on once AWS redirects back. Deliberately plain: it is
// rendered from this process, so anything it claims is something this process
// knows.
function callbackPage(ok, detail) {
  const title = ok ? "Signed in" : "Sign-in did not finish";
    return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font:16px/1.5 system-ui,sans-serif;margin:0;display:grid;place-items:center;height:100vh;background:#0f1115;color:#e7e9ee}
main{max-width:34rem;padding:2rem;text-align:center}h1{font-size:1.4rem;margin:0 0 .5rem}p{margin:0;color:#a0a6b4}</style></head>
<body><main><h1>${title}</h1><p>${detail}</p></main></body></html>`;
}

/**
 * Listen on 127.0.0.1 for the redirect, and resolve with the code.
 *
 * Binds to port 0 so the operating system picks a free port -- a fixed port is
 * a port something else may already hold, and a login that fails because a
 * previous run left a socket open is a bad first five minutes.
 *
 * Loopback only. Binding 0.0.0.0 would put the callback on the network, where
 * anything on the same wifi could post a code to it.
 */
/**
 * Start the loopback server that receives the redirect.
 *
 * Resolves as soon as it is listening, with the port -- because the port has to
 * go into the redirect URI, which has to be registered *before* the browser is
 * opened. An earlier version resolved only when the code arrived and smuggled
 * the port out through a property on the function, which worked and was a lie
 * about the shape of the thing.
 *
 * Binds to port 0 so the operating system picks a free one: a fixed port is a
 * port something else may already hold, and a login that fails because a
 * previous run left a socket open is a bad first five minutes.
 *
 * Loopback only. Binding 0.0.0.0 would put the callback on the network, where
 * anything on the same wifi could post an authorization code to it.
 */
function startCallbackServer({ expectedState, timeoutMs = 600000 } = {}) {
  if (!expectedState) throw new TypeError("startCallbackServer needs the state it should expect");

  return new Promise((resolveListening, rejectListening) => {
    let settled = false;
    let resolveCode;
    let rejectCode;
    const code = new Promise((resolve, reject) => { resolveCode = resolve; rejectCode = reject; });

    const server = http.createServer((req, res) => {
      const url = new URL(req.url, "http://127.0.0.1");
      if (url.pathname !== "/oauth/callback") {
        res.writeHead(404, { "content-type": "text/plain" });
        return res.end("Not this address.");
      }

      const finish = (ok, detail, outcome) => {
        res.writeHead(ok ? 200 : 400, { "content-type": "text/html; charset=utf-8" });
        res.end(callbackPage(ok, detail));
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        server.close();
        if (ok) resolveCode(outcome);
        else rejectCode(Object.assign(new Error(detail), { code: "callback_failed" }));
      };

      const error = url.searchParams.get("error");
      if (error) {
        return finish(false, `AWS said: ${url.searchParams.get("error_description") || error}`, null);
      }

      // Compared before the code is looked at, and in constant time. A state
      // that does not match means this redirect was not started here -- so the
      // code came from somewhere else, and redeeming it would be signing in as
      // whoever sent it.
      const state = url.searchParams.get("state") || "";
      const matches = state.length === expectedState.length
        && crypto.timingSafeEqual(Buffer.from(state), Buffer.from(expectedState));
      if (!matches) {
        return finish(false, "This sign-in did not start here, so it was not completed.", null);
      }

      const authorizationCode = url.searchParams.get("code");
      if (!authorizationCode) return finish(false, "AWS did not send an authorization code.", null);

      return finish(true, "You can close this tab and go back to your terminal.", { code: authorizationCode });
    });

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      server.close();
      rejectCode(Object.assign(new Error("Nobody finished signing in within ten minutes."), { code: "timed_out" }));
    }, timeoutMs);
    timer.unref?.();

    server.on("error", rejectListening);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolveListening({
        port,
        redirectUri: `http://127.0.0.1:${port}/oauth/callback`,
        code,
        close() {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          server.close();
          rejectCode(Object.assign(new Error("The sign-in was stopped."), { code: "cancelled" }));
        }
      });
    });

    // Nothing is waiting on `code` until the caller asks for it, and an
    // unhandled rejection would take the process down before it could.
    code.catch(() => {});
  });
}

// Opening a browser, without a dependency and without a shell.
//
// `spawn` with an argument array rather than `exec` with a string: the URL
// contains a query string, and putting that through a shell is how a URL
// becomes a command.
function openBrowser(url, { platform = process.platform, spawnImpl = spawn } = {}) {
  const command = platform === "darwin" ? "open" : platform === "win32" ? "cmd" : "xdg-open";
  const args = platform === "win32" ? ["/c", "start", "", url] : [url];
  try {
    const child = spawnImpl(command, args, { stdio: "ignore", detached: true });
    child.unref?.();
    child.on?.("error", () => {});
    return true;
  } catch {
    // Not being able to open a browser is not a failure. The URL is printed
    // either way, and on a server there is no browser to open.
    return false;
  }
}

// The three OIDC calls. Public endpoints -- no SigV4, no credentials -- which
// is why login works before there are any credentials to sign with.
async function oidcCall(region, path, body, { fetchImpl = fetch } = {}) {
  const response = await fetchImpl(`https://${oidcHost(region)}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  let parsed = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = null; }
  if (!response.ok) {
    const error = new Error(parsed?.error_description || parsed?.error || `IAM Identity Center answered ${response.status}.`);
    error.code = parsed?.error || `http_${response.status}`;
    throw error;
  }
  if (!parsed) throw Object.assign(new Error("IAM Identity Center answered with something that is not JSON."), { code: "unreadable" });
  return parsed;
}

function registerClient({ region, clientName, redirectUri, issuerUrl, scopes = ["sso:account:access"] }, options = {}) {
  return oidcCall(region, "/client/register", {
    clientName,
    clientType: "public",
    grantTypes: ["authorization_code", "refresh_token"],
    redirectUris: [redirectUri],
    scopes,
    ...(issuerUrl ? { issuerUrl } : {})
  }, options);
}

function createToken({ region, clientId, clientSecret, code, verifier, redirectUri }, options = {}) {
  return oidcCall(region, "/token", {
    clientId,
    clientSecret,
    grantType: "authorization_code",
    code,
    codeVerifier: verifier,
    redirectUri
  }, options);
}

// The SSO access token is not an AWS credential. It is exchanged for one, per
// account and per role, at the portal endpoint -- which is a plain bearer-token
// API rather than a signed one.
async function getRoleCredentials({ region, accessToken, accountId, roleName }, { fetchImpl = fetch } = {}) {
  const query = new URLSearchParams({ account_id: accountId, role_name: roleName });
  const response = await fetchImpl(`https://${portalHost(region)}/federation/credentials?${query.toString()}`, {
    method: "GET",
    headers: { "x-amz-sso_bearer_token": accessToken, accept: "application/json" }
  });
  if (!response.ok) {
    throw Object.assign(
      new Error(`The access portal answered ${response.status} for ${roleName} in ${accountId}.`),
      { code: `http_${response.status}` }
    );
  }
  const body = await response.json();
  const role = body?.roleCredentials;
  if (!role?.accessKeyId || !role?.secretAccessKey) {
    throw Object.assign(new Error("The access portal did not return usable credentials."), { code: "unreadable" });
  }
  return {
    accessKeyId: role.accessKeyId,
    secretAccessKey: role.secretAccessKey,
    sessionToken: role.sessionToken || null,
    // milliseconds since the epoch, per the portal API
    expiresAt: role.expiration ? new Date(role.expiration).toISOString() : null
  };
}

module.exports = {
  createPkcePair,
  authorizationUrl,
  startCallbackServer,
  openBrowser,
  registerClient,
  createToken,
  getRoleCredentials,
  callbackPage,
  oidcHost,
  portalHost
};

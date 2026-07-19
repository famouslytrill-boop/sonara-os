const baseUrl = (process.env.BASE_URL || "https://sonaraindustries.com").replace(/\/$/, "");
const expectedCommitSha = String(process.env.EXPECTED_COMMIT_SHA || "").trim();
const waitForDeploymentSeconds = Number.parseInt(process.env.WAIT_FOR_DEPLOYMENT_SECONDS || "0", 10) || 0;
const requestTimeoutMs = Number.parseInt(process.env.REQUEST_TIMEOUT_MS || "15000", 10) || 15000;
const retryIntervalMs = 10000;
const failures = [];
let checks = 0;

const secretPattern = /SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|RESEND_API_KEY|ADMIN_PASSWORD_HASH|sk_(?:live|test)_|whsec_/i;

function assertCheck(condition, message) {
  if (condition) {
    checks += 1;
    return;
  }
  failures.push(message);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPath(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  const headers = {
    "User-Agent": "SONARA-production-smoke/2.0",
    Accept: options.accept || "*/*",
    ...(options.headers || {})
  };

  try {
    return await fetch(`${baseUrl}${path}`, {
      method: options.method || "GET",
      redirect: options.redirect || "manual",
      headers,
      body: options.body,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function responseText(response) {
  try {
    return await response.text();
  } catch (error) {
    failures.push(`Unable to read ${response.url || "response"}: ${error instanceof Error ? error.message : "unknown error"}`);
    return "";
  }
}

function parseJson(text, path) {
  try {
    return JSON.parse(text);
  } catch {
    failures.push(`${path}: expected valid JSON`);
    return null;
  }
}

async function waitForExpectedDeployment() {
  if (!expectedCommitSha) return;

  const deadline = Date.now() + Math.max(waitForDeploymentSeconds, 1) * 1000;
  let lastObserved = "unavailable";

  while (Date.now() <= deadline) {
    try {
      const response = await fetchPath("/api/health", { accept: "application/json" });
      const text = await responseText(response);
      const payload = response.status === 200 ? parseJson(text, "/api/health") : null;
      lastObserved = payload?.deployment?.commitSha || `HTTP ${response.status}`;
      if (payload?.deployment?.commitSha === expectedCommitSha) {
        console.log(`Deployment ready: ${expectedCommitSha}`);
        checks += 1;
        return;
      }
    } catch (error) {
      lastObserved = error instanceof Error ? error.message : "request failed";
    }

    await delay(retryIntervalMs);
  }

  failures.push(`Deployment did not reach expected SHA ${expectedCommitSha}; last observed ${lastObserved}`);
}

async function checkHtmlPage(path, requiredText = "SONARA Industries") {
  try {
    const response = await fetchPath(path, { accept: "text/html" });
    const text = await responseText(response);
    const contentType = response.headers.get("content-type") || "";

    assertCheck(response.status === 200, `${path}: expected HTTP 200, received ${response.status}`);
    assertCheck(contentType.includes("text/html"), `${path}: expected HTML content type, received ${contentType || "missing"}`);
    assertCheck(text.includes("<main"), `${path}: rendered page is missing the main content region`);
    assertCheck(text.includes(requiredText), `${path}: rendered page is missing ${requiredText}`);
    assertCheck(!text.includes("[To be added]"), `${path}: placeholder copy is still present`);
    assertCheck(!/href=["']#["']/i.test(text), `${path}: contains a non-functional href=# link`);
    assertCheck(!secretPattern.test(text), `${path}: response appears to expose a secret name or provider key pattern`);
    console.log(`${path}: ${response.status}`);
  } catch (error) {
    failures.push(`${path}: ${error instanceof Error ? error.message : "request failed"}`);
  }
}

async function checkRedirect(path, status, location) {
  try {
    const response = await fetchPath(path, { redirect: "manual" });
    assertCheck(response.status === status, `${path}: expected HTTP ${status}, received ${response.status}`);
    assertCheck(response.headers.get("location") === location, `${path}: expected redirect to ${location}, received ${response.headers.get("location") || "none"}`);
    console.log(`${path}: ${response.status} -> ${response.headers.get("location") || "none"}`);
  } catch (error) {
    failures.push(`${path}: ${error instanceof Error ? error.message : "request failed"}`);
  }
}

async function checkProtectedRoute(path, code) {
  try {
    const response = await fetchPath(path, { accept: "application/json" });
    const text = await responseText(response);
    const payload = parseJson(text, path);
    assertCheck(response.status === 401 || response.status === 403, `${path}: expected fail-closed HTTP 401/403, received ${response.status}`);
    assertCheck(payload?.ok === false, `${path}: expected ok=false`);
    assertCheck(payload?.code === code, `${path}: expected ${code}, received ${payload?.code || "missing code"}`);
    assertCheck(!secretPattern.test(text), `${path}: authorization response appears to expose secret material`);
    console.log(`${path}: ${response.status} ${payload?.code || "unknown"}`);
  } catch (error) {
    failures.push(`${path}: ${error instanceof Error ? error.message : "request failed"}`);
  }
}

async function checkHealth() {
  const path = "/api/health";
  try {
    const response = await fetchPath(path, { accept: "application/json" });
    const text = await responseText(response);
    const payload = parseJson(text, path);
    assertCheck(response.status === 200, `${path}: expected HTTP 200, received ${response.status}`);
    assertCheck(payload?.ok === true, `${path}: expected ok=true`);
    assertCheck(payload?.app === "sonara-industries", `${path}: unexpected app identifier`);
    assertCheck(payload?.runtime === "express", `${path}: unexpected runtime`);
    assertCheck(payload?.deployment?.branch === "main", `${path}: expected main branch deployment`);
    assertCheck(payload?.deployment?.environment === "production", `${path}: expected production environment`);
    assertCheck(Boolean(payload?.deployment?.commitSha), `${path}: missing deployment commit SHA`);
    assertCheck(!secretPattern.test(text), `${path}: health response exposes secret material`);
    assertCheck(Boolean(response.headers.get("strict-transport-security")), `${path}: missing HSTS header`);
    console.log(`${path}: ${response.status} ${payload?.deployment?.commitSha || "unknown SHA"}`);
  } catch (error) {
    failures.push(`${path}: ${error instanceof Error ? error.message : "request failed"}`);
  }
}

async function checkReadiness() {
  const path = "/api/readiness";
  try {
    const response = await fetchPath(path, { accept: "application/json" });
    const text = await responseText(response);
    const payload = parseJson(text, path);
    const requiredStates = {
      supabase: "configured",
      stripe: "configured",
      stripeWebhook: "configured",
      resend: "configured",
      adminProtection: "configured",
      checkout: "enabled",
      emailDelivery: "enabled",
      accountDatabase: "configured",
      paymentConnection: "configured",
      paymentUpdates: "configured",
      founderAccess: "configured"
    };

    assertCheck(response.status === 200, `${path}: expected HTTP 200, received ${response.status}`);
    assertCheck(payload?.ok === true, `${path}: expected ok=true`);
    for (const [service, expected] of Object.entries(requiredStates)) {
      assertCheck(payload?.services?.[service] === expected, `${path}: expected ${service}=${expected}, received ${payload?.services?.[service] || "missing"}`);
    }
    assertCheck(payload?.services?.googleOAuth === "deferred", `${path}: Google OAuth should remain explicitly deferred until configured`);
    assertCheck(payload?.services?.legalPages === "review_required", `${path}: legal review boundary must remain explicit`);

    for (const plan of ["free", "starter_monthly", "core_monthly", "pro_monthly", "business_builder_one_time"]) {
      assertCheck(payload?.checkoutPlans?.[plan]?.checkout === "enabled", `${path}: checkout plan ${plan} is not enabled`);
    }

    for (const service of ["supabase", "stripe", "resend", "adminProtection"]) {
      assertCheck(Array.isArray(payload?.missing?.[service]) && payload.missing[service].length === 0, `${path}: ${service} reports missing configuration`);
      assertCheck(Array.isArray(payload?.invalid?.[service]) && payload.invalid[service].length === 0, `${path}: ${service} reports invalid configuration`);
    }

    assertCheck(!secretPattern.test(text), `${path}: readiness response exposes secret material`);
    console.log(`${path}: ${response.status} providers configured`);
  } catch (error) {
    failures.push(`${path}: ${error instanceof Error ? error.message : "request failed"}`);
  }
}

async function checkSupportStatus() {
  const path = "/api/support/status";
  try {
    const response = await fetchPath(path, { accept: "application/json" });
    const text = await responseText(response);
    const payload = parseJson(text, path);
    assertCheck(response.status === 200, `${path}: expected HTTP 200, received ${response.status}`);
    assertCheck(payload?.ok === true, `${path}: expected ok=true`);
    assertCheck(payload?.supportQueue === "database_backed", `${path}: support queue is not database-backed`);
    assertCheck(payload?.emailDelivery === "enabled", `${path}: email delivery is not enabled`);
    assertCheck(payload?.secretsExposed === false, `${path}: secretsExposed must remain false`);
    assertCheck(!secretPattern.test(text), `${path}: response exposes secret material`);
    console.log(`${path}: ${response.status} database-backed`);
  } catch (error) {
    failures.push(`${path}: ${error instanceof Error ? error.message : "request failed"}`);
  }
}

async function checkManifestAndAssets() {
  const path = "/site.webmanifest";
  try {
    const response = await fetchPath(path, { accept: "application/manifest+json" });
    const text = await responseText(response);
    const manifest = parseJson(text, path);
    assertCheck(response.status === 200, `${path}: expected HTTP 200, received ${response.status}`);
    assertCheck(manifest?.name === "SONARA Industries", `${path}: unexpected app name`);
    assertCheck(manifest?.id === "/", `${path}: expected id=/`);
    assertCheck(manifest?.start_url === "/", `${path}: expected start_url=/`);
    assertCheck(manifest?.scope === "/", `${path}: expected scope=/`);
    assertCheck(manifest?.display === "standalone", `${path}: expected standalone display`);
    assertCheck(Array.isArray(manifest?.icons) && manifest.icons.length >= 3, `${path}: expected at least three install icons`);

    for (const icon of manifest?.icons || []) {
      const iconResponse = await fetchPath(icon.src);
      assertCheck(iconResponse.status === 200, `${icon.src}: install icon returned HTTP ${iconResponse.status}`);
      assertCheck((iconResponse.headers.get("content-type") || "").startsWith("image/"), `${icon.src}: expected image content type`);
    }

    const shortcutRoutes = new Set((manifest?.shortcuts || []).map((shortcut) => shortcut.url));
    for (const route of ["/business-builder", "/creator-studio", "/growth-studio"]) {
      assertCheck(shortcutRoutes.has(route), `${path}: missing ${route} shortcut`);
    }
    console.log(`${path}: ${response.status} ${manifest?.icons?.length || 0} icons`);
  } catch (error) {
    failures.push(`${path}: ${error instanceof Error ? error.message : "request failed"}`);
  }

  await checkRedirect("/manifest.webmanifest", 308, "/site.webmanifest");

  const assets = [
    ["/sw.js", "javascript"],
    ["/sonara-brand-system.css", "css"],
    ["/sonara-friendly-premium.css", "css"],
    ["/sonara-interface-engine.css", "css"],
    ["/sonara-launch-ui.css", "css"],
    ["/sonara-cohesive-2027.css", "css"],
    ["/sonara-cohesive-2027-base.css", "css"],
    ["/sonara-experience.js", "javascript"],
    ["/sonara-interface-engine.js", "javascript"],
    ["/sonara-cohesive-2027.js", "javascript"],
    ["/brand/sonara-industries-mark.svg", "image/svg+xml"]
  ];

  for (const [assetPath, typeFragment] of assets) {
    try {
      const response = await fetchPath(assetPath);
      const text = await responseText(response);
      assertCheck(response.status === 200, `${assetPath}: expected HTTP 200, received ${response.status}`);
      assertCheck((response.headers.get("content-type") || "").includes(typeFragment), `${assetPath}: unexpected content type ${response.headers.get("content-type") || "missing"}`);
      assertCheck(text.length > 20, `${assetPath}: asset response is unexpectedly empty`);
      assertCheck(!secretPattern.test(text), `${assetPath}: asset exposes secret material`);
      if (assetPath === "/sw.js") {
        assertCheck(text.includes("PUBLIC_NAVIGATION_PATHS"), `${assetPath}: public navigation boundary is missing`);
        assertCheck(text.includes('cache: "no-store"'), `${assetPath}: private navigation no-store boundary is missing`);
      }
      console.log(`${assetPath}: ${response.status}`);
    } catch (error) {
      failures.push(`${assetPath}: ${error instanceof Error ? error.message : "request failed"}`);
    }
  }
}

async function checkSafeNegativePosts() {
  const cases = [
    {
      path: "/contact",
      body: {},
      statuses: [400],
      code: "validation_failed"
    },
    {
      path: "/account/setup/organization",
      body: { name: "Production smoke probe" },
      statuses: [401, 403],
      code: "customer_auth_required"
    },
    {
      path: "/api/checkout/session",
      body: { plan: "starter_monthly" },
      statuses: [401, 403],
      code: "customer_auth_required"
    }
  ];

  for (const testCase of cases) {
    try {
      const response = await fetchPath(testCase.path, {
        method: "POST",
        accept: "application/json",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testCase.body)
      });
      const text = await responseText(response);
      const payload = parseJson(text, testCase.path);
      assertCheck(testCase.statuses.includes(response.status), `${testCase.path}: expected HTTP ${testCase.statuses.join("/")}, received ${response.status}`);
      assertCheck(payload?.ok === false, `${testCase.path}: expected ok=false`);
      assertCheck(payload?.code === testCase.code, `${testCase.path}: expected ${testCase.code}, received ${payload?.code || "missing code"}`);
      assertCheck(!payload?.url && !payload?.sessionId, `${testCase.path}: negative probe unexpectedly created a provider session`);
      assertCheck(!secretPattern.test(text), `${testCase.path}: negative response exposes secret material`);
      console.log(`${testCase.path}: ${response.status} ${payload?.code || "unknown"}`);
    } catch (error) {
      failures.push(`${testCase.path}: ${error instanceof Error ? error.message : "request failed"}`);
    }
  }
}

async function main() {
  await waitForExpectedDeployment();
  await checkHealth();
  await checkReadiness();
  await checkSupportStatus();

  const publicPages = [
    "/",
    "/login",
    "/signup",
    "/contact",
    "/support",
    "/help",
    "/docs",
    "/free-tools",
    "/service-catalog",
    "/pricing",
    "/security",
    "/business-builder",
    "/creator-studio",
    "/growth-studio",
    "/legal/privacy",
    "/legal/terms",
    "/offline"
  ];

  for (const path of publicPages) await checkHtmlPage(path, path === "/offline" ? "Offline" : "SONARA Industries");

  for (const [path, status, location] of [
    ["/onboarding", 303, "/account/setup"],
    ["/feedback", 303, "/contact?topic=feedback"],
    ["/trust", 303, "/security"],
    ["/research-lab", 303, "/ecosystem"]
  ]) {
    await checkRedirect(path, status, location);
  }

  for (const path of [
    "/dashboard",
    "/requests",
    "/deliverables",
    "/billing",
    "/business-builder/dashboard",
    "/creator-studio/dashboard",
    "/growth-studio/dashboard"
  ]) {
    await checkProtectedRoute(path, "customer_auth_required");
  }

  for (const path of ["/admin", "/admin/database", "/api/admin/database-readiness"]) {
    await checkProtectedRoute(path, "admin_auth_required");
  }

  await checkManifestAndAssets();
  await checkSafeNegativePosts();

  if (failures.length) {
    console.error(`\nProduction connectivity smoke failed with ${failures.length} issue(s):`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log(`\nProduction connectivity smoke passed for ${baseUrl}: ${checks} assertions.`);
}

await main();

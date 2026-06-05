const baseUrl = (process.env.BASE_URL || "https://sonaraindustries.com").replace(/\/$/, "");

const routes = [
  "/",
  "/login",
  "/onboarding",
  "/contact",
  "/support",
  "/help",
  "/feedback",
  "/pricing",
  "/trust",
  "/business-builder",
  "/creator-studio",
  "/growth-studio",
  "/research-lab",
  "/legal/privacy",
  "/legal/terms",
];

const allowedRedirects = new Set(["/login", "/onboarding"]);
const failures = [];

for (const route of routes) {
  const url = `${baseUrl}${route}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      headers: {
        "User-Agent": "SONARA-live-smoke/1.0",
      },
    });

    const status = response.status;
    const redirected = status >= 300 && status < 400;
    const ok = status >= 200 && status < 300;
    const allowed = ok || (redirected && allowedRedirects.has(route));

    console.log(`${route}: ${status}${redirected ? ` -> ${response.headers.get("location") ?? "redirect"}` : ""}`);

    if (!allowed) {
      failures.push(`${route}: unexpected HTTP ${status}`);
    }
  } catch (error) {
    failures.push(`${route}: ${error instanceof Error ? error.message : "request failed"}`);
  }
}

if (failures.length) {
  console.error("Live route smoke failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Live route smoke passed for ${baseUrl}.`);

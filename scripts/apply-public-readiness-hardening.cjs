const fs = require("node:fs");

const serverPath = "server.js";
const source = fs.readFileSync(serverPath, "utf8");
const before = 'app.get("/api/readiness", (req, res) => res.status(200).json(getReadiness()));';
const after = `app.get("/api/readiness", (req, res) => {
  const readiness = getReadiness();
  const serviceValues = Object.values(readiness.services || {});
  const degraded = serviceValues.some((value) => ["missing", "invalid", "setup_required"].includes(String(value)));

  return res.status(200).json({
    ok: !degraded,
    status: degraded ? "degraded" : "operational",
    services: {
      accountDatabase: readiness.services.accountDatabase,
      checkout: readiness.services.checkout,
      paymentUpdates: readiness.services.paymentUpdates,
      emailDelivery: "verification_required",
      founderAccess: readiness.services.founderAccess
    }
  });
});`;

if (!source.includes(before)) {
  throw new Error("Expected public readiness route was not found; refusing to modify server.js.");
}

const updated = source.replace(before, after);
const forbidden = [
  "checkoutPlans",
  "missing:",
  "invalid:",
  "GOOGLE_REDIRECT_URI",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "SUPABASE_SERVICE_ROLE_KEY",
  "RESEND_API_KEY"
];

const routeStart = updated.indexOf('app.get("/api/readiness"');
const routeEnd = updated.indexOf("\n\n", routeStart);
const routeBody = updated.slice(routeStart, routeEnd);
for (const token of forbidden) {
  if (routeBody.includes(token)) throw new Error(`Public readiness route still exposes forbidden token: ${token}`);
}

fs.writeFileSync(serverPath, updated);
console.log("Public readiness route hardened successfully.");

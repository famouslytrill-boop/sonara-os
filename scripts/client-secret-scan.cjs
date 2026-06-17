const fs = require("node:fs");
const path = require("node:path");

const roots = ["public", "packages"];
const serverOnlyNames = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_DB_URL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "ADMIN_ACCESS_TOKEN",
  "GOOGLE_CLIENT_SECRET"
];

const ignored = new Set(["node_modules", ".next", ".vercel", "dist", "build"]);
const allowedExtensions = new Set([".js", ".jsx", ".ts", ".tsx", ".html", ".css", ".json", ".svg", ".webmanifest"]);

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return ignored.has(entry.name) ? [] : walk(fullPath);
    return allowedExtensions.has(path.extname(entry.name)) ? [fullPath] : [];
  });
}

const violations = [];
for (const file of roots.flatMap(walk)) {
  const text = fs.readFileSync(file, "utf8");
  for (const name of serverOnlyNames) {
    if (text.includes(name)) violations.push(`${file}: ${name}`);
  }
}

if (violations.length) {
  throw new Error(`Server-only secret names found in client/public files:\n${violations.join("\n")}`);
}

console.log("Client secret surface scan passed.");

const fs = require("node:fs");
const path = require("node:path");

const roots = ["public", "packages"];
const serverOnlyNames = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_DB_URL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "ADMIN_PASSWORD_HASH",
  "ADMIN_PASSWORD",
  "ADMIN_ACCESS_TOKEN",
  "GOOGLE_CLIENT_SECRET"
];

// A second thing the browser must never carry: a path to the database.
//
// Every table in this schema has row level security on, and 124 of them have no
// policy at all. That reads like a gap in a security advisor and is the
// opposite: RLS with no policy denies everything to `anon` and `authenticated`,
// the service role bypasses RLS, and every query in this product goes through
// Express holding the service key. Deny-all is therefore the correct state and
// the strongest one available.
//
// It is only correct while the browser has no way to reach PostgREST. Nothing
// checked that. If a client script ever fetched `/rest/v1/...` directly, those
// 124 tables would return nothing and somebody would "fix" it by adding
// permissive policies -- opening every one of them to any signed-in user of any
// organization, to make a page work.
//
// So the trap is closed from this end. A browser file naming a PostgREST path
// or a Supabase host fails here, which keeps the answer to "why are there no
// policies?" a matter of architecture rather than of memory.
const clientDatabasePatterns = [
  { pattern: /\/rest\/v1\//, what: "a PostgREST path" },
  { pattern: /[a-z0-9-]+\.supabase\.co/i, what: "a Supabase host" },
  { pattern: /createClient\s*\(/, what: "a Supabase client constructor" }
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
const databaseReaches = [];
let scanned = 0;

for (const file of roots.flatMap(walk)) {
  const text = fs.readFileSync(file, "utf8");
  scanned += 1;
  for (const name of serverOnlyNames) {
    if (text.includes(name)) violations.push(`${file}: ${name}`);
  }
  for (const { pattern, what } of clientDatabasePatterns) {
    if (pattern.test(text)) databaseReaches.push(`${file}: names ${what}`);
  }
}

if (!scanned) {
  // Zero files scanned is not a clean tree. It is a walk that stopped matching,
  // and it would report both checks below as passing having read nothing.
  throw new Error("Client secret surface scan read no files; the walk has gone blind.");
}

if (violations.length) {
  throw new Error(`Server-only secret names found in client/public files:\n${violations.join("\n")}`);
}

if (databaseReaches.length) {
  throw new Error(
    `Client files reach the database directly:\n${databaseReaches.join("\n")}\n\n` +
      "Every query in this product goes through Express with the service key, which is what makes row level\n" +
      "security with no policies the correct state for 124 tables rather than a gap. A browser that can reach\n" +
      "PostgREST gets nothing from those tables, and the next step somebody takes is adding permissive policies\n" +
      "to make the page work -- which opens them to any signed-in user of any organization."
  );
}

console.log(`Client secret surface scan passed: ${scanned} client files carry no server-only secret and no route to the database.`);

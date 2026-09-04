"use strict";

// `routes/free-launch-stack-routes.cjs` is a complete page that nobody can reach.
//
// It registers `GET /free-launch-stack`, it is 34 lines of finished markup, and
// requesting that path from the real Express app returns **404**. It has never
// been mounted in `server.js` on this branch's history, no test names it, and no
// document or registry claims it works.
//
// So nothing here is lying about it -- and that is the whole problem. Nothing
// would have noticed. What exists instead is
// `scripts/wire-free-launch-stack-local.cjs`, a script that string-replaces
// `server.js` to add the mount: a manual wiring step somebody wrote down and
// nobody ran.
//
// This is the general form of shape 8 in `.claude/skills/checks-that-cannot-lie`
// -- registering something with a system that is not the one in use produces no
// error and no effect. There it was a test file registering with a runner that
// never runs. Here it is a router the application never mounts. Same silence.
//
// ## What this asks
//
// Every module under `routes/` is either reachable from `server.js` -- directly
// or through another module that is itself reachable, which is how
// `sonara-shared-result-routes` and `sonara-sub-app-routes` are mounted -- or it
// is recorded below with a reason.
//
// The register is two-sided, and the reason is **verified rather than trusted**:
// a recorded module whose paths start answering is an expired reason and fails,
// exactly as a module that becomes unreachable without an entry fails. So being
// listed here cannot be what makes a module look accounted for.
//
// ## Why this does not simply mount it
//
// Mounting adds a public page to a product whose public surface is a decision
// the owner makes, not a decision a passing check makes. `AGENTS.md` is explicit
// about what public screens have to be. The honest move is to make the choice
// visible rather than to take it.
//
// Broken and confirmed red before committing: an orphan removed from the
// register; a register entry pointed at a module that *is* mounted; and the
// module list emptied.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const request = require("supertest");

const root = path.join(__dirname, "..");
const app = require("../server.js");

// A route module the application deliberately does not mount, and why.
const NOT_MOUNTED = new Map([
  [
    "free-launch-stack-routes.cjs",
    "A free-tools directory page. Never mounted on this branch's history, no test names it, " +
      "and nothing claims it works. Mounting it publishes a public page, which is the owner's " +
      "call; scripts/wire-free-launch-stack-local.cjs patches server.js to do it."
  ]
]);

/** `require("./routes/x.cjs")` and `require("./x.cjs")`, from one file's source. */
function requiredModules(file) {
  const source = fs.readFileSync(file, "utf8");
  return [...source.matchAll(/require\("\.\.?\/(?:routes\/)?([a-z0-9._-]+)\.cjs"\)/gi)].map((m) => `${m[1]}.cjs`);
}

/** Every GET path a module registers, read from its source. */
function declaredPaths(module) {
  const source = fs.readFileSync(path.join(root, "routes", module), "utf8");
  return [...source.matchAll(/app\.get\("(\/[^":]*)"/g)].map((m) => m[1]);
}

const modules = fs.readdirSync(path.join(root, "routes")).filter((file) => file.endsWith(".cjs"));

// Transitive closure from server.js. A module mounted by another module is
// mounted -- two of the three that server.js does not name are reached that way,
// and a check that missed them would report two false orphans and get deleted.
const reachable = new Set();
const queue = requiredModules(path.join(root, "server.js")).filter((m) => modules.includes(m));
while (queue.length) {
  const module = queue.shift();
  if (reachable.has(module)) continue;
  reachable.add(module);
  for (const dependency of requiredModules(path.join(root, "routes", module))) {
    if (modules.includes(dependency)) queue.push(dependency);
  }
}

describe("a route module nobody mounts serves nobody", () => {
  it("found the route modules, so this is not passing on an empty directory", () => {
    assert.ok(modules.length >= 30, `only ${modules.length} route modules found; this check has gone blind`);
    assert.ok(reachable.size >= 30, `only ${reachable.size} reachable; the require graph did not resolve`);
  });

  it("every module the application does not reach is one we decided not to mount", () => {
    const orphans = modules.filter((module) => !reachable.has(module));
    const unaccounted = orphans.filter((module) => !NOT_MOUNTED.has(module));
    assert.deepEqual(
      unaccounted,
      [],
      `${unaccounted.join(", ")} register routes that server.js never mounts, directly or through another ` +
        "module. Mount them, delete them, or record them in NOT_MOUNTED with the reason."
    );
  });

  it("every module recorded as not mounted is still not mounted", () => {
    const expired = [...NOT_MOUNTED.keys()].filter(
      (module) => !modules.includes(module) || reachable.has(module)
    );
    assert.deepEqual(
      expired,
      [],
      `${expired.join(", ")} is recorded as deliberately unmounted but is now reachable, or has been deleted. ` +
        "Drop the entry -- a reason that no longer describes anything is what the next person reads instead of checking."
    );
  });

  it("asks the running application rather than trusting the require graph", async () => {
    // The register's reason is only as good as the behaviour it claims. A module
    // reached by some path this graph does not model would answer 200 here, and
    // that must fail rather than sit in the list looking accounted for.
    for (const [module, reason] of NOT_MOUNTED) {
      const paths = declaredPaths(module);
      assert.ok(paths.length > 0, `${module} is recorded as unmounted but registers no GET path to check`);
      for (const route of paths) {
        const response = await request(app).get(route);
        assert.equal(
          response.status,
          404,
          `${route} answers ${response.status}, so ${module} IS mounted -- the recorded reason (${reason}) is wrong`
        );
      }
    }
  });
});

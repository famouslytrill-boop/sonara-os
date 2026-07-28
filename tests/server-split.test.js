"use strict";

// Guard rails for splitting server.js, so the split can run in the background
// without ever being the reason a release is held.
//
// server.js was 5,119 lines and 44 scripts/apply-*.cjs mutate it in place. That
// combination is what makes the split risky: 765 distinct strings in the file
// are replacement targets or anchors for those generators, and moving one
// breaks the build in a way that surfaces only when apply:runtime next runs --
// which, before the codegen freeze, was during a production build.
//
// So the rule is: extract only what no generator anchors on, and prove it each
// time rather than remembering it.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const serverSource = fs.readFileSync(path.join(root, "server.js"), "utf8");

function generatorSources() {
  return fs
    .readdirSync(path.join(root, "scripts"))
    .filter((name) => name.startsWith("apply-") && name.endsWith(".cjs"))
    .map((name) => ({ name, source: fs.readFileSync(path.join(root, "scripts", name), "utf8") }));
}

// Modules lifted out of server.js so far. Each entry names what moved and the
// functions it now owns.
const EXTRACTED = [
  {
    module: "lib/sonara-product-pages.cjs",
    functions: [
      "getProductPageDefinitions",
      "productLandingActions",
      "productDashboardActions",
      "productLaunchReadinessActions"
    ]
  },
  {
    module: "lib/sonara-readiness.cjs",
    functions: [
      "getReadiness",
      "getAdminEnvReadiness",
      "buildDatabaseReadinessResult",
      "getSupabaseReadinessStatus",
      "getStripeSecretStatus",
      "getStripeWebhookStatus",
      "getCheckoutPlanStatuses",
      "getInvalidStripeEnvStatuses",
      "combineEnvStatuses",
      "missingEnvGroups",
      "databaseGroupForTable"
    ]
  },
  {
    module: "lib/sonara-shell.cjs",
    functions: [
      "escapeHtml",
      "displayStatus",
      "formatLabel",
      "adminReadinessText",
      "brandCard",
      "actionCard",
      "checklistCard",
      "accessCard",
      "linkAction",
      "logoutAction",
      "contactForm",
      "authForm"
    ]
  }
];

describe("the server.js split stays safe", () => {
  // What this test can and cannot do, stated plainly.
  //
  // The authoritative check that an extraction has not broken code generation
  // is empirical: run `pnpm run apply:runtime` twice and confirm the tree is
  // unchanged. verify:generated does exactly that in CI, and it is what caught
  // the one real breakage in this split -- apply-growth-studio-public-positioning.cjs
  // anchors on `linkAction("/growth-studio/dashboard", "Open dashboard")`, a
  // line *inside* productLandingActions rather than the function name, so no
  // amount of name matching would have seen it coming.
  //
  // I tried to catch that statically by scanning generators for any long quoted
  // string that had moved. It flagged six more cases, every one of them false:
  // route paths like "/growth-studio/experiments" that those generators write
  // into routes/ and lib/sonara-route-registry.cjs, and never anchored on in
  // server.js at all. A check with that false-positive rate gets muted, and
  // then it catches nothing.
  //
  // So this is deliberately the narrow, reliable version: a generator that
  // names an extracted function must also open the module it moved to. It is an
  // early warning for the obvious case, not a substitute for apply:runtime.
  it("leaves no generator naming a function server.js can no longer resolve", () => {
    // Refined once more, in step 2. A generator referencing an extracted
    // function is fine when it only *calls* it and the call site stays in
    // server.js -- getReadiness() is still a binding there, brought back in by
    // the destructured require, so apply-advanced-builder-ui.cjs and two others
    // that emit `renderAdvancedBuilderHomepage(getReadiness())` keep working.
    //
    // The violation is narrower than "the generator mentions it": the name has
    // to be unresolvable in server.js *and* the generator has to not open the
    // module it moved to.
    const generators = generatorSources();
    const violations = [];

    for (const extraction of EXTRACTED) {
      const moduleFile = path.basename(extraction.module);
      for (const generator of generators) {
        if (generator.source.includes(moduleFile)) continue;
        for (const fn of extraction.functions) {
          if (!generator.source.includes(fn)) continue;
          // Still reachable where the generator looks?
          const boundInServer = new RegExp(`^\\s*${fn},?\\s*$`, "m").test(serverSource);
          if (boundInServer) continue;
          violations.push(`scripts/${generator.name} references ${fn}, which server.js can no longer resolve`);
        }
      }
    }

    assert.deepEqual(
      violations,
      [],
      `These generators reference code that has moved:\n  ${violations.join("\n  ")}\n\n` +
        "Either leave it in server.js, or point the generator at the module it moved to."
    );
  });

  it("left no orphan definition behind in server.js", () => {
    // Two definitions of the same function is what happened when
    // apply-catalog-helper-scope.cjs reinserted a helper that had been edited
    // in place: the file parsed, the tests passed, and the later definition
    // silently won.
    for (const extraction of EXTRACTED) {
      for (const fn of extraction.functions) {
        const declarations = (serverSource.match(new RegExp(`^function ${fn}\\(`, "gm")) || []).length;
        assert.equal(
          declarations,
          0,
          `${fn} was extracted to ${extraction.module} but server.js still declares it`
        );
      }
    }
  });

  it("exports everything it was asked to own", () => {
    for (const extraction of EXTRACTED) {
      const source = fs.readFileSync(path.join(root, extraction.module), "utf8");
      for (const fn of extraction.functions) {
        assert.match(source, new RegExp(`\\b${fn}\\b`), `${extraction.module} must define ${fn}`);
      }
    }
  });

  it("keeps server.js shrinking rather than growing", () => {
    // A ratchet, not a target. 4,674 lines after the shell helpers moved, down
    // from 5,119. If a change adds to server.js instead of a module, this asks
    // whether that was deliberate.
    const lines = serverSource.split("\n").length;
    assert.ok(
      lines <= 4690,
      `server.js is ${lines} lines. The split is meant to reduce it; if this grew on purpose, raise the ceiling in this test and say why.`
    );
  });
});

describe("the readiness module stands on its own", () => {
  const { createReadiness } = require("../lib/sonara-readiness.cjs");

  const deps = {
    getEnv: () => undefined,
    isPlaceholderValue: () => false,
    isEmailLike: () => true,
    isPlaceholderEmail: () => false,
    splitList: (value) => String(value || "").split(",").filter(Boolean),
    STRIPE_PLANS: { free: { name: "Free" } }
  };

  it("refuses to build without the helpers it needs", () => {
    // A missing helper would make every status read "missing", which looks
    // exactly like a genuinely unconfigured environment -- the failure would
    // be invisible on the readiness screen.
    assert.throws(() => createReadiness({}), TypeError);
    for (const missing of ["getEnv", "isPlaceholderValue", "splitList"]) {
      const partial = { ...deps };
      delete partial[missing];
      assert.throws(() => createReadiness(partial), TypeError, `omitting ${missing} must throw`);
    }
    assert.throws(() => createReadiness({ ...deps, STRIPE_PLANS: undefined }), TypeError);
  });

  it("reports every service as unconfigured when the environment is empty", () => {
    const readiness = createReadiness(deps).getReadiness();
    assert.ok(readiness.services, "readiness must report services");
    assert.ok(Object.keys(readiness.services).length >= 10, "the readiness report looks empty");
    assert.equal(readiness.services.supabase, "missing");
    assert.equal(readiness.services.stripe, "missing");
  });

  it("takes its environment from the injected reader, not from process.env", () => {
    // The whole point of injecting getEnv is that this module never reaches for
    // the ambient environment itself.
    const source = fs.readFileSync(path.join(root, "lib", "sonara-readiness.cjs"), "utf8");
    assert.ok(!/process\.env/.test(source), "lib/sonara-readiness.cjs must not read process.env directly");
  });

  it("owns the database contract rather than having it injected", () => {
    const readiness = createReadiness(deps).buildDatabaseReadinessResult({ tables: [], functions: [], schemas: [] });
    assert.ok(readiness, "the database readiness result must build from the contract it requires");
  });
});

describe("the rendering helpers stand on their own", () => {
  const shell = require("../lib/sonara-shell.cjs");

  it("needs nothing injected", () => {
    // The other two extractions are factories because they read things
    // server.js owns. These twelve read only each other, so a factory would be
    // a binding to get wrong for no benefit.
    const source = fs.readFileSync(path.join(root, "lib", "sonara-shell.cjs"), "utf8");
    assert.ok(!/process\.env/.test(source), "the shell helpers must not read the environment");
    assert.ok(!/require\("\.\/sonara-/.test(source), "the shell helpers must not depend on other lib modules");
  });

  it("escapes what goes into markup", () => {
    // linkAction and brandCard put caller-supplied text straight into HTML.
    // This is the whole reason escapeHtml travels with them.
    assert.equal(shell.escapeHtml(`<script>&"'`), "&lt;script&gt;&amp;&quot;&#39;");
    assert.match(shell.linkAction("/a\"b", "<x>"), /href="\/a&quot;b">&lt;x&gt;</);
    assert.match(shell.brandCard("<b>", "&"), /<h2>&lt;b&gt;<\/h2><p>&amp;<\/p>/);
  });

  it("gives a signup form a different password field id than a login form", () => {
    // Both render on the same page in some flows; duplicate ids would break
    // the show-password toggle and the label association.
    const login = shell.authForm("Log in", "/auth/login");
    const signup = shell.authForm("Create account", "/auth/signup");
    const idOf = (html) => html.match(/id="(password-[a-f0-9]+)"/)[1];
    assert.notEqual(idOf(login), idOf(signup));
    assert.match(signup, /name="confirmPassword"/);
    assert.doesNotMatch(login, /name="confirmPassword"/);
  });

  it("turns internal status keys into something a person can read", () => {
    assert.equal(shell.displayStatus("setup_required"), "Setup required");
    assert.equal(shell.displayStatus("review_required"), "Review required");
    assert.equal(shell.formatLabel("supabase"), "Account database");
    assert.equal(shell.formatLabel("stripeWebhook"), "Payment updates");
    // An unknown key must still read as words, not as camelCase.
    assert.equal(shell.formatLabel("somethingNew"), "Something New");
  });

  it("says something for every access mode, including none", () => {
    assert.match(shell.accessCard({ ownerOverride: true }), /Owner\/Admin access/);
    assert.match(shell.accessCard({ mode: "customer" }), /Free customer access/);
    assert.match(shell.accessCard(undefined), /Login is required/);
  });

  it("leaves the action row out when there are no actions", () => {
    assert.doesNotMatch(shell.actionCard("t", "b"), /card-actions/);
    assert.match(shell.actionCard("t", "b", ["<a></a>"]), /card-actions/);
  });
});

describe("the extracted module stands on its own", () => {
  const { createProductPages } = require("../lib/sonara-product-pages.cjs");

  it("refuses to build without the helpers it needs", () => {
    // linkAction is referenced by 30 generators and has to stay in server.js,
    // so it is injected. Failing loudly beats rendering action bars with
    // undefined in them.
    assert.throws(() => createProductPages({}), TypeError);
    assert.throws(() => createProductPages({ linkAction: () => "" }), TypeError);
  });

  it("builds page definitions for every product workspace", () => {
    const pages = createProductPages({ linkAction: (href, label) => `${href}|${label}`, logoutAction: () => "logout" });
    for (const slug of ["business-builder", "creator-studio", "growth-studio"]) {
      const definitions = pages.getProductPageDefinitions(slug);
      assert.ok(definitions, `${slug} must have page definitions`);
      assert.ok(Array.isArray(definitions.free) && definitions.free.length > 0, `${slug} must have free pages`);
    }
  });

  it("builds action bars through the injected helper rather than its own", () => {
    const pages = createProductPages({ linkAction: (href, label) => `LINK:${href}:${label}`, logoutAction: () => "LOGOUT" });
    const actions = pages.productDashboardActions("business-builder");
    assert.ok(actions.every((action) => /^LINK:|^LOGOUT$/.test(action)), "every action must come from the injected helpers");
    assert.ok(actions.includes("LOGOUT"), "a signed-in workspace bar must offer logout");
  });

  it("has a sensible answer for a product it has never heard of", () => {
    const pages = createProductPages({ linkAction: (href, label) => `${href}|${label}`, logoutAction: () => "logout" });
    assert.doesNotThrow(() => pages.productLandingActions("not-a-product"));
    assert.ok(pages.productLandingActions("not-a-product").length > 0);
  });
});

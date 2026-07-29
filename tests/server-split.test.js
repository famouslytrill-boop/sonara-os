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

// Comments explain why a module does not reach for the ambient environment, and
// saying so means writing the words. The checks below are about code, so strip
// comments before looking.
function codeOnly(source) {
  return String(source)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

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
    module: "lib/sonara-billing.cjs",
    functions: [
      "priceCard",
      "billingPanel",
      "getPriceCardSetupText",
      "getPaidEntitlementKeys",
      "isValidPlan",
      "normalizeCheckoutPlan",
      "createStripeCheckoutSession",
      "getOrCreateStripeCustomer",
      "getCheckoutRedirectUrls",
      "verifyStripeWebhookSignature",
      "recordBillingWebhookEvent",
      "synchronizeBillingFromStripeEvent",
      "synchronizeCheckoutSessionCompleted",
      "getBillingSummary",
      "getBillingPanelSummary"
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
        // `async` matters: most of what lib/sonara-billing.cjs owns is async, and
        // a check anchored on `^function` alone would not see any of it come back.
        const declarations = (serverSource.match(new RegExp(`^(?:async )?function ${fn}\\(`, "gm")) || []).length;
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
    // A ratchet, not a target. 4,462 lines after billing moved, down from
    // 5,119. If a change adds to server.js instead of a module, this asks
    // whether that was deliberate.
    const lines = serverSource.split("\n").length;
    assert.ok(
      lines <= 4480,
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
    const source = codeOnly(fs.readFileSync(path.join(root, "lib", "sonara-readiness.cjs"), "utf8"));
    assert.ok(!/process\.env/.test(source), "lib/sonara-readiness.cjs must not read process.env directly");
  });

  it("owns the database contract rather than having it injected", () => {
    const readiness = createReadiness(deps).buildDatabaseReadinessResult({ tables: [], functions: [], schemas: [] });
    assert.ok(readiness, "the database readiness result must build from the contract it requires");
  });
});

describe("the billing module stands on its own", () => {
  const crypto = require("node:crypto");
  const { createBilling, REQUIRED } = require("../lib/sonara-billing.cjs");

  const STRIPE_PLANS = {
    free: { name: "Free", price: "$0", description: "Free.", mode: undefined },
    core_monthly: { name: "Core", price: "$19/mo", description: "Core.", mode: "subscription" }
  };

  function deps(overrides = {}) {
    return {
      STRIPE_PLANS,
      getEnv: () => "",
      getPublicAppUrl: () => "https://app.example.com",
      getSafeAbsoluteUrl: (value, fallback) => value || fallback,
      getSupabaseServerConfig: () => ({ ok: false }),
      supabaseHeaders: () => ({}),
      safeCountTable: async () => 0,
      formatMetric: (label, value) => `${label}: ${value}`,
      insertActivityEvent: async () => undefined,
      ...overrides
    };
  }

  it("refuses to build without any one of the helpers it needs", () => {
    // A silently missing dependency on the payment path fails as
    // "undefined is not a function" mid-checkout, which is the worst place to
    // discover a wiring mistake.
    assert.throws(() => createBilling({}), TypeError);
    for (const name of REQUIRED) {
      const partial = deps();
      delete partial[name];
      assert.throws(() => createBilling(partial), TypeError, `omitting ${name} must throw`);
    }
  });

  it("accepts a Stripe signature it just computed, and nothing else", () => {
    const billing = createBilling(deps());
    const secret = "whsec_test";
    const body = Buffer.from(JSON.stringify({ id: "evt_1", type: "checkout.session.completed" }));
    const t = "1700000000";
    const sign = (payload) => crypto.createHmac("sha256", secret).update(payload).digest("hex");

    assert.equal(billing.verifyStripeWebhookSignature(body, `t=${t},v1=${sign(`${t}.${body}`)}`, secret).ok, true);
    // Wrong secret, tampered body, and a timestamp not covered by the signature
    // must each be rejected.
    assert.equal(billing.verifyStripeWebhookSignature(body, `t=${t},v1=${sign(`${t}.${body}`)}`, "whsec_other").ok, false);
    assert.equal(billing.verifyStripeWebhookSignature(Buffer.from("{}"), `t=${t},v1=${sign(`${t}.${body}`)}`, secret).ok, false);
    assert.equal(billing.verifyStripeWebhookSignature(body, `t=1,v1=${sign(`${t}.${body}`)}`, secret).ok, false);
  });

  it("rejects a signature header that is missing or malformed", () => {
    const billing = createBilling(deps());
    const body = Buffer.from("{}");
    assert.equal(billing.verifyStripeWebhookSignature(body, "", "s").ok, false);
    assert.equal(billing.verifyStripeWebhookSignature(body, undefined, "s").ok, false);
    assert.equal(billing.verifyStripeWebhookSignature(body, "t=1", "s").ok, false);
    assert.equal(billing.verifyStripeWebhookSignature(body, "v1=abc", "s").ok, false);
    // A short v1 must not throw -- timingSafeEqual raises on a length mismatch,
    // so the length is checked before it is called.
    assert.doesNotThrow(() => billing.verifyStripeWebhookSignature(body, "t=1,v1=ab", "s"));
    assert.equal(billing.verifyStripeWebhookSignature(body, "t=1,v1=ab", "s").ok, false);
    // A body that is not a Buffer means express.raw did not run on this route.
    assert.equal(billing.verifyStripeWebhookSignature("{}", "t=1,v1=abc", "s").ok, false);
  });

  it("resolves the plan a customer asked for, including the old names", () => {
    const billing = createBilling(deps());
    assert.equal(billing.normalizeCheckoutPlan({ plan: "creator_studio_monthly" }), "core_monthly");
    assert.equal(billing.normalizeCheckoutPlan({ price_key: " core_monthly " }), "core_monthly");
    assert.equal(billing.normalizeCheckoutPlan({}), "");
    assert.equal(billing.isValidPlan("core_monthly"), true);
    assert.equal(billing.isValidPlan("not_a_plan"), false);
    // Object.prototype keys are not plans.
    assert.equal(billing.isValidPlan("constructor"), false);
  });

  it("falls back to this deployment's own URLs when none are configured", () => {
    const billing = createBilling(deps());
    assert.deepEqual(billing.getCheckoutRedirectUrls({}), {
      successUrl: "https://app.example.com/account",
      cancelUrl: "https://app.example.com/pricing"
    });
  });

  it("does not offer a checkout button for a plan that cannot be bought", () => {
    const billing = createBilling(deps());
    const readiness = { services: { stripe: "missing", checkout: "setup_required" } };
    const card = billing.priceCard("core_monthly", STRIPE_PLANS.core_monthly, { checkout: "setup_required", reason: "missing" }, readiness);
    assert.match(card, /Not open yet/);
    assert.doesNotMatch(card, /Start checkout/);
    // The free plan has no checkout at all, so it renders as a plain card.
    assert.doesNotMatch(billing.priceCard("free", STRIPE_PLANS.free, {}, readiness), /<form/);
  });

  it("says nothing was charged when the account database is unreachable", () => {
    const billing = createBilling(deps());
    return Promise.all([
      billing.getBillingSummary().then((summary) => assert.match(summary.subscriptions, /Setup required/)),
      billing.getBillingPanelSummary("org-1").then((panel) => {
        assert.match(panel.status, /Setup required/);
        assert.deepEqual(panel.rows, []);
      })
    ]);
  });

  it("ignores a Stripe event it has no rule for rather than recording a purchase", async () => {
    const billing = createBilling(deps());
    const result = await billing.synchronizeBillingFromStripeEvent({ type: "invoice.created", data: { object: {} } });
    assert.deepEqual(result, { ok: true, ignored: true });
  });

  it("will not grant access from a checkout session that was not paid", async () => {
    // The entitlement write is what opens paid tools. It must not happen for a
    // session that is complete but unpaid.
    let wrote = false;
    const billing = createBilling(deps({
      getSupabaseServerConfig: () => ({ ok: true, url: "https://project.supabase.co" }),
      insertActivityEvent: async () => { wrote = true; }
    }));
    const result = await billing.synchronizeCheckoutSessionCompleted({
      data: { object: { id: "cs_1", mode: "payment", payment_status: "unpaid", metadata: { organization_id: "org-1", plan: "core_monthly" } } }
    });
    assert.deepEqual(result, { ok: true, ignored: true });
    assert.equal(wrote, false, "an unpaid session must not record a purchase");
  });

  it("takes its environment from the injected reader, not from process.env", () => {
    const source = codeOnly(fs.readFileSync(path.join(root, "lib", "sonara-billing.cjs"), "utf8"));
    assert.ok(!/process\.env/.test(source), "lib/sonara-billing.cjs must not read process.env directly");
  });
});

describe("the rendering helpers stand on their own", () => {
  const shell = require("../lib/sonara-shell.cjs");

  it("needs nothing injected", () => {
    // The other two extractions are factories because they read things
    // server.js owns. These twelve read only each other, so a factory would be
    // a binding to get wrong for no benefit.
    const source = codeOnly(fs.readFileSync(path.join(root, "lib", "sonara-shell.cjs"), "utf8"));
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

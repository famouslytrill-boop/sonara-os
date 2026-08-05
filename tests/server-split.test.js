"use strict";

// Guard rails for splitting server.js.
//
// For most of this split the danger was code generation: 56 scripts/apply-*.cjs
// mutated server.js in place, anchored on hundreds of strings in it, and moving
// one broke the build at apply:runtime rather than at the diff. Two extractions
// were broken that way -- by generators that never mentioned the function they
// broke, only a line inside its body.
//
// The generators are retired. server.js is ordinary hand-maintained code now, so
// the checks that watched for generator collisions are gone rather than kept as
// assertions over an empty set: a check that cannot fail is worse than no check,
// because it still reports success.
//
// What remains is what still has teeth -- no function may be declared here and
// in a module at once, each module must own what it claims, no binding may
// linger that nothing uses, and the file may not grow.

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
    module: "lib/sonara-customer-auth.cjs",
    functions: [
      "handleEmailAuth",
      "resolveCustomerSession",
      "refreshCustomerSession",
      "verifySupabaseAccessToken",
      "setCustomerSessionCookies",
      "setCustomerSessionCookie",
      "setCustomerRefreshCookie",
      "customerCookieOptions",
      "clearCustomerSessionCookie",
      "clearCustomerRefreshCookie",
      "getCustomerSessionToken",
      "getCustomerRefreshToken",
      "getCookie",
      "createAuthRateLimiter",
      "createEmployeeAuthUser",
      "hashInviteToken",
      "isSupabaseAuthConfigured",
      "getSupabaseAuthConfig",
      "sendEmailAuthResult",
      "rejectCustomerBearerFromAdminLogin",
      "wantsAuthReadinessJson"
    ]
  },
  {
    module: "lib/sonara-module-records.cjs",
    functions: [
      "buildDomainModuleRecord",
      "safeInsertModuleOutput",
      "safeInsertDomainModuleRecord",
      "safeReadOrganizationScopedRecords",
      "normalizeAssetType",
      "normalizeCreatorAssetStatus"
    ]
  },
  {
    module: "lib/sonara-page-frame.cjs",
    functions: [
      "layout",
      "responsePage",
      "renderHomepageContent",
      "renderHead",
      "pageBrandClass",
      "renderInterfaceStatusPanel",
      "adminActions",
      "adminRowsPage",
      "adminLoginForm",
      "adminLogoutAction",
      "adminRoleForm"
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
  it("left no orphan definition behind in server.js", () => {
    // Two definitions of the same function is what happened when
    // apply-catalog-helper-scope.cjs reinserted a helper that had been edited in
    // place: the file parsed, the tests passed, and the later definition
    // silently won. That generator is gone, but a duplicate declaration is still
    // silent -- an extraction that forgets to delete the original leaves both.
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

  it("keeps no dead binding from a module it has already extracted", () => {
    // Each extraction leaves a destructured name in server.js for every function
    // it moved, and most are never called from here again. Thirty-six had
    // accumulated by step 6. They are not free: the first test in this file
    // treats "the name is bound in server.js" as proof a generator can still
    // reach it, so a dead binding quietly vouches for a call site nobody
    // checked.
    //
    // Two used to be exempt: apply-growth-studio-verifier.cjs wrote code into
    // server.js calling DATABASE_FUNCTIONS and DATABASE_SCHEMAS, so the binding
    // kept that generated call resolvable. That generator is retired and the
    // exemption went with it -- nothing writes into this file any more, so a
    // binding nothing uses is simply dead.
    //
    // eslint reports these as warnings, which is why thirty-six of them piled
    // up. This is the same finding with teeth.
    const dead = [];

    for (const extraction of EXTRACTED) {
      for (const fn of extraction.functions) {
        if (!new RegExp(`^\\s*${fn},?\\s*$`, "m").test(serverSource)) continue;
        const uses = (serverSource.match(new RegExp(`\\b${fn}\\b`, "g")) || []).length;
        if (uses > 1) continue;
        dead.push(fn);
      }
    }

    assert.deepEqual(
      dead,
      [],
      `server.js binds these and never uses them, and no generator needs them:\n  ${dead.join("\n  ")}\n\n` +
        "Drop them from the destructured require. A binding that exists only to satisfy a reader is one the split test will mistake for reachability."
    );
  });

  it("keeps server.js shrinking rather than growing", () => {
    // A ratchet, not a target. Down from 5,119 to 3,824 across seven
    // extractions, then up 33 for workspaceRecordCards -- the tool pages now
    // show a customer their own saved records instead of promising that results
    // "appear in your private workspace" and showing nothing, then 10 more for
    // the records pages, which were named after records and listed none, then a
    // few for taking the quoted setup package out of checkout, then 9 for
    // declaring which pages are marketing surfaces -- six `surface: "marketing"`
    // lines and a note on the product overview, which is a marketing screen
    // while the dashboard registered immediately below it is not. That is
    // features, not split drift, which is the question this test exists to ask.
    // If a change adds to server.js instead of a module, this asks whether that
    // was deliberate.
    //
    // Then 5 more for page canonicals: legalPage takes the canonical target and
    // legalAliasPages preserves `source` through its spread, so the eight
    // alias URLs point at the /legal/ page they duplicate instead of competing
    // with it. The metadata itself lives in lib/sonara-page-frame.cjs; what is
    // here is the routing that knows which page is the original.
    // Then 2 more for the plain-language require and the setup-required
    // sentence, which replaced a template that glued two humanised status
    // codes together and rendered "Customer organization is Workspace not
    // ready." to customers. The sentences live in lib/sonara-plain-language.cjs.
    // Then 11 more for the contact rejection path. It used to be a one-line
    // responsePage with a "Try again" link back to an empty form, which threw
    // away up to 4000 characters the customer had just written. It is now the
    // contact page re-rendered with their answers still in it. The form itself
    // lives in lib/sonara-shell.cjs; these lines are the layout call that puts
    // it back on screen with the validator's sentence attached.
    // Then 9 more for loginPage and signupPage. Both pages were built inline in
    // their GET routes, and a refused sign-in has to render the same page again
    // with the email still in it. Two copies of a layout would drift the moment
    // either page was edited, so each is now one function called from both the
    // GET route and the rejection path.
    // Then 7 more in sendValidationFailure, which nine form endpoints share. It
    // printed the request-body keys straight into the sentence, so a customer
    // who left a box blank read "Please complete: productKey, serviceName." The
    // labels live in lib/sonara-plain-language.cjs; these lines are the call
    // and the note about why the JSON body still carries the raw names.
    // Then 55 more for the 404 and offline pages, which were two one-line
    // responsePage calls written from the software's point of view -- "Unknown
    // route", "not registered in SONARA Industries", "System response". Both
    // are now real pages with somewhere to go, and both carry the explanation
    // of what was wrong with the old wording, which is most of the added
    // length. These are the two screens a customer reaches when something has
    // already gone wrong, so they are worth the lines.
    // Then 15 more in renderRateLimitPage, which said "Wait about 1 minute(s)"
    // and offered Home and Get help. Almost everybody who trips a login rate
    // limit has forgotten their password, so the one useful link was the one
    // not offered.
    // Then 10 more to register routes/sonara-open-source-routes.cjs.
    // /research-lab/open-source was linked from two research-lab pages and had
    // no route behind it, so both links 404ed in production. The page itself
    // lives in the route module; these lines are the require and the wiring.
    // Then 12 more to register routes/sonara-subsystem-routes.cjs. Fifty-one
    // tables across five subsystems existed as schema with no code, so the only
    // way to know they were there was to read the migrations. These lines are
    // the require and the wiring; the pages live in the route module.
    // Then 1 more passing requirePaidOrOwnerAccess into the Growth Studio
    // control routes. Four record pages there replaced paid placeholder pages,
    // and without this dep they would have been served by the signed-in-only
    // gate -- turning a plan-gated workspace into a free one as a side effect
    // of building the real page.
    // Then 1 more passing getCustomerPrimaryOrganization into the subsystem
    // routes. Eight of the writable subsystem tables declare organization_id
    // NOT NULL, and taking it from the submitted body would let a row be
    // written into another tenant.
    const lines = serverSource.split("\n").length;
    assert.ok(
      lines <= 4042,
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

describe("the page frame stands on its own", () => {
  const { createPageFrame, REQUIRED } = require("../lib/sonara-page-frame.cjs");

  const deps = { legalPages: () => [], readinessStatusClass: () => "ok", safeListTable: async () => ({ ok: false, rows: [] }) };

  it("refuses to build without the helpers it needs", () => {
    assert.throws(() => createPageFrame({}), TypeError);
    for (const name of REQUIRED) {
      const partial = { ...deps };
      delete partial[name];
      assert.throws(() => createPageFrame(partial), TypeError, `omitting ${name} must throw`);
    }
  });

  it("renders a complete document, not a fragment", () => {
    // layout is what every screen is poured into. A missing doctype or head
    // would put the whole application into quirks mode at once.
    const html = createPageFrame(deps).layout({ title: "T", heading: "H", body: "B", sections: [], actions: [] });
    assert.match(html, /^<!doctype html>/i);
    assert.match(html, /<html[^>]*>[\s\S]*<\/html>\s*$/i);
    assert.match(html, /<head>[\s\S]*<\/head>/i);
    assert.match(html, /<meta name="viewport"/i);
  });

  it("escapes the title and heading it is given", () => {
    // These come from route handlers, and some carry customer-supplied text.
    const html = createPageFrame(deps).layout({ title: '<script>x</script>', heading: '"&<>', body: "", sections: [], actions: [] });
    assert.doesNotMatch(html, /<script>x<\/script>/);
    assert.match(html, /&lt;script&gt;/);
  });

  it("renders an empty page, and insists on being told it is empty", () => {
    // Several screens render with no cards while setup is incomplete, so empty
    // arrays have to work. A *missing* sections array throws instead of
    // defaulting -- that is existing behaviour, kept as-is because this
    // extraction was a relocation. Worth pinning either way: the throw is loud,
    // and a silent default would hide a route that forgot to pass its content.
    const frame = createPageFrame(deps);
    assert.doesNotThrow(() => frame.layout({ title: "T", heading: "H", body: "B", sections: [], actions: [] }));
    assert.throws(() => frame.layout({ title: "T" }), TypeError);
  });

  it("puts the message on the one-message page", () => {
    const html = createPageFrame(deps).responsePage("Checkout unavailable", "Nothing has been charged.", []);
    assert.match(html, /Checkout unavailable/);
    assert.match(html, /Nothing has been charged/);
  });

  it("offers a logout on the founder bar and never a bare admin password field", () => {
    const frame = createPageFrame(deps);
    assert.ok(frame.adminActions().some((action) => /admin\/logout/.test(action)));
    assert.match(frame.adminLoginForm(), /type="password"/);
    assert.match(frame.adminLoginForm(), /autocomplete="current-password"/);
  });
});

describe("the customer auth module stands on its own", () => {
  const auth = require("../lib/sonara-customer-auth.cjs");
  const { createCustomerAuth, REQUIRED } = auth;

  function deps(overrides = {}) {
    const noop = () => undefined;
    return {
      acceptsHtml: () => false,
      createRateLimiter: (options) => options,
      getBearerToken: () => "",
      getEnv: () => "",
      getSupabaseServerClient: noop,
      getSupabaseServerConfig: () => ({ ok: false }),
      isProductionEnvironment: () => false,
      isSupabaseAdminUser: async () => ({ ok: false }),
      renderRateLimitPage: noop,
      reportDegradedRateLimit: noop,
      responsePage: (title) => title,
      ...overrides
    };
  }

  it("refuses to build without any one of the helpers it needs", () => {
    assert.throws(() => createCustomerAuth({}), TypeError);
    for (const name of REQUIRED) {
      const partial = deps();
      delete partial[name];
      assert.throws(() => createCustomerAuth(partial), TypeError, `omitting ${name} must throw`);
    }
  });

  it("keeps the session cookie off limits to scripts, and secure in production", () => {
    // httpOnly is what stops a cross-site script reading the session token, and
    // secure is what stops it crossing the network in the clear. Both are the
    // reason this module exists rather than routes setting cookies themselves.
    const local = createCustomerAuth(deps()).customerCookieOptions();
    assert.equal(local.httpOnly, true);
    assert.equal(local.sameSite, "lax");
    assert.equal(local.path, "/");
    assert.equal(local.secure, false, "a local dev server has no TLS, so secure would break sign-in");

    const production = createCustomerAuth(deps({ isProductionEnvironment: () => true })).customerCookieOptions();
    assert.equal(production.secure, true, "production sessions must not travel over plain http");
    assert.equal(production.httpOnly, true);
  });

  it("never lets a session cookie outlive the ceiling, whatever Supabase reports", () => {
    // The access token's own lifetime is attacker-influenced only in theory, but
    // a cookie that outlives the token it holds is a session that looks valid
    // and is not.
    const cookies = [];
    const res = { cookie: (name, value, options) => cookies.push({ name, value, options }) };
    const session = createCustomerAuth(deps());

    session.setCustomerSessionCookie(res, "token", 999999);
    assert.equal(cookies[0].options.maxAge, auth.CUSTOMER_SESSION_MAX_AGE_SECONDS * 1000);

    session.setCustomerSessionCookie(res, "token", 5);
    assert.equal(cookies[1].options.maxAge, 60 * 1000, "a tiny lifetime is floored, not honoured");

    session.setCustomerSessionCookie(res, "token", "nonsense");
    assert.equal(cookies[2].options.maxAge, auth.CUSTOMER_SESSION_MAX_AGE_SECONDS * 1000);
  });

  it("clears the refresh cookie when a sign-in returns no refresh token", () => {
    // Otherwise a stale refresh token from a previous session survives the new
    // one and can mint access tokens for it.
    const set = [];
    const cleared = [];
    const res = { cookie: (name) => set.push(name), clearCookie: (name) => cleared.push(name) };
    createCustomerAuth(deps()).setCustomerSessionCookies(res, { accessToken: "a", maxAgeSeconds: 60 });
    assert.deepEqual(set, [auth.CUSTOMER_SESSION_COOKIE]);
    assert.deepEqual(cleared, [auth.CUSTOMER_REFRESH_COOKIE]);
  });

  it("clears both cookies on sign-out, not just the session one", () => {
    const cleared = [];
    const res = { clearCookie: (name) => cleared.push(name) };
    createCustomerAuth(deps()).clearCustomerSessionCookie(res);
    assert.deepEqual(cleared.sort(), [auth.CUSTOMER_REFRESH_COOKIE, auth.CUSTOMER_SESSION_COOKIE].sort());
  });

  it("reads one cookie without being confused by the ones around it", () => {
    const session = createCustomerAuth(deps());
    const req = { get: () => `other=1; ${auth.CUSTOMER_SESSION_COOKIE}=wanted; ${auth.CUSTOMER_SESSION_COOKIE}_extra=no` };
    assert.equal(session.getCookie(req, auth.CUSTOMER_SESSION_COOKIE), "wanted");
    assert.equal(session.getCookie(req, "missing"), "");
    assert.equal(session.getCookie({ get: () => "" }, "any"), "");
    // A value containing "=" must survive; base64 and JWTs both do.
    assert.equal(createCustomerAuth(deps()).getCookie({ get: () => "t=a=b=c" }, "t"), "a=b=c");
  });

  it("prefers an explicit bearer token over the cookie", () => {
    const session = createCustomerAuth(deps({ getBearerToken: () => "from-header" }));
    assert.equal(session.getCustomerSessionToken({ get: () => `${auth.CUSTOMER_SESSION_COOKIE}=from-cookie` }), "from-header");
  });

  it("refuses to sign anybody in when Supabase auth is not configured", () => {
    // Failing closed matters here: the alternative is an endpoint that appears
    // to accept credentials and silently does nothing with them.
    const session = createCustomerAuth(deps());
    return session.handleEmailAuth("login", { email: "a@b.co", password: "12345678" }).then((result) => {
      assert.equal(result.status, 503);
      assert.equal(result.body.code, "setup_required");
      assert.equal(result.session, undefined, "no session may be issued without a configured provider");
    });
  });

  it("rejects a weak or malformed credential before it reaches the network", async () => {
    const session = createCustomerAuth(deps({ getEnv: () => "https://project.supabase.co" }));
    for (const body of [
      { email: "not-an-email", password: "12345678" },
      { email: "a@b.co", password: "short" },
      { email: "", password: "" }
    ]) {
      const result = await session.handleEmailAuth("login", body);
      assert.equal(result.status, 400, `${JSON.stringify(body)} must be refused`);
      assert.equal(result.body.code, "validation_failed");
    }
  });

  it("will not create an account when the password confirmation does not match", async () => {
    const session = createCustomerAuth(deps({ getEnv: () => "https://project.supabase.co" }));
    // Both sides must clear the 12-character signup floor, or this stops at
    // validation_failed and never reaches the mismatch check it is testing.
    const result = await session.handleEmailAuth("signup", { email: "a@b.co", password: "123456789012", confirmPassword: "210987654321" });
    assert.equal(result.status, 400);
    assert.equal(result.body.code, "password_mismatch");
  });

  it("takes its environment from the injected readers, not from process.env", () => {
    const source = codeOnly(fs.readFileSync(path.join(root, "lib", "sonara-customer-auth.cjs"), "utf8"));
    assert.ok(!/process\.env/.test(source), "lib/sonara-customer-auth.cjs must not read process.env directly");
  });
});

describe("the module records module stands on its own", () => {
  const { createModuleRecords, REQUIRED } = require("../lib/sonara-module-records.cjs");

  const deps = { getSupabaseAdminClient: () => ({ ok: false }), supabaseHeaders: () => ({}) };

  it("refuses to build without the helpers it needs", () => {
    assert.throws(() => createModuleRecords({}), TypeError);
    for (const name of REQUIRED) {
      const partial = { ...deps };
      delete partial[name];
      assert.throws(() => createModuleRecords(partial), TypeError, `omitting ${name} must throw`);
    }
  });

  it("puts each saved result in the table that owns it", () => {
    // Getting this mapping wrong writes a customer's campaign into the assets
    // table, where nothing will ever read it back.
    const records = createModuleRecords(deps);
    const cases = [
      ["creator_studio", "asset_catalog", "creator_assets"],
      ["growth_studio", "campaign_workspace", "growth_campaigns"],
      ["growth_studio", "lead_follow_up", "growth_leads"]
    ];
    for (const [productKey, moduleKey, table] of cases) {
      const record = records.buildDomainModuleRecord("org-1", "user-1", productKey, moduleKey, {}, {});
      assert.equal(record.table, table, `${productKey}/${moduleKey} belongs in ${table}`);
      assert.equal(record.record.organization_id, "org-1", "every row must carry the tenant");
    }
  });

  it("says null for a module with no typed home rather than guessing one", () => {
    // Most modules only have a generic module_outputs row. Returning null is the
    // ordinary case, not a failure -- if this ever started guessing a table,
    // rows would land somewhere plausible and wrong.
    const records = createModuleRecords(deps);
    assert.equal(records.buildDomainModuleRecord("org-1", "u", "business_builder", "offer_builder", {}, {}), null);
    assert.equal(records.buildDomainModuleRecord("org-1", "u", "growth_studio", "not_a_module", {}, {}), null);
    assert.equal(records.buildDomainModuleRecord("org-1", "u", "creator_studio", "campaign_workspace", {}, {}), null);
  });

  it("keeps a missing user id null rather than writing the string", () => {
    const records = createModuleRecords(deps);
    const record = records.buildDomainModuleRecord("org-1", undefined, "creator_studio", "asset_catalog", {}, {});
    assert.equal(record.record.user_id, null);
  });

  it("falls back to a known value for an asset type or status it does not recognise", () => {
    // These reach a database column with a check constraint on it, so an
    // unrecognised value has to become a known one rather than travel.
    const records = createModuleRecords(deps);
    assert.equal(records.normalizeAssetType("VIDEO"), "video");
    assert.equal(records.normalizeAssetType("motion capture"), "other");
    assert.equal(records.normalizeAssetType(""), "file");
    assert.equal(records.normalizeCreatorAssetStatus("Published"), "published");
    assert.equal(records.normalizeCreatorAssetStatus("nonsense"), "draft");
    assert.equal(records.normalizeCreatorAssetStatus(undefined), "draft");
  });

  it("still warns about outreach consent on a saved lead", () => {
    // AGENTS.md requires consent and anti-clone safety to be enforced, and this
    // warning travels with the row rather than living only in the form.
    const records = createModuleRecords(deps);
    const lead = records.buildDomainModuleRecord("org-1", "u", "growth_studio", "lead_follow_up", {}, {});
    assert.match(lead.record.metadata.compliance_warning, /consent/i);
    assert.match(lead.record.metadata.compliance_warning, /opt-out/i);
  });

  it("refuses to write anything without a tenant", async () => {
    const records = createModuleRecords({ getSupabaseAdminClient: () => ({ ok: true, url: "https://x.supabase.co" }), supabaseHeaders: () => ({}) });
    assert.deepEqual(await records.safeInsertModuleOutput("", "p", "m", {}, {}), { ok: false, code: "organization_setup_required" });
    assert.deepEqual(await records.safeInsertDomainModuleRecord("", "u", "creator_studio", "asset_catalog", {}, {}), { ok: false, code: "setup_required" });
    const read = await records.safeReadOrganizationScopedRecords("", "creator_studio");
    assert.equal(read.ok, false);
    assert.deepEqual(read.records, []);
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

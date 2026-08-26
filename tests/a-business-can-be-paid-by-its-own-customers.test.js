"use strict";

const assert = require("node:assert/strict");
const payments = require("../lib/sonara-connected-payments.cjs");

// Deps shaped like the ones the routes pass in. `getEnv` is a plain lookup so a
// test can say exactly which variables are set, which is the thing most of
// these assertions are about.
function deps(env = {}) {
  return {
    getEnv: (name) => env[name],
    serviceRoleHeaders: () => ({ apikey: "service-role", Authorization: "Bearer service-role" }),
    supabaseUrl: "https://project.supabase.co"
  };
}

const CONFIGURED = { STRIPE_CONNECT_ENABLED: "true", STRIPE_SECRET_KEY: "sk_test_51aaaaaaaaaaaaaaaaaaaaaaaa" };

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => body };
}

describe("connected payments", () => {
  describe("readiness", () => {
    it("is off until the owner switches it on, and says which step is missing", () => {
      const readiness = payments.connectReadiness(deps({ STRIPE_SECRET_KEY: "sk_test_51aaaaaaaaaaaaaaaaaaaaaaaa" }));
      assert.equal(readiness.ok, false);
      assert.equal(readiness.status, "setup_required");
      assert.match(readiness.detail, /STRIPE_CONNECT_ENABLED/);
    });

    // The two failures are different afternoons for whoever reads them, so they
    // must not share a status. "Turn it on" and "it is on but broken" send a
    // person to different places.
    it("separates 'not switched on' from 'switched on and missing a key'", () => {
      const off = payments.connectReadiness(deps({}));
      const broken = payments.connectReadiness(deps({ STRIPE_CONNECT_ENABLED: "true" }));
      assert.equal(off.status, "setup_required");
      assert.equal(broken.status, "unavailable");
      assert.notEqual(off.status, broken.status);
    });

    it("refuses a placeholder secret rather than calling Stripe with it", () => {
      const readiness = payments.connectReadiness(
        deps({ STRIPE_CONNECT_ENABLED: "true", STRIPE_SECRET_KEY: "sk_test_placeholder" })
      );
      assert.equal(readiness.ok, false);
      assert.equal(readiness.status, "unavailable");
    });

    it("says out loud what it cannot verify", () => {
      const readiness = payments.connectReadiness(deps(CONFIGURED));
      assert.equal(readiness.ok, true);
      assert.match(readiness.assumes, /Connect is enabled on the platform account/);
    });
  });

  describe("reading the stored account", () => {
    // The distinction this repository keeps getting wrong. A failed read and a
    // workspace with no account arrive here looking identical, and only one of
    // them licenses a page to say "you have not connected an account".
    it("does not report a failed read as 'no account'", async () => {
      const failed = await payments.readAccount(deps(CONFIGURED), "org-1", async () => {
        throw new Error("network down");
      });
      assert.equal(failed.ok, false);
      assert.equal(failed.code, "unreadable");
      assert.equal(failed.account, undefined);

      const empty = await payments.readAccount(deps(CONFIGURED), "org-1", async () => jsonResponse([]));
      assert.equal(empty.ok, true);
      assert.equal(empty.account, null);
    });

    it("asks only for the live row", async () => {
      let asked = "";
      await payments.readAccount(deps(CONFIGURED), "org-1", async (url) => {
        asked = url;
        return jsonResponse([]);
      });
      assert.match(asked, /organization_id=eq\.org-1/);
      assert.match(asked, /disconnected_at=is\.null/);
    });
  });

  describe("asking Stripe what an account can do", () => {
    it("reads the three flags as three states, never coercing a missing one to false", async () => {
      const state = await payments.liveAccountState(deps(CONFIGURED), "acct_1abcdefgh", async () =>
        jsonResponse({ id: "acct_1abcdefgh", charges_enabled: true })
      );
      assert.equal(state.ok, true);
      assert.equal(state.chargesEnabled, true);
      // Stripe omitted them. Not false -- absent.
      assert.equal(state.payoutsEnabled, null);
      assert.equal(state.detailsSubmitted, null);
    });

    it("sends no Stripe-Account header when reading the account itself", async () => {
      let headers = null;
      await payments.liveAccountState(deps(CONFIGURED), "acct_1abcdefgh", async (url, options) => {
        headers = options.headers;
        return jsonResponse({ id: "acct_1abcdefgh", charges_enabled: true });
      });
      assert.equal("Stripe-Account" in headers, false);
    });

    it("refuses an id that is not an account id before putting it in a URL", async () => {
      const state = await payments.liveAccountState(deps(CONFIGURED), "../../secrets", async () => {
        throw new Error("should not have been called");
      });
      assert.equal(state.ok, false);
      assert.equal(state.code, "bad_account_id");
    });

    it("carries Stripe's requirements through instead of summarising them", async () => {
      const state = await payments.liveAccountState(deps(CONFIGURED), "acct_1abcdefgh", async () =>
        jsonResponse({
          id: "acct_1abcdefgh",
          charges_enabled: false,
          requirements: { currently_due: ["individual.verification.document"], disabled_reason: "requirements.past_due" }
        })
      );
      assert.deepEqual(state.requirementsDue, ["individual.verification.document"]);
      assert.equal(state.requirementsDisabledReason, "requirements.past_due");
    });
  });

  describe("whether a business may be paid", () => {
    // The assertion this module exists for. A cached "charges enabled" that
    // stands in when Stripe cannot be reached puts a pay button over an account
    // that cannot take money, and the customer discovers it at the till.
    it("never falls back to the cached flag when Stripe cannot be reached", async () => {
      const answer = await payments.canAcceptPayments(deps(CONFIGURED), "org-1", async (url) => {
        if (url.includes("supabase.co")) {
          return jsonResponse([
            {
              stripe_account_id: "acct_1abcdefgh",
              charges_enabled: true,
              state_checked_at: "2026-08-26T00:00:00Z"
            }
          ]);
        }
        throw new Error("stripe unreachable");
      });
      assert.equal(answer.ok, false);
      assert.equal(answer.code, "stripe_unreachable");
    });

    it("refuses with a reason a business owner can act on", async () => {
      const answer = await payments.canAcceptPayments(deps(CONFIGURED), "org-1", async (url) => {
        if (url.includes("supabase.co")) return jsonResponse([{ stripe_account_id: "acct_1abcdefgh" }]);
        return jsonResponse({
          id: "acct_1abcdefgh",
          charges_enabled: false,
          requirements: { currently_due: ["external_account"], disabled_reason: "requirements.past_due" }
        });
      });
      assert.equal(answer.ok, false);
      assert.equal(answer.code, "charges_disabled");
      assert.match(answer.detail, /requirements\.past_due/);
      assert.deepEqual(answer.requirementsDue, ["external_account"]);
    });

    it("allows charges while payouts are still pending, and reports that rather than refusing", async () => {
      const answer = await payments.canAcceptPayments(deps(CONFIGURED), "org-1", async (url) => {
        if (url.includes("supabase.co")) return jsonResponse([{ stripe_account_id: "acct_1abcdefgh" }]);
        return jsonResponse({ id: "acct_1abcdefgh", charges_enabled: true, payouts_enabled: false });
      });
      assert.equal(answer.ok, true);
      assert.equal(answer.payoutsEnabled, false);
    });

    it("says 'not connected' only when the read succeeded and found nothing", async () => {
      const answer = await payments.canAcceptPayments(deps(CONFIGURED), "org-1", async () => jsonResponse([]));
      assert.equal(answer.code, "not_connected");

      const unreadable = await payments.canAcceptPayments(deps(CONFIGURED), "org-1", async () => jsonResponse(null, { ok: false, status: 500 }));
      assert.equal(unreadable.code, "account_unreadable");
    });
  });

  describe("creating an account", () => {
    it("records our row only after Stripe confirms the account exists", async () => {
      const calls = [];
      const result = await payments.createAccount(
        deps(CONFIGURED),
        { organizationId: "org-1", country: "gb", email: "owner@example.com" },
        async (url, options) => {
          calls.push(`${options?.method || "GET"} ${url.includes("stripe.com") ? "stripe" : "supabase"}`);
          if (url.includes("stripe.com")) return jsonResponse({ id: "acct_1abcdefgh" });
          if (options?.method === "POST") return jsonResponse([{ id: "row-1" }]);
          return jsonResponse([]);
        }
      );
      assert.equal(result.ok, true);
      assert.deepEqual(calls, ["GET supabase", "POST stripe", "POST supabase"]);
    });

    // The recovery here is to record the id, not to retry -- and a retry is
    // exactly what a generic failure invites, producing a second Stripe account
    // for one business.
    it("names the orphaned account id when Stripe succeeded and our write did not", async () => {
      const result = await payments.createAccount(
        deps(CONFIGURED),
        { organizationId: "org-1" },
        async (url, options) => {
          if (url.includes("stripe.com")) return jsonResponse({ id: "acct_1abcdefgh" });
          if (options?.method === "POST") return jsonResponse(null, { ok: false, status: 500 });
          return jsonResponse([]);
        }
      );
      assert.equal(result.ok, false);
      assert.equal(result.code, "account_created_but_not_recorded");
      assert.equal(result.accountId, "acct_1abcdefgh");
    });

    it("refuses to make a second account for a workspace that already has one", async () => {
      const result = await payments.createAccount(deps(CONFIGURED), { organizationId: "org-1" }, async (url) => {
        if (url.includes("stripe.com")) throw new Error("should not have been called");
        return jsonResponse([{ stripe_account_id: "acct_1abcdefgh" }]);
      });
      assert.equal(result.code, "already_connected");
    });

    it("asks Stripe for a standard account and omits fields it was not given", async () => {
      let body = null;
      await payments.createAccount(deps(CONFIGURED), { organizationId: "org-1" }, async (url, options) => {
        if (url.includes("stripe.com")) {
          body = options.body;
          return jsonResponse({ id: "acct_1abcdefgh" });
        }
        if (options?.method === "POST") return jsonResponse([{ id: "row-1" }]);
        return jsonResponse([]);
      });
      const params = new URLSearchParams(body);
      assert.equal(params.get("type"), "standard");
      assert.equal(params.has("country"), false);
      assert.equal(params.has("email"), false);
    });

    it("never passes a Stripe error body through", async () => {
      const result = await payments.createAccount(deps(CONFIGURED), { organizationId: "org-1" }, async (url) => {
        if (url.includes("stripe.com")) {
          return jsonResponse({ error: { message: "platform acct_PLATFORMSECRET is not enabled" } }, { ok: false, status: 400 });
        }
        return jsonResponse([]);
      });
      assert.equal(result.code, "stripe_refused");
      assert.equal(JSON.stringify(result).includes("PLATFORMSECRET"), false);
    });
  });

  describe("the onboarding link", () => {
    it("refuses a URL that did not come from Stripe's connect host", async () => {
      const result = await payments.onboardingLink(
        deps(CONFIGURED),
        { accountId: "acct_1abcdefgh", returnUrl: "https://app.example/done", refreshUrl: "https://app.example/again" },
        async () => jsonResponse({ url: "https://evil.example/take-over" })
      );
      assert.equal(result.ok, false);
      assert.equal(result.code, "stripe_unreadable");
    });

    it("returns Stripe's link when it is Stripe's link", async () => {
      const result = await payments.onboardingLink(
        deps(CONFIGURED),
        { accountId: "acct_1abcdefgh", returnUrl: "https://app.example/done", refreshUrl: "https://app.example/again" },
        async () => jsonResponse({ url: "https://connect.stripe.com/setup/s/abc123" })
      );
      assert.equal(result.ok, true);
      assert.equal(result.url, "https://connect.stripe.com/setup/s/abc123");
    });

    it("will not ask for a link without somewhere to come back to", async () => {
      const result = await payments.onboardingLink(deps(CONFIGURED), { accountId: "acct_1abcdefgh" }, async () => {
        throw new Error("should not have been called");
      });
      assert.equal(result.code, "no_return_url");
    });
  });

  describe("disconnecting", () => {
    it("marks the row rather than deleting it", async () => {
      let method = null;
      let body = null;
      await payments.disconnect(deps(CONFIGURED), "org-1", async (url, options) => {
        method = options.method;
        body = JSON.parse(options.body);
        return jsonResponse({});
      });
      assert.equal(method, "PATCH");
      assert.ok(body.disconnected_at);
    });
  });

  describe("the boundary that must not move", () => {
    // Direct charges are the whole reason this is a payment feature rather than
    // money custody. `transfer_data` and `on_behalf_of` are how a charge is made
    // to route through the platform, and neither belongs in this module.
    it("contains no destination-charge machinery", () => {
      const source = require("node:fs").readFileSync(require.resolve("../lib/sonara-connected-payments.cjs"), "utf8");
      const code = source.replace(/^\s*\/\/.*$/gm, "");
      assert.equal(/transfer_data/.test(code), false, "transfer_data would route a customer's money through SONARA");
      assert.equal(/on_behalf_of/.test(code), false, "on_behalf_of is a platform charge, not a direct one");
      assert.equal(/application_fee/.test(code), false);
    });

    // AGENTS.md forbids storing raw card data or CVV. The design that honours
    // it is the one where card details never reach this application, so nothing
    // here should so much as name a card field.
    it("names no card field anywhere", () => {
      const source = require("node:fs").readFileSync(require.resolve("../lib/sonara-connected-payments.cjs"), "utf8");
      const code = source.replace(/^\s*\/\/.*$/gm, "");
      for (const forbidden of ["cvv", "cvc", "card_number", "pan"]) {
        assert.equal(new RegExp(`\\b${forbidden}\\b`, "i").test(code), false, `${forbidden} must never appear here`);
      }
    });
  });
});

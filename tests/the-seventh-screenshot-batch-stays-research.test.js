"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  SCREENSHOT_TOOL_RADAR_BATCH7,
  getPublicScreenshotToolCatalogBatch7,
  getScreenshotToolReadinessBatch7,
  getDeduplicatedReferencesBatch7
} = require("../lib/sonara-screenshot-tool-radar-batch7.cjs");

// Batch 7 is catalog state. These assertions are the boundary, not the prose in
// the module -- the researching-screenshot-tools skill is explicit that "a green
// test that cannot fail on the bad case is not evidence", so each of these is
// written to fail on a specific bad case rather than to describe the intent.

const REPOSITORIES = SCREENSHOT_TOOL_RADAR_BATCH7;

describe("the seventh screenshot batch stays research", () => {
  it("has records to test, so nothing below passes on an empty list", () => {
    assert.equal(REPOSITORIES.length, 7, `expected the seven submitted repositories, found ${REPOSITORIES.length}`);
    assert.equal(getPublicScreenshotToolCatalogBatch7().length, 7);
  });

  it("executes nothing in production", () => {
    const readiness = getScreenshotToolReadinessBatch7();
    assert.equal(readiness.productionExecutionCount, 0, "a screenshot research batch must never enable production execution");
    for (const item of readiness.repositories) {
      assert.equal(item.enabledInProduction, false, `${item.label} is enabled in production`);
      assert.equal(item.canExecute, false, `${item.label} reports itself executable`);
      assert.equal(item.runtimeStatus, "not_executed", `${item.label} claims a runtime status other than not_executed`);
      assert.equal(item.humanReviewRequired, true, `${item.label} does not require human review`);
    }
  });

  it("carries no runnable code path -- the catalog is data", () => {
    // The module must not import, spawn, fetch or shell out. A research catalog
    // that can execute its own subjects is not a catalog.
    const source = fs.readFileSync(path.join(__dirname, "..", "lib", "sonara-screenshot-tool-radar-batch7.cjs"), "utf8");
    assert.ok(source.length > 4000, `only ${source.length} bytes read; this check has gone blind`);
    for (const forbidden of ["child_process", "execSync", "spawn(", "fetch(", "eval("]) {
      assert.ok(!source.includes(forbidden), `${forbidden} appears in a module that must only hold data`);
    }
  });

  describe("an undeclared licence is never treated as adoptable", () => {
    const UNLICENSED = ["cporter202/openclaw-api-list", "cporter202/software-income-playbooks", "vulture-osint-automation-tool/vulture"];

    it("finds every repository that declares no licence", () => {
      const declared = REPOSITORIES.filter((item) => /NONE DECLARED/.test(item.license)).map((item) => item.repository);
      assert.deepEqual(declared.sort(), [...UNLICENSED].sort(), "the set of undeclared-licence repositories changed; re-read each licence before updating this list");
    });

    it("blocks each of them, at critical risk", () => {
      for (const repository of UNLICENSED) {
        const item = REPOSITORIES.find((entry) => entry.repository === repository);
        assert.ok(item, `${repository} is missing from the batch`);
        assert.equal(item.integrationStatus, "blocked", `${repository} has no licence and is not blocked`);
        assert.equal(item.licenseRisk, "critical", `${repository} has no licence and is not critical risk`);
        assert.ok(item.blockedUses.length > 0, `${repository} is blocked with no blocked uses recorded`);
      }
    });

    it("says in each record that absence of a licence is not permission", () => {
      for (const repository of UNLICENSED) {
        const item = REPOSITORIES.find((entry) => entry.repository === repository);
        assert.match(
          `${item.license} ${item.safety.join(" ")} ${item.blockedUses.join(" ")}`,
          /all rights reserved|no rights are granted|not permission/i,
          `${repository} does not say why an undeclared licence blocks it`
        );
      }
    });
  });

  describe("the affiliate measurement is recorded as a measurement", () => {
    const AFFILIATE = ["cporter202/openclaw-api-list", "cporter202/software-income-playbooks"];

    it("carries the counts and the code, not an impression", () => {
      for (const repository of AFFILIATE) {
        const item = REPOSITORIES.find((entry) => entry.repository === repository);
        const text = `${item.role} ${item.safety.join(" ")}`;
        assert.match(text, /fpr=p2hrc6/, `${repository} does not name the affiliate code that was measured`);
        assert.match(text, /99\.1%/, `${repository} does not carry the measured share`);
        assert.match(text, /\b78,\d{3}\b/, `${repository} does not carry the measured link counts`);
      }
    });

    it("forbids any of those links reaching a customer", () => {
      for (const repository of AFFILIATE) {
        const item = REPOSITORIES.find((entry) => entry.repository === repository);
        assert.match(
          `${item.blockedUses.join(" ")} ${item.safety.join(" ")}`,
          /customer/i,
          `${repository} does not block surfacing its links to a customer`
        );
      }
    });

    it("does not generalise the finding to every repository from that account", () => {
      // generative-ai-arbitrage carries 89 links and zero affiliate parameters.
      // Reporting only the incriminating half would be a true sentence arranged
      // to support a conclusion it does not carry.
      const source = fs.readFileSync(path.join(__dirname, "..", "lib", "sonara-screenshot-tool-radar-batch7.cjs"), "utf8");
      assert.match(source, /generative-ai-arbitrage/, "the counter-example is not recorded");
      assert.match(source, /not a property of the account/i, "the module does not state the limit of the finding");
    });
  });

  describe("a security reconnaissance tool is refused on conduct as well as licence", () => {
    const vulture = REPOSITORIES.find((item) => item.repository === "vulture-osint-automation-tool/vulture");

    it("is blocked for both reasons, so removing one does not unblock it", () => {
      assert.equal(vulture.integrationStatus, "blocked");
      assert.match(vulture.integrationMode, /license.*conduct|conduct.*license/i, "the mode does not record both refusals");
      const text = vulture.safety.join(" ");
      assert.match(text, /conduct refusal does not depend on it/i, "the record does not make the refusals independent");
    });

    it("permits no target, authorized or otherwise, from this product", () => {
      assert.ok(
        vulture.blockedUses.some((use) => /any use, in any environment/i.test(use)),
        "a credential-harvesting tool must not be left with a permitted configuration"
      );
    });

    it("does not overclaim a position on authorised security testing", () => {
      assert.match(
        vulture.safety.join(" "),
        /not a position on authorised security testing/i,
        "the record should refuse this tool for this product without condemning authorised testing generally"
      );
    });
  });

  describe("a GPU runtime does not assume the request process can run it", () => {
    const dwarfstar = REPOSITORIES.find((item) => item.repository === "ivanfioravanti/ds4-metal");

    it("is permissively licensed and still not adoptable, for architectural reasons", () => {
      assert.equal(dwarfstar.licenseRisk, "low", "MIT plus bundled Apache-2.0 is low risk");
      assert.equal(dwarfstar.integrationStatus, "research_only", "a permissive licence is not a reason to adopt a GPU runtime");
      assert.match(dwarfstar.safety.join(" "), /no GPU/i, "the record must say the serverless runtime has no GPU");
    });

    it("blocks inference inside the request process explicitly", () => {
      assert.ok(
        dwarfstar.blockedUses.some((use) => /request process/i.test(use)),
        "running inference in the Vercel request process must be a named blocked use"
      );
    });

    it("attributes both sets of copyright holders", () => {
      assert.match(dwarfstar.license, /ds4\.c authors/, "the MIT grant names the ds4.c authors");
      assert.match(dwarfstar.license, /ggml authors/, "and the ggml authors");
    });
  });

  describe("an infrastructure optimizer cannot mutate production from research state", () => {
    const ballast = REPOSITORIES.find((item) => item.repository === "tight-line/ballast");

    it("is advisory and says a recommendation is not permission", () => {
      assert.equal(ballast.integrationStatus, "research_only");
      assert.match(ballast.safety.join(" "), /never authorize|advisory/i, "an operator that applies changes must be recorded as advisory here");
      assert.ok(
        ballast.blockedUses.some((use) => /permission to change production/i.test(use)),
        "treating a right-sizing recommendation as permission must be blocked"
      );
    });

    it("does not read a permissive licence as applicability", () => {
      assert.match(ballast.safety.join(" "), /licence is not applicability|not applicability/i);
    });
  });

  describe("an informal licence word is not a licence file", () => {
    const clawflows = REPOSITORIES.find((item) => item.repository === "nikilster/clawflows");

    it("records the ambiguity rather than accepting the README", () => {
      assert.match(clawflows.license, /AMBIGUOUS/, "a README word with no LICENSE file is ambiguous");
      assert.match(clawflows.license, /NO LICENSE file/i, "the record must state the file is absent");
      assert.equal(clawflows.integrationStatus, "research_only_license_gated");
    });

    it("keeps external agent workflows behind the SONARA authority gate", () => {
      assert.match(
        `${clawflows.safety.join(" ")} ${clawflows.blockedUses.join(" ")}`,
        /sonara-agent-authority|authority gate/i,
        "an imported agent workflow must not bypass lib/sonara-agent-authority.cjs"
      );
    });
  });

  describe("conflicting licence declarations are all recorded", () => {
    const opencontext = REPOSITORIES.find((item) => item.repository === "0xranx/OpenContext");

    it("names all three rather than the badge", () => {
      for (const declaration of ["MIT", "Apache-2.0", "ISC"]) {
        assert.ok(opencontext.license.includes(declaration), `the record omits the ${declaration} declaration`);
      }
      assert.equal(opencontext.integrationStatus, "research_only_license_gated");
    });

    it("stays development-time and grants no authority", () => {
      assert.match(opencontext.placement, /[Dd]evelopment-time only/, "a context store must not reach the served application");
      assert.ok(
        opencontext.blockedUses.some((use) => /permission to act|customer data/i.test(use)),
        "stored agent context must not imply authority or receive customer data"
      );
    });
  });

  describe("already-decided submissions do not get a second verdict", () => {
    it("deduplicates the two that already carry one", () => {
      const deduplicated = getDeduplicatedReferencesBatch7().map((item) => item.repository).sort();
      assert.deepEqual(deduplicated, ["ai-sdlc-framework/ai-sdlc", "n8n-io/n8n"]);
    });

    it("records none of them as a batch 7 repository", () => {
      const recorded = REPOSITORIES.map((item) => item.repository);
      for (const repository of ["ai-sdlc-framework/ai-sdlc", "n8n-io/n8n"]) {
        assert.ok(!recorded.includes(repository), `${repository} has a verdict already; a second one means it has none`);
      }
    });

    it("and each already appears exactly once in the open-source register", () => {
      const register = fs.readFileSync(path.join(__dirname, "..", "data", "open-source-tools.ts"), "utf8");
      for (const repository of ["ai-sdlc-framework/ai-sdlc", "n8n-io/n8n"]) {
        const occurrences = register.split(`https://github.com/${repository}"`).length - 1;
        assert.ok(occurrences >= 1, `${repository} is deduplicated here but absent from the register`);
      }
    });
  });

  it("gives every record a concrete next step, including the blocked ones", () => {
    for (const item of REPOSITORIES) {
      assert.ok(String(item.nextStep || "").trim().length > 20, `${item.label} has no real next step`);
    }
  });
});

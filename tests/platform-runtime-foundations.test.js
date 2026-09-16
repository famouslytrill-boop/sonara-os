const assert = require("assert");
const { FORMULAS } = require("../lib/sonara-industry-algorithm-expansion.cjs");
const {
  FormulaInputError,
  evaluateFormula,
  tryEvaluateFormula,
  listExecutableFormulas
} = require("../lib/sonara-formula-engine.cjs");
const {
  ModuleManifestError,
  validateModuleManifest,
  resolveModuleOrder,
  planModuleInstallation
} = require("../lib/sonara-module-runtime.cjs");

describe("SONARA deterministic formula engine", () => {
  it("executes every formula currently published by the strategy registry", function() {
    const executable = listExecutableFormulas();
    assert.equal(executable.length, FORMULAS.length);
    assert.deepEqual(
      executable.map((item) => item.key).sort(),
      FORMULAS.map((item) => item.key).sort()
    );
  });

  it("calculates contribution margin without eval or provider calls", function() {
    const result = evaluateFormula("contribution_margin", {
      revenue: 120,
      variable_cost: 45
    });
    assert.equal(result.ok, true);
    assert.equal(result.value, 75);
    assert.equal(result.domain, "finance");
    assert.match(result.evidence.inputHash, /^[a-f0-9]{64}$/);
  });

  it("produces the same evidence hash for the same inputs regardless of object key order", function() {
    const first = evaluateFormula("route_cost", {
      distance_cost: 20,
      travel_time_cost: 10,
      lateness_penalty: 5,
      overtime_penalty: 2,
      unserved_penalty: 0
    });
    const second = evaluateFormula("route_cost", {
      unserved_penalty: 0,
      overtime_penalty: 2,
      lateness_penalty: 5,
      travel_time_cost: 10,
      distance_cost: 20
    });
    assert.equal(first.value, 37);
    assert.equal(first.evidence.inputHash, second.evidence.inputHash);
  });

  it("calculates OEE only from bounded rates", function() {
    const result = evaluateFormula("oee", {
      availability: 0.9,
      performance: 0.8,
      quality: 0.95
    });
    assert.ok(Math.abs(result.value - 0.684) < 1e-12);
    assert.throws(
      () => evaluateFormula("oee", { availability: 1.1, performance: 0.8, quality: 0.95 }),
      (error) => error instanceof FormulaInputError && error.code === "invalid_rate"
    );
  });

  it("rejects zero denominators instead of returning Infinity", function() {
    assert.throws(
      () => evaluateFormula("gmroi", { gross_margin_dollars: 50, average_inventory_cost: 0 }),
      (error) => error instanceof FormulaInputError && error.code === "non_positive_denominator"
    );
  });

  it("normalizes pitch classes and returns the shortest circular distance", function() {
    assert.equal(evaluateFormula("music_pitch_class_distance", { a: 11, b: 1 }).value, 2);
    assert.equal(evaluateFormula("music_pitch_class_distance", { a: -1, b: 13 }).value, 2);
  });

  it("computes great-circle distance with validated coordinates", function() {
    const result = evaluateFormula("haversine", {
      lat1: 39.9612,
      lon1: -82.9988,
      lat2: 40.7128,
      lon2: -74.0060
    });
    assert.ok(result.value > 700 && result.value < 800);
    assert.throws(
      () => evaluateFormula("haversine", { lat1: 100, lon1: 0, lat2: 0, lon2: 0 }),
      (error) => error instanceof FormulaInputError && error.code === "invalid_latitude"
    );
  });

  it("supports explainable weighted scores without inferring missing signals", function() {
    const result = evaluateFormula("lead_score", {
      signals: { intent: 0.9, fit: 0.8 },
      weights: { intent: 50, fit: 40, recency: 10 },
      disqualifier_penalties: 5
    });
    assert.equal(result.value, 72);
  });

  it("returns structured user-input failures through the non-throwing helper", function() {
    const result = tryEvaluateFormula("not-a-formula", {});
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "unknown_formula");
  });
});

describe("SONARA governed module runtime", () => {
  const formulaCore = {
    moduleId: "formula-engine-core",
    version: "1.0.0",
    products: ["shared_platform"],
    dependencies: [],
    permissions: ["formula.execute"],
    entities: ["formula_definitions"],
    workflows: [],
    formulas: ["contribution_margin", "route_cost", "oee"],
    providers: [],
    ui: { commandActions: ["calculate"] },
    offline: { supported: true, mutationQueue: false },
    pricing: { entitlement: "core" },
    risk: { class: "operational" }
  };

  const fleetPack = {
    moduleId: "fleet-operations-pack",
    version: "0.1.0",
    products: ["business_builder"],
    dependencies: ["formula-engine-core"],
    permissions: ["fleet.read", "route.plan"],
    entities: ["vehicles", "drivers", "routes"],
    workflows: ["dispatch-job"],
    formulas: ["route_cost", "haversine"],
    providers: [{ key: "gps-adapter", mode: "review_required" }],
    ui: { dashboardCards: ["fleet-health"], recordTabs: ["routes"] },
    offline: { supported: true, mutationQueue: true },
    pricing: { entitlement: "fleet-pro" },
    risk: { class: "operational" }
  };

  it("normalizes a valid manifest without granting anything", function() {
    const manifest = validateModuleManifest(fleetPack);
    assert.equal(manifest.moduleId, "fleet-operations-pack");
    assert.deepEqual(manifest.dependencies, ["formula-engine-core"]);
    assert.equal(manifest.offline.mutationQueue, true);
  });

  it("orders dependencies before the modules that require them", function() {
    const order = resolveModuleOrder([fleetPack, formulaCore]);
    assert.deepEqual(order.map((item) => item.moduleId), ["formula-engine-core", "fleet-operations-pack"]);
  });

  it("produces an auditable plan and leaves provider activation behind review", function() {
    const plan = planModuleInstallation([fleetPack, formulaCore]);
    assert.equal(plan.authority, "plan_only_no_side_effects");
    assert.deepEqual(plan.install, ["formula-engine-core", "fleet-operations-pack"]);
    assert.ok(plan.requestedPermissions.includes("formula.execute"));
    assert.ok(plan.requestedPermissions.includes("route.plan"));
    assert.ok(plan.requestedFormulas.includes("haversine"));
    assert.equal(plan.review.authorizationRequired, true);
    assert.equal(plan.review.providerReviewRequired, true);
    assert.deepEqual(plan.providerRequests, [{
      moduleId: "fleet-operations-pack",
      key: "gps-adapter",
      mode: "review_required"
    }]);
  });

  it("does not reinstall modules already recorded as installed", function() {
    const plan = planModuleInstallation([fleetPack, formulaCore], {
      installedModuleIds: ["formula-engine-core"]
    });
    assert.deepEqual(plan.alreadyInstalled, ["formula-engine-core"]);
    assert.deepEqual(plan.install, ["fleet-operations-pack"]);
    assert.ok(!plan.requestedPermissions.includes("formula.execute"));
  });

  it("rejects a formula that is only a string and not an executable allowlisted formula", function() {
    assert.throws(
      () => validateModuleManifest({ ...formulaCore, formulas: ["invented-formula"] }),
      (error) => error instanceof ModuleManifestError && error.code === "unknown_formula"
    );
  });

  it("rejects missing dependencies before an installation plan can exist", function() {
    assert.throws(
      () => resolveModuleOrder([fleetPack]),
      (error) => error instanceof ModuleManifestError && error.code === "missing_dependency"
    );
  });

  it("rejects dependency cycles deterministically", function() {
    const a = { ...formulaCore, moduleId: "module-a", dependencies: ["module-b"] };
    const b = { ...formulaCore, moduleId: "module-b", dependencies: ["module-a"] };
    assert.throws(
      () => resolveModuleOrder([a, b]),
      (error) => error instanceof ModuleManifestError && error.code === "dependency_cycle"
    );
  });
});

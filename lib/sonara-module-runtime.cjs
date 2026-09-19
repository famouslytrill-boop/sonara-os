// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Governed platform-inside-the-platform composition runtime.
//
// This module validates and orders SONARA module manifests. It deliberately does
// not persist installations, load arbitrary packages, import remote code, grant
// permissions, activate providers, apply migrations, or mutate infrastructure.
// Those actions stay behind the existing authorization, approval, migration and
// provider boundaries. The output is an auditable installation plan.

const { listExecutableFormulas } = require("./sonara-formula-engine.cjs");

const RUNTIME_VERSION = "2026-09-16.1";
const PRODUCT_KEYS = new Set([
  "shared_platform",
  "business_builder",
  "creator_studio",
  "growth_studio"
]);
const PROVIDER_MODES = new Set(["none", "optional", "review_required"]);
const RISK_CLASSES = new Set(["low", "operational", "financial", "security", "regulated"]);
const MODULE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PERMISSION_ID = /^[a-z0-9_]+(?:\.[a-z0-9_*]+)+$/;
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

class ModuleManifestError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ModuleManifestError";
    this.code = code;
    this.details = details;
  }
}

function validateModuleManifest(manifest) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new ModuleManifestError("invalid_manifest", "Module manifest must be an object");
  }

  const moduleId = String(manifest.moduleId || "").trim();
  if (!MODULE_ID.test(moduleId)) {
    throw new ModuleManifestError("invalid_module_id", "moduleId must use lowercase kebab-case");
  }

  const version = String(manifest.version || "").trim();
  if (!SEMVER.test(version)) {
    throw new ModuleManifestError("invalid_version", "version must be semantic version x.y.z");
  }

  const products = uniqueStrings(manifest.products || []);
  for (const product of products) {
    if (!PRODUCT_KEYS.has(product)) {
      throw new ModuleManifestError("unknown_product", `Unknown product target: ${product}`, { moduleId, product });
    }
  }

  const dependencies = uniqueStrings(manifest.dependencies || []);
  if (dependencies.includes(moduleId)) {
    throw new ModuleManifestError("self_dependency", `${moduleId} cannot depend on itself`, { moduleId });
  }
  for (const dependency of dependencies) {
    if (!MODULE_ID.test(dependency)) {
      throw new ModuleManifestError("invalid_dependency", `Invalid dependency id: ${dependency}`, { moduleId, dependency });
    }
  }

  const permissions = uniqueStrings(manifest.permissions || []);
  for (const permission of permissions) {
    if (!PERMISSION_ID.test(permission)) {
      throw new ModuleManifestError("invalid_permission", `Invalid permission id: ${permission}`, { moduleId, permission });
    }
  }

  const formulaKeys = uniqueStrings(manifest.formulas || []);
  const executableFormulas = new Set(listExecutableFormulas().map((item) => item.key));
  for (const formula of formulaKeys) {
    if (!executableFormulas.has(formula)) {
      throw new ModuleManifestError("unknown_formula", `Module ${moduleId} requests a formula that is not executable: ${formula}`, { moduleId, formula });
    }
  }

  const providers = normalizeProviders(manifest.providers || [], moduleId);
  const riskClass = String(manifest.risk?.class || "operational");
  if (!RISK_CLASSES.has(riskClass)) {
    throw new ModuleManifestError("invalid_risk_class", `Unknown risk class: ${riskClass}`, { moduleId, riskClass });
  }

  const entities = uniqueStrings(manifest.entities || []);
  const workflows = uniqueStrings(manifest.workflows || []);
  const ui = normalizeUi(manifest.ui || {});
  const offline = normalizeOffline(manifest.offline || {});
  const pricing = normalizePricing(manifest.pricing || {});

  return Object.freeze({
    moduleId,
    version,
    products: Object.freeze(products),
    dependencies: Object.freeze(dependencies),
    permissions: Object.freeze(permissions),
    entities: Object.freeze(entities),
    workflows: Object.freeze(workflows),
    formulas: Object.freeze(formulaKeys),
    providers: Object.freeze(providers),
    ui: Object.freeze(ui),
    offline: Object.freeze(offline),
    pricing: Object.freeze(pricing),
    risk: Object.freeze({ class: riskClass }),
    runtimeVersion: RUNTIME_VERSION
  });
}

function resolveModuleOrder(manifests) {
  if (!Array.isArray(manifests) || !manifests.length) return [];
  const normalized = manifests.map(validateModuleManifest);
  const byId = new Map();

  for (const manifest of normalized) {
    if (byId.has(manifest.moduleId)) {
      throw new ModuleManifestError("duplicate_module", `Duplicate module manifest: ${manifest.moduleId}`);
    }
    byId.set(manifest.moduleId, manifest);
  }

  for (const manifest of normalized) {
    for (const dependency of manifest.dependencies) {
      if (!byId.has(dependency)) {
        throw new ModuleManifestError("missing_dependency", `${manifest.moduleId} requires missing module ${dependency}`, {
          moduleId: manifest.moduleId,
          dependency
        });
      }
    }
  }

  const state = new Map();
  const order = [];
  const stack = [];

  function visit(moduleId) {
    const marker = state.get(moduleId);
    if (marker === "done") return;
    if (marker === "visiting") {
      const start = stack.indexOf(moduleId);
      const cycle = [...stack.slice(start), moduleId];
      throw new ModuleManifestError("dependency_cycle", `Module dependency cycle: ${cycle.join(" -> ")}`, { cycle });
    }

    state.set(moduleId, "visiting");
    stack.push(moduleId);
    const manifest = byId.get(moduleId);
    for (const dependency of [...manifest.dependencies].sort()) visit(dependency);
    stack.pop();
    state.set(moduleId, "done");
    order.push(manifest);
  }

  for (const moduleId of [...byId.keys()].sort()) visit(moduleId);
  return order;
}

function planModuleInstallation(manifests, options = {}) {
  const order = resolveModuleOrder(manifests);
  const installed = new Set(uniqueStrings(options.installedModuleIds || []));
  const install = order.filter((item) => !installed.has(item.moduleId));
  const alreadyInstalled = order.filter((item) => installed.has(item.moduleId));

  const requestedPermissions = uniqueStrings(install.flatMap((item) => item.permissions));
  const requestedFormulas = uniqueStrings(install.flatMap((item) => item.formulas));
  const providerRequests = install.flatMap((item) => item.providers.map((provider) => ({
    moduleId: item.moduleId,
    ...provider
  })));
  const regulatedModules = install.filter((item) => item.risk.class === "regulated").map((item) => item.moduleId);
  const sensitiveModules = install
    .filter((item) => ["financial", "security", "regulated"].includes(item.risk.class))
    .map((item) => item.moduleId);

  return Object.freeze({
    ok: true,
    authority: "plan_only_no_side_effects",
    runtimeVersion: RUNTIME_VERSION,
    order: Object.freeze(order.map((item) => item.moduleId)),
    install: Object.freeze(install.map((item) => item.moduleId)),
    alreadyInstalled: Object.freeze(alreadyInstalled.map((item) => item.moduleId)),
    requestedPermissions: Object.freeze(requestedPermissions),
    requestedFormulas: Object.freeze(requestedFormulas),
    providerRequests: Object.freeze(providerRequests),
    review: Object.freeze({
      authorizationRequired: requestedPermissions.length > 0,
      providerReviewRequired: providerRequests.some((item) => item.mode !== "none"),
      elevatedRiskReviewRequired: sensitiveModules.length > 0,
      sensitiveModules: Object.freeze(sensitiveModules),
      regulatedModules: Object.freeze(regulatedModules)
    })
  });
}

function normalizeProviders(providers, moduleId) {
  if (!Array.isArray(providers)) {
    throw new ModuleManifestError("invalid_providers", "providers must be an array", { moduleId });
  }
  return providers.map((provider, index) => {
    if (!provider || typeof provider !== "object" || Array.isArray(provider)) {
      throw new ModuleManifestError("invalid_provider", `providers[${index}] must be an object`, { moduleId, index });
    }
    const key = String(provider.key || "").trim();
    const mode = String(provider.mode || "review_required").trim();
    if (!MODULE_ID.test(key)) {
      throw new ModuleManifestError("invalid_provider_key", `Invalid provider key: ${key || "(empty)"}`, { moduleId, index });
    }
    if (!PROVIDER_MODES.has(mode)) {
      throw new ModuleManifestError("invalid_provider_mode", `Invalid provider mode: ${mode}`, { moduleId, key, mode });
    }
    return Object.freeze({ key, mode });
  });
}

function normalizeUi(ui) {
  return {
    dashboardCards: Object.freeze(uniqueStrings(ui.dashboardCards || [])),
    recordTabs: Object.freeze(uniqueStrings(ui.recordTabs || [])),
    commandActions: Object.freeze(uniqueStrings(ui.commandActions || []))
  };
}

function normalizeOffline(offline) {
  return {
    supported: offline.supported === true,
    mutationQueue: offline.mutationQueue === true
  };
}

function normalizePricing(pricing) {
  const entitlement = pricing.entitlement == null ? null : String(pricing.entitlement).trim();
  return { entitlement: entitlement || null };
}

function uniqueStrings(values) {
  if (!Array.isArray(values)) throw new ModuleManifestError("invalid_array", "Expected an array");
  const output = [];
  const seen = new Set();
  for (const raw of values) {
    const value = String(raw || "").trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    output.push(value);
  }
  return output.sort();
}

module.exports = {
  RUNTIME_VERSION,
  PRODUCT_KEYS,
  ModuleManifestError,
  validateModuleManifest,
  resolveModuleOrder,
  planModuleInstallation
};

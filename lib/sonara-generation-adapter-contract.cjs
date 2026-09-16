"use strict";

const REQUIRED_GENERATION_ADAPTER_METHODS = Object.freeze([
  "submit",
  "status",
  "cancel",
  "result",
  "health"
]);

const SUPPORTED_CALLBACK_TYPES = Object.freeze([
  "none",
  "authenticated_webhook",
  "bounded_polling"
]);

class GenerationAdapterContractError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "GenerationAdapterContractError";
    this.code = code;
  }
}

function validateGenerationAdapterManifest(manifest = {}) {
  const errors = [];
  if (!nonEmpty(manifest.key)) errors.push("key_required");
  if (!nonEmpty(manifest.label)) errors.push("label_required");
  if (!nonEmptyArray(manifest.modalities)) errors.push("modalities_required");
  if (!nonEmptyArray(manifest.operations)) errors.push("operations_required");
  if (!nonEmptyArray(manifest.executionModes)) errors.push("execution_modes_required");
  if (!Array.isArray(manifest.callbackTypes) || manifest.callbackTypes.some((type) => !SUPPORTED_CALLBACK_TYPES.includes(type))) {
    errors.push("invalid_callback_types");
  }
  if (!Number.isInteger(manifest.maxPayloadBytes) || manifest.maxPayloadBytes < 0) errors.push("invalid_max_payload_bytes");
  if (typeof manifest.supportsCostEstimate !== "boolean") errors.push("supports_cost_estimate_required");
  if (typeof manifest.supportsStreaming !== "boolean") errors.push("supports_streaming_required");
  if (typeof manifest.externalNetwork !== "boolean") errors.push("external_network_required");
  if (typeof manifest.externalSpend !== "boolean") errors.push("external_spend_required");

  return {
    ok: errors.length === 0,
    errors,
    manifest: errors.length ? null : freezeCopy(manifest)
  };
}

function validateGenerationAdapter(adapter) {
  const manifestResult = validateGenerationAdapterManifest(adapter?.manifest || {});
  const missingMethods = REQUIRED_GENERATION_ADAPTER_METHODS.filter((method) => typeof adapter?.[method] !== "function");
  return {
    ok: manifestResult.ok && missingMethods.length === 0,
    manifest: manifestResult.manifest,
    manifestErrors: manifestResult.errors,
    missingMethods,
    authority: {
      publishArtifact: false,
      sendExternally: false,
      chargeCustomer: false,
      destructiveAction: false,
      mutateIdentitySensitiveData: false
    }
  };
}

function assertGenerationAdapter(adapter) {
  const result = validateGenerationAdapter(adapter);
  if (!result.ok) {
    throw new GenerationAdapterContractError(
      "invalid_adapter",
      `Generation adapter does not satisfy the canonical contract: ${[...result.manifestErrors, ...result.missingMethods].join(", ")}`
    );
  }
  return result;
}

function buildGenerationAdapterArchitecture() {
  return {
    ok: true,
    schema: "sonara.generation.adapter-contract.v1",
    requiredMethods: [...REQUIRED_GENERATION_ADAPTER_METHODS],
    optionalMethods: ["stream"],
    callbackTypes: [...SUPPORTED_CALLBACK_TYPES],
    invariants: [
      "Adapter manifests declare capabilities; they do not grant execution authority.",
      "submit must be tenant-scoped and idempotent.",
      "status, cancel and result must resolve only server-held provider locators.",
      "result cannot expose a generation artifact for downstream use before durable persistence and provenance exist.",
      "health must not perform billable generation.",
      "Raw customer prompts, source media, credentials and authorization headers are not persistence metadata.",
      "Publication, customer sends, billing and destructive actions remain outside adapter authority."
    ]
  };
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function nonEmptyArray(value) {
  return Array.isArray(value) && value.length > 0 && value.every(nonEmpty);
}

function freezeCopy(value) {
  return Object.freeze(JSON.parse(JSON.stringify(value)));
}

module.exports = {
  REQUIRED_GENERATION_ADAPTER_METHODS,
  SUPPORTED_CALLBACK_TYPES,
  GenerationAdapterContractError,
  validateGenerationAdapterManifest,
  validateGenerationAdapter,
  assertGenerationAdapter,
  buildGenerationAdapterArchitecture
};

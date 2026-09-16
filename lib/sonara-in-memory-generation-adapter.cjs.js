"use strict";

const { createHash } = require("node:crypto");
const {
  InMemoryGenerationJobRepository,
  TERMINAL_GENERATION_JOB_STATES,
  GenerationJobRepositoryError
} = require("./sonara-generation-job-repository.cjs");
const { assertGenerationAdapter } = require("./sonara-generation-adapter-contract.cjs");

const IN_MEMORY_GENERATION_ADAPTER_MANIFEST = Object.freeze({
  key: "in_memory_reference",
  label: "SONARA in-memory generation reference adapter",
  modalities: Object.freeze(["text", "document", "image", "audio", "music", "speech", "video", "three_d", "transcription", "multimodal"]),
  operations: Object.freeze(["generate", "edit", "transform", "extend", "upscale", "transcribe", "synthesize_speech", "compose_music", "render_3d", "analyze"]),
  executionModes: Object.freeze(["asynchronous_job"]),
  callbackTypes: Object.freeze(["none"]),
  maxPayloadBytes: 0,
  supportsCostEstimate: true,
  supportsStreaming: false,
  externalNetwork: false,
  externalSpend: false,
  implementationState: "reference_only"
});

class InMemoryGenerationAdapter {
  constructor(options = {}) {
    this.clock = options.clock || (() => new Date());
    this.repository = options.repository || new InMemoryGenerationJobRepository({
      clock: this.clock,
      idFactory: options.idFactory
    });
    this.manifest = IN_MEMORY_GENERATION_ADAPTER_MANIFEST;
    assertGenerationAdapter(this);
  }

  async submit(request = {}) {
    assertSupported(this.manifest, request);
    const created = this.repository.createOrGetByIdempotency({
      tenantId: request.tenantId,
      requestId: request.requestId,
      idempotencyKey: request.idempotencyKey,
      deadlineAt: request.deadlineAt,
      adapterKey: this.manifest.key,
      modality: request.modality,
      operation: request.operation,
      inputReferences: request.inputReferences,
      inputDigests: request.inputDigests
    });

    if (!created.created) {
      return submissionResponse(created.job, false);
    }

    let job = created.job;
    job = this.repository.transition({
      tenantId: job.tenantId,
      jobId: job.id,
      expectedVersion: job.version,
      toState: "submitted",
      reason: "reference_adapter_accepted"
    });
    job = this.repository.recordProviderLocator({
      tenantId: job.tenantId,
      jobId: job.id,
      expectedVersion: job.version,
      adapterKey: this.manifest.key,
      providerRequestId: `memory:${job.id}`
    });
    job = this.repository.transition({
      tenantId: job.tenantId,
      jobId: job.id,
      expectedVersion: job.version,
      toState: "queued",
      reason: "reference_adapter_queue"
    });
    return submissionResponse(job, true);
  }

  async status(request = {}) {
    let job = requireJob(this.repository, request.tenantId, request.jobId);
    if (!TERMINAL_GENERATION_JOB_STATES.includes(job.state) && job.deadlineAt && new Date(job.deadlineAt).getTime() <= this.clock().getTime()) {
      job = this.repository.transition({
        tenantId: job.tenantId,
        jobId: job.id,
        expectedVersion: job.version,
        toState: "expired",
        reason: "deadline_elapsed"
      });
    }
    return statusResponse(job);
  }

  async cancel(request = {}) {
    const job = requireJob(this.repository, request.tenantId, request.jobId);
    if (job.state === "canceled") return statusResponse(job);
    if (TERMINAL_GENERATION_JOB_STATES.includes(job.state)) {
      return {
        ...statusResponse(job),
        canceled: false,
        cancelReason: "already_terminal"
      };
    }
    const canceled = this.repository.transition({
      tenantId: job.tenantId,
      jobId: job.id,
      expectedVersion: job.version,
      toState: "canceled",
      reason: "caller_requested_cancel"
    });
    return { ...statusResponse(canceled), canceled: true };
  }

  async result(request = {}) {
    const job = requireJob(this.repository, request.tenantId, request.jobId);
    if (job.state !== "succeeded") {
      return {
        ok: false,
        available: false,
        state: job.state,
        jobId: job.id,
        reason: TERMINAL_GENERATION_JOB_STATES.includes(job.state) ? "job_did_not_succeed" : "job_not_complete"
      };
    }
    return {
      ok: true,
      available: true,
      state: job.state,
      jobId: job.id,
      artifacts: job.artifacts,
      provenanceRequired: true,
      authority: noDownstreamAuthority()
    };
  }

  async health() {
    return {
      ok: true,
      adapterKey: this.manifest.key,
      state: "ready",
      externalNetworkChecked: false,
      billableGenerationPerformed: false,
      externalSpend: false
    };
  }

  async complete(request = {}) {
    let job = requireJob(this.repository, request.tenantId, request.jobId);
    if (job.state === "queued") {
      job = this.repository.transition({
        tenantId: job.tenantId,
        jobId: job.id,
        expectedVersion: job.version,
        toState: "running",
        reason: "reference_adapter_started"
      });
    }
    if (job.state !== "running") {
      throw new GenerationJobRepositoryError("completion_requires_running", `Cannot complete generation job from ${job.state}.`);
    }

    const bytes = typeof request.syntheticBytes === "string" ? request.syntheticBytes : `sonara-reference:${job.id}`;
    const sha256 = request.sha256 || createHash("sha256").update(bytes).digest("hex");
    job = this.repository.recordArtifact({
      tenantId: job.tenantId,
      jobId: job.id,
      expectedVersion: job.version,
      artifactId: request.artifactId || `artifact_${job.id}`,
      storageRef: request.storageRef || `memory://artifacts/${job.tenantId}/${job.id}`,
      sha256,
      mediaType: request.mediaType || "application/octet-stream",
      durable: true,
      provenance: {
        adapterKey: this.manifest.key,
        modelRef: "synthetic-reference-no-model",
        sourceJobId: job.id,
        rightsAttestationRef: request.rightsAttestationRef || null
      }
    });
    job = this.repository.recordCost({
      tenantId: job.tenantId,
      jobId: job.id,
      expectedVersion: job.version,
      amountMinor: 0,
      currency: "USD",
      final: true,
      source: "zero_network_reference_adapter"
    });
    job = this.repository.transition({
      tenantId: job.tenantId,
      jobId: job.id,
      expectedVersion: job.version,
      toState: "succeeded",
      reason: "reference_adapter_completed"
    });
    return statusResponse(job);
  }
}

function assertSupported(manifest, request) {
  if (!manifest.modalities.includes(request.modality)) {
    throw new GenerationJobRepositoryError("unsupported_modality", `Unsupported modality: ${request.modality}.`);
  }
  if (!manifest.operations.includes(request.operation)) {
    throw new GenerationJobRepositoryError("unsupported_operation", `Unsupported operation: ${request.operation}.`);
  }
}

function requireJob(repository, tenantId, jobId) {
  const job = repository.getById(tenantId, jobId);
  if (!job) throw new GenerationJobRepositoryError("job_not_found", "Generation job not found in tenant scope.");
  return job;
}

function submissionResponse(job, created) {
  return {
    ok: true,
    created,
    jobId: job.id,
    state: job.state,
    version: job.version,
    providerLocator: job.providerLocator,
    externalNetworkUsed: false,
    externalSpendAuthorized: false,
    authority: noDownstreamAuthority()
  };
}

function statusResponse(job) {
  return {
    ok: true,
    jobId: job.id,
    state: job.state,
    version: job.version,
    terminal: TERMINAL_GENERATION_JOB_STATES.includes(job.state),
    artifactCount: job.artifacts.length,
    cost: job.cost,
    authority: noDownstreamAuthority()
  };
}

function noDownstreamAuthority() {
  return {
    publishArtifact: false,
    sendExternally: false,
    chargeCustomer: false,
    destructiveAction: false,
    mutateIdentitySensitiveData: false
  };
}

module.exports = {
  IN_MEMORY_GENERATION_ADAPTER_MANIFEST,
  InMemoryGenerationAdapter
};
